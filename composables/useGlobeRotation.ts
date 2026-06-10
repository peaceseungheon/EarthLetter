// composables/useGlobeRotation.ts
//
// Drag / inertia / idle auto-rotation for the orthographic globe
// (architecture § 6.2, § 2-D2/D3). Pointer Events handle mouse/touch/pen in
// a single code path; pointermove only accumulates deltas and the actual
// rotation update happens at most once per animation frame (rAF coalescing).
//
// Pointer capture starts lazily — only after the pointer travels a few px —
// so that plain taps/clicks keep their original <path> target (capturing on
// pointerdown would retarget the synthetic click to the captured element and
// break country navigation).
//
// Auto-rotation (3°/s, deltaTime-based) obeys the four mandatory stop
// conditions: prefers-reduced-motion, user interaction (resumes after 5 s of
// idle), globe outside the viewport (IntersectionObserver) and a
// backgrounded tab (visibilitychange).

import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

export type GlobeRotation = [number, number, number]

export interface UseGlobeRotationOptions {
  /** Deterministic initial [λ, φ, 0] — constants or SSR-derived only (§ 2-D9). */
  initialRotation?: GlobeRotation
  /** Idle auto-rotation enabled (default true). */
  autoRotate?: boolean
}

export interface UseGlobeRotationResult {
  rotation: Ref<GlobeRotation>
  isDragging: Ref<boolean>
  /** px travelled during the most recent press — callers suppress click-after-drag. */
  lastDragDistance: Ref<number>
  /** true once the user dragged/hovered — programmatic rotation then becomes a no-op. */
  hasInteracted: Ref<boolean>
  /** Pause auto-rotation (hover, focus, popover open). */
  pause: () => void
  /** Resume auto-rotation after 5 s without further interaction. */
  resumeAfterIdle: () => void
  /** Programmatic rotation (e.g. face the top trending country). */
  rotateTo: (target: GlobeRotation) => void
  /** Attach pointer listeners + observers to the SVG element (client, onMounted). */
  bind: (el: Element) => void
}

const DRAG_SENSITIVITY = 0.25 // degrees per px (§ 2-D2)
const PHI_MIN = -80
const PHI_MAX = 80
const AUTO_ROTATE_DEG_PER_SEC = 3
const IDLE_RESUME_MS = 5000
const INERTIA_DECAY = 0.95 // per frame
const INERTIA_STOP_DEG = 0.01 // °/frame below which inertia stops
const DRAG_START_PX = 3 // movement before a press becomes a drag
const VELOCITY_WINDOW_MS = 100 // pointer samples considered for inertia
const MAX_FRAME_DT_S = 0.1 // clamp dt after long stalls

interface MoveSample {
  dx: number
  dy: number
  t: number
}

function clampPhi(value: number): number {
  return Math.min(PHI_MAX, Math.max(PHI_MIN, value))
}

