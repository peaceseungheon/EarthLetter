// QA — Iteration 8: useGlobeRotation pure-math parts (architecture § 6.2).
//
// Testable in node without DOM: initial rotation, rotateTo() φ-clamp and the
// hasInteracted gate. The internal clampPhi/inertia constants are NOT
// exported, so the inertia decay is re-implemented below as a drift-guard
// (same style as trending-spikeratio.spec.ts). The rAF frame loop, pointer
// handlers and the four auto-rotation stop conditions need a browser and are
// covered by the manual § 10 checklist instead.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGlobeRotation } from '~/composables/useGlobeRotation'

let warnSpy: { mockRestore: () => void }

beforeEach(() => {
  // useGlobeRotation registers onUnmounted(); outside a component instance
  // Vue only warns — irrelevant to these tests.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
})

describe('useGlobeRotation — initial rotation', () => {
  it('defaults to the deterministic SSR-safe [0, -15, 0] (§ 2-D9)', () => {
    const { rotation } = useGlobeRotation()
    expect(rotation.value).toEqual([0, -15, 0])
  })

  it('copies a caller-provided initial rotation (no shared mutable array)', () => {
    const initial: [number, number, number] = [120, -30, 0]
    const { rotation } = useGlobeRotation({ initialRotation: initial })
    expect(rotation.value).toEqual([120, -30, 0])
    expect(rotation.value).not.toBe(initial)
  })
})

describe('useGlobeRotation — rotateTo φ clamp (no pole flip)', () => {
  it('clamps φ to [-80, 80]', () => {
    const { rotation, rotateTo } = useGlobeRotation()
    rotateTo([10, -200, 0])
    expect(rotation.value).toEqual([10, -80, 0])
    rotateTo([10, 200, 0])
    expect(rotation.value).toEqual([10, 80, 0])
  })

  it('passes through φ inside the clamp range and forces γ to 0', () => {
    const { rotation, rotateTo } = useGlobeRotation()
    rotateTo([45, -40, 99])
    expect(rotation.value).toEqual([45, -40, 0])
  })

  it('becomes a no-op after the user has interacted (§ 9-3)', () => {
    const { rotation, rotateTo, pause, hasInteracted } = useGlobeRotation()
    pause() // hover/drag marks interaction
    expect(hasInteracted.value).toBe(true)
    rotateTo([90, 10, 0])
    expect(rotation.value).toEqual([0, -15, 0]) // unchanged
  })
})

describe('inertia decay model (drift guard — constants mirrored from § 6.2)', () => {
  const DRAG_SENSITIVITY = 0.25
  const INERTIA_DECAY = 0.95
  const INERTIA_STOP_DEG = 0.01

  function framesUntilStop(initialPxPerFrame: number): number {
    let v = initialPxPerFrame
    let frames = 0
    while (v * DRAG_SENSITIVITY >= INERTIA_STOP_DEG) {
      v *= INERTIA_DECAY
      frames += 1
      if (frames > 10_000) break // guard against non-termination
    }
    return frames
  }

  it('always terminates (decay < 1 guarantees the stop threshold is reached)', () => {
    expect(framesUntilStop(40)).toBeLessThan(10_000)
  })

  it('stops within ~2.5 s at 60 fps for a fast flick (40 px/frame)', () => {
    // ln(0.04/40)/ln(0.95) ≈ 135 frames ≈ 2.25 s
    const frames = framesUntilStop(40)
    expect(frames).toBeGreaterThan(0)
    expect(frames).toBeLessThanOrEqual(150)
  })

  it('a sub-threshold velocity never starts inertia (0 frames)', () => {
    expect(framesUntilStop(0.03)).toBe(0) // 0.03 px × 0.25 < 0.01°
  })
})
