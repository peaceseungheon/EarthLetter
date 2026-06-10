<script setup lang="ts">
// Orthographic 3D globe (architecture § 6.5). Same props/emits contract as
// WorldMap.vue plus `autoRotate` / `initialRotation` / `focusCountryCode`,
// so the pages can swap the two components via MapModeToggle.
//
// SSR renders the first frame with a deterministic rotation (§ 2-D9);
// pointer listeners, auto-rotation and the hover preview all start in
// onMounted. Rotation math lives in useGlobeRotation, projection/path
// derivation in useGlobeProjection, preview fetching in useCountryPreview.

import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import type { CountryDTO } from '~/types/dto'
import { useGlobeProjection } from '~/composables/useGlobeProjection'
import type { GlobeShape } from '~/composables/useGlobeProjection'
import { useGlobeRotation } from '~/composables/useGlobeRotation'
import type { GlobeRotation } from '~/composables/useGlobeRotation'
import { useCountryPreview } from '~/composables/useCountryPreview'

interface Props {
  countries: CountryDTO[]
  /** countryCode → spikeRatio (%) for amber heatmap overlay. Optional. */
  trendingCountries?: Record<string, number>
  /** Viewport width in SVG units; kept responsive via width:100% in CSS. */
  width?: number
  /** Viewport height in SVG units. */
  height?: number
  /** Idle auto-rotation, 3°/s (default true; § 2-D3 stop conditions apply). */
  autoRotate?: boolean
  /** Deterministic initial [λ, φ, 0] — constants or SSR-derived only (§ 2-D9). */
  initialRotation?: GlobeRotation
  /**
   * Rotate this country to face front (trending page, § 2-D8). Applied in
   * setup when known (SSR-safe — same prop on both sides) and once more if
   * the value arrives after mount, but never after the user has interacted.
   */
  focusCountryCode?: string | null
}
const props = withDefaults(defineProps<Props>(), {
  width: 960,
  height: 500,
  trendingCountries: () => ({}),
  autoRotate: true,
  initialRotation: () => [0, -15, 0] as GlobeRotation,
  focusCountryCode: null
})

const emit = defineEmits<{
  'country-click': [payload: { code: string; name: string }]
}>()

const svgEl = ref<SVGSVGElement | null>(null)

const {
  rotation,
  isDragging,
  lastDragDistance,
  hasInteracted,
  pause,
  resumeAfterIdle,
  rotateTo,
  bind
} = useGlobeRotation({
  initialRotation: props.initialRotation,
  autoRotate: props.autoRotate
})

const {
  loaded,
  shapes,
  spherePath,
  graticulePath,
  availableCount,
  centroidOf,
  lonLatOf
} = await useGlobeProjection({
  width: props.width,
  height: props.height,
  rotation,
  countries: toRef(props, 'countries'),
  trendingCountries: toRef(props, 'trendingCountries')
})

// --- focus country (trending page) ------------------------------------
function rotationFacing(code: string): GlobeRotation | null {
  const lonLat = lonLatOf(code)
  if (!lonLat) return null
  return [-lonLat[0], Math.max(-80, Math.min(80, -lonLat[1])), 0]
}

// Deterministic at setup: server and client see the same prop value, so the
// SSR frame and the hydration frame match (§ 2-D9).
if (props.focusCountryCode) {
  const facing = rotationFacing(props.focusCountryCode)
  if (facing) rotation.value = facing
}

// Lazy-fetched trending data may only arrive after mount. Apply once,
// post-hydration, and only while the globe is still untouched (§ 9-3).
watch(
  () => props.focusCountryCode,
  (code) => {
    if (!code || hasInteracted.value) return
    const facing = rotationFacing(code)
    if (facing) rotateTo(facing)
  }
)

// --- hover / tap preview -----------------------------------------------
const {
  state: previewState,
  open: openPreview,
  openImmediate,
  close: closePreviewFetch
} = useCountryPreview()

const isCoarsePointer = ref(false)
const selectedCode = ref<string | null>(null) // coarse-pointer first tap
const popoverHovered = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

const previewCountryName = computed(() => {
  const code = previewState.value?.code
  if (!code) return ''
  return props.countries.find((c) => c.code === code)?.nameEn ?? code
})