export function useGlobeRotation(
  options: UseGlobeRotationOptions = {}
): UseGlobeRotationResult {
  const autoRotateEnabled = options.autoRotate !== false
  const initial = options.initialRotation ?? [0, -15, 0]

  const rotation = ref<GlobeRotation>([initial[0], initial[1], initial[2]])
  const isDragging = ref(false)
  const lastDragDistance = ref(0)
  const hasInteracted = ref(false)

  // --- non-reactive frame state (perf: never touches Vue reactivity) ---
  let boundEl: Element | null = null
  let rafId: number | null = null
  let lastFrameTs: number | null = null
  let pendingDx = 0
  let pendingDy = 0
  let inertiaActive = false
  let velocityX = 0 // px per frame
  let velocityY = 0
  let moveSamples: MoveSample[] = []
  let pressing = false
  let pressPointerId: number | null = null
  let pressX = 0
  let pressY = 0
  let userPaused = false
  let reducedMotion = false
  let inViewport = true
  let pageVisible = true
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let observer: IntersectionObserver | null = null
  // QA BUG-1: late callers (e.g. a parent's stray timer → resumeAfterIdle)
  // must never restart the rAF loop after unmount.
  let disposed = false

  function applyDelta(dx: number, dy: number): void {
    const [lambda, phi] = rotation.value
    rotation.value = [
      lambda + dx * DRAG_SENSITIVITY,
      clampPhi(phi - dy * DRAG_SENSITIVITY),
      0
    ]
  }

  function autoActive(): boolean {
    return autoRotateEnabled && !reducedMotion && !userPaused
  }

  function shouldLoop(): boolean {
    if (!inViewport || !pageVisible) return false
    return isDragging.value || inertiaActive || autoActive()
  }

  function frame(ts: number): void {
    rafId = null
    const dt =
      lastFrameTs === null
        ? 0
        : Math.min((ts - lastFrameTs) / 1000, MAX_FRAME_DT_S)
    lastFrameTs = ts

    if (isDragging.value) {
      if (pendingDx !== 0 || pendingDy !== 0) {
        applyDelta(pendingDx, pendingDy)
        pendingDx = 0
        pendingDy = 0
      }
    } else if (inertiaActive) {
      applyDelta(velocityX, velocityY)
      velocityX *= INERTIA_DECAY
      velocityY *= INERTIA_DECAY
      if (
        Math.hypot(velocityX, velocityY) * DRAG_SENSITIVITY <
        INERTIA_STOP_DEG
      ) {
        inertiaActive = false
        scheduleIdleResume()
      }
    } else if (autoActive() && dt > 0) {
      const [lambda, phi] = rotation.value
      rotation.value = [lambda + AUTO_ROTATE_DEG_PER_SEC * dt, phi, 0]
    }

    if (shouldLoop()) {
      rafId = requestAnimationFrame(frame)
    } else {
      lastFrameTs = null
    }
  }

  function startLoop(): void {
    if (disposed) return
    if (rafId === null && shouldLoop()) {
      lastFrameTs = null
      rafId = requestAnimationFrame(frame)
    }
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastFrameTs = null
  }

  function clearIdleTimer(): void {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  function scheduleIdleResume(): void {
    if (disposed) return
    clearIdleTimer()
    idleTimer = setTimeout(() => {
      idleTimer = null
      userPaused = false
      startLoop()
    }, IDLE_RESUME_MS)
  }

  function pause(): void {
    hasInteracted.value = true
    userPaused = true
    clearIdleTimer()
  }

  function resumeAfterIdle(): void {
    scheduleIdleResume()
  }

  function rotateTo(target: GlobeRotation): void {
    if (hasInteracted.value) return
    rotation.value = [target[0], clampPhi(target[1]), 0]
  }

  // --- pointer handlers ---

  function onPointerDown(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    hasInteracted.value = true
    userPaused = true
    clearIdleTimer()
    inertiaActive = false
    pressing = true
    pressPointerId = e.pointerId
    pressX = e.clientX
    pressY = e.clientY
    lastDragDistance.value = 0
    moveSamples = []
  }

  function onPointerMove(e: PointerEvent): void {
    if (!pressing || e.pointerId !== pressPointerId) return
    const dx = e.clientX - pressX
    const dy = e.clientY - pressY
    pressX = e.clientX
    pressY = e.clientY
    lastDragDistance.value += Math.hypot(dx, dy)

    if (!isDragging.value) {
      if (lastDragDistance.value < DRAG_START_PX) return
      isDragging.value = true
      try {
        boundEl?.setPointerCapture(e.pointerId)
      } catch {
        // capture can fail if the pointer is already gone — drag still works
      }
    }

    pendingDx += dx
    pendingDy += dy
    moveSamples = [...moveSamples.slice(-4), { dx, dy, t: e.timeStamp }]
    startLoop()
  }

  function onPointerUp(e: PointerEvent): void {
    if (!pressing || e.pointerId !== pressPointerId) return
    pressing = false
    pressPointerId = null
    try {
      boundEl?.releasePointerCapture(e.pointerId)
    } catch {
      // no capture to release — fine
    }
    if (!isDragging.value) {
      scheduleIdleResume()
      return
    }
    isDragging.value = false

    // Inertia from the average velocity of the last ~100 ms of movement.
    const recent = moveSamples.filter(
      (s) => e.timeStamp - s.t < VELOCITY_WINDOW_MS
    )
    if (!reducedMotion && recent.length > 0) {
      const first = recent[0]!
      const spanMs = Math.max(e.timeStamp - first.t, 16.7)
      const sumDx = recent.reduce((acc, s) => acc + s.dx, 0)
      const sumDy = recent.reduce((acc, s) => acc + s.dy, 0)
      velocityX = (sumDx / spanMs) * 16.7
      velocityY = (sumDy / spanMs) * 16.7
      inertiaActive =
        Math.hypot(velocityX, velocityY) * DRAG_SENSITIVITY >= INERTIA_STOP_DEG
    }
    if (!inertiaActive) scheduleIdleResume()
    startLoop()
  }

  function onVisibilityChange(): void {
    pageVisible = !document.hidden
    if (pageVisible) {
      startLoop()
    } else {
      stopLoop()
    }
  }

  function bind(el: Element): void {
    if (import.meta.server) return
    boundEl = el
    reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    el.addEventListener('pointerdown', onPointerDown as EventListener)
    el.addEventListener('pointermove', onPointerMove as EventListener)
    el.addEventListener('pointerup', onPointerUp as EventListener)
    el.addEventListener('pointercancel', onPointerUp as EventListener)

    observer = new IntersectionObserver((entries) => {
      inViewport = entries[0]?.isIntersecting ?? true
      if (inViewport) {
        startLoop()
      } else {
        stopLoop()
      }
    })
    observer.observe(el)
    document.addEventListener('visibilitychange', onVisibilityChange)

    startLoop()
  }

  onUnmounted(() => {
    disposed = true
    stopLoop()
    clearIdleTimer()
    if (boundEl) {
      boundEl.removeEventListener('pointerdown', onPointerDown as EventListener)
      boundEl.removeEventListener('pointermove', onPointerMove as EventListener)
      boundEl.removeEventListener('pointerup', onPointerUp as EventListener)
      boundEl.removeEventListener('pointercancel', onPointerUp as EventListener)
      boundEl = null
    }
    observer?.disconnect()
    observer = null
    if (import.meta.client) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  return {
    rotation,
    isDragging,
    lastDragDistance,
    hasInteracted,
    pause,
    resumeAfterIdle,
    rotateTo,
    bind
  }
}