function cancelScheduledClose(): void {
  if (closeTimer !== null) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function closePreview(): void {
  cancelScheduledClose()
  closePreviewFetch()
  selectedCode.value = null
  resumeAfterIdle()
}

// Small grace period so moving from the country onto the popover keeps it
// open (close condition = "neither country nor popover", § 6.4).
function scheduleClose(): void {
  cancelScheduledClose()
  closeTimer = setTimeout(() => {
    closeTimer = null
    if (!popoverHovered.value) closePreview()
  }, 150)
}

function onCountryEnter(shape: GlobeShape): void {
  if (
    isCoarsePointer.value ||
    isDragging.value ||
    !shape.clickable ||
    !shape.code
  ) {
    return
  }
  cancelScheduledClose()
  pause()
  openPreview(shape.code)
}

function onCountryLeave(): void {
  if (isCoarsePointer.value) return
  scheduleClose()
}

function onCountryFocus(shape: GlobeShape): void {
  if (!shape.clickable || !shape.code) return
  cancelScheduledClose()
  pause()
  openImmediate(shape.code)
}

function onCountryBlur(): void {
  scheduleClose()
}

/** Keyboard Enter/Space — always navigates (existing WorldMap behavior). */
function handleActivate(shape: GlobeShape): void {
  if (!shape.clickable || !shape.code) return
  emit('country-click', { code: shape.code, name: shape.name })
}

/** Pointer click — fine pointer navigates; coarse pointer uses the 2-tap model. */
function onCountryClick(shape: GlobeShape): void {
  if (lastDragDistance.value > 5) return // that was a drag, not a tap
  if (!shape.clickable || !shape.code) {
    if (isCoarsePointer.value) closePreview()
    return
  }
  if (isCoarsePointer.value && selectedCode.value !== shape.code) {
    // First tap: select + open preview, no navigation (§ 2-D6).
    selectedCode.value = shape.code
    pause()
    openImmediate(shape.code)
    return
  }
  emit('country-click', { code: shape.code, name: shape.name })
}

function onOceanClick(): void {
  if (lastDragDistance.value > 5) return
  closePreview()
}

// Dragging closes the popover and blocks hover processing (§ 2-D4/D5).
watch(isDragging, (dragging) => {
  if (dragging) closePreview()
})

// --- popover anchor + boundary flip (§ 2-D5) ----------------------------
const anchor = ref<{ xPct: number; yPct: number } | null>(null)
const placement = ref<'top' | 'bottom' | 'left' | 'right'>('top')

watch(
  () => previewState.value?.code,
  (code) => {
    if (!code) {
      anchor.value = null
      return
    }
    const c = centroidOf(code)
    if (!c) {
      // Back hemisphere (shouldn't happen for a hovered path) — bail out.
      closePreview()
      return
    }
    const xPct = (c.x / props.width) * 100
    const yPct = (c.y / props.height) * 100
    anchor.value = { xPct, yPct }
    placement.value = xPct > 60 ? 'left' : yPct < 35 ? 'bottom' : 'top'
  }
)

onMounted(() => {
  isCoarsePointer.value = window.matchMedia('(pointer: coarse)').matches
  if (svgEl.value) bind(svgEl.value)
})

// QA BUG-1: a pending closeTimer firing after route-away would call
// closePreview → resumeAfterIdle on a dead component. Clear it on unmount.
onUnmounted(cancelScheduledClose)
</script>

<template>
  <!-- QA BUG-2: Escape lives on the container so it also fires while focus
       is inside the popover (keydown bubbles up from any descendant). -->
  <div class="relative w-full" @keydown.escape="closePreview">
    <div
      v-if="!loaded"
      class="flex items-center justify-center rounded-lg border border-dashed border-black/10 bg-surface-muted p-8 text-sm text-ink-muted dark:border-white/10 dark:bg-surface-dark-muted dark:text-ink-dark-muted"
      role="status"
    >
      World map data is loading. If this persists, the
      <code class="mx-1 rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
        assets/geo/countries-110m.json
      </code>
      file may be missing — see project README for setup.
    </div>

    <template v-else>
      <div class="relative">
        <svg
          ref="svgEl"
          :viewBox="`0 0 ${props.width} ${props.height}`"
          role="img"
          aria-label="Interactive globe; drag to rotate, click a country to read news"
          class="block h-auto w-full touch-none select-none"
          :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
        >
          <!-- ocean -->
          <path
            :d="spherePath"
            class="fill-sky-100 dark:fill-[#1b2236]"
            @click="onOceanClick"
          />
          <!-- graticule -->
          <path
            :d="graticulePath"
            class="pointer-events-none fill-none stroke-black/10 dark:stroke-white/10"
            stroke-width="0.5"
            aria-hidden="true"
          />
          <!-- countries (front hemisphere only — back faces clip to d=null) -->
          <g>
            <path
              v-for="(shape, i) in shapes"
              :key="shape.code ?? `shape-${i}`"
              :d="shape.d"
              :data-code="shape.code ?? undefined"
              :style="{ fill: shape.fill }"
              :class="[
                'transition-colors',
                shape.clickable
                  ? 'path-available cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                  : 'opacity-70',
              ]"
              :tabindex="shape.clickable ? 0 : -1"
              :role="shape.clickable ? 'button' : 'presentation'"
              :aria-label="
                shape.clickable
                  ? `${shape.name} — view news`
                  : `${shape.name} — no feeds yet`
              "
              :aria-disabled="!shape.clickable"
              :aria-describedby="shape.clickable ? 'globe-preview' : undefined"
              stroke="var(--map-stroke)"
              stroke-width="0.5"
              @click="onCountryClick(shape)"
              @keydown.enter.prevent="handleActivate(shape)"
              @keydown.space.prevent="handleActivate(shape)"
              @pointerenter="onCountryEnter(shape)"
              @pointerleave="onCountryLeave"
              @focus="onCountryFocus(shape)"
              @blur="onCountryBlur"
            />
          </g>
          <!-- Amber heatmap overlay for trending countries, drawn above the
               country fills; pointer-events-none preserves click/hover. -->
          <g class="pointer-events-none" aria-hidden="true">
            <path
              v-for="shape in shapes.filter((s) => s.trendingIntensity > 0)"
              :key="`trend-${shape.code}`"
              :d="shape.d"
              :style="{ fill: `rgba(251,146,60,${(shape.trendingIntensity * 0.55).toFixed(2)})` }"
            />
          </g>
        </svg>

        <CountryPreviewPopover
          v-if="previewState && anchor"
          :country-code="previewState.code"
          :country-name="previewCountryName"
          :preview="previewState.data ?? null"
          :status="previewState.status"
          :anchor="anchor"
          :placement="placement"
          @pointerenter="popoverHovered = true; cancelScheduledClose()"
          @pointerleave="popoverHovered = false; scheduleClose()"
          @focusin="popoverHovered = true; cancelScheduledClose()"
          @focusout="popoverHovered = false; scheduleClose()"
        />
      </div>

      <!-- legend (WorldMap parity) -->
      <div
        class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted dark:text-ink-dark-muted"
        aria-hidden="true"
      >
        <div class="flex items-center gap-1.5">
          <span
            class="inline-block h-3 w-6 rounded-sm"
            style="background: linear-gradient(90deg, #4e79a7, #f28e2b, #59a14f, #e15759)"
          />
          <span>
            Available
            <span class="font-semibold text-ink dark:text-ink-dark">({{ availableCount }})</span>
            — hover for headlines, click to read
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-3 w-6 rounded-sm bg-[#c8dce8] opacity-70 dark:bg-[#c9e3e1]" />
          <span>No coverage yet</span>
        </div>
        <span class="text-ink-muted/80 dark:text-ink-dark-muted/80">
          Drag the globe to rotate
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.path-available {
  animation: map-beacon 3.5s ease-in-out infinite;
}

.path-available:hover {
  filter: brightness(1.18);
  opacity: 1;
}

@keyframes map-beacon {
  0%, 100% { filter: saturate(1) brightness(1); }
  50%       { filter: saturate(1.25) brightness(1.1); }
}

@media (prefers-reduced-motion: reduce) {
  svg path {
    transition: none !important;
    animation: none !important;
  }
}
</style>
