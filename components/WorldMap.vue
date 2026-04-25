<script setup lang="ts">
// See architecture § 8. SSR-rendered SVG world map; hydrates click/keyboard
// handlers only. The <CountrySelector> fallback is rendered by the parent
// page alongside this component (see pages/index.vue).

import { computed, ref, shallowRef } from 'vue'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties
} from 'geojson'
import type { Topology } from 'topojson-specification'
import type { CountryDTO } from '~/types/dto'
import { numericToAlpha2 } from '~/composables/useCountryIdMap'

interface Props {
  countries: CountryDTO[]
  /** Viewport width in SVG units; kept responsive via width:100% in CSS. */
  width?: number
  /** Viewport height in SVG units. */
  height?: number
}
const props = withDefaults(defineProps<Props>(), {
  width: 960,
  height: 500
})

const emit = defineEmits<{
  'country-click': [payload: { code: string; name: string }]
}>()

// Async top-level load — Nuxt SSR-friendly. The `~/assets/geo/countries-110m.json`
// file must be present (see _workspace/01_frontend_done.md for the copy step).
const topo = shallowRef<Topology | null>(null)
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('~/assets/geo/countries-110m.json')) as any
  topo.value = (mod.default ?? mod) as Topology
} catch {
  topo.value = null
}

// Distinct enough that adjacent countries rarely share a color
const ACTIVE_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac',
]
const MUTED_PALETTE = [
  '#c8dce8', '#fde4c5', '#f5cbcc', '#c9e3e1',
  '#c5e1c2', '#f9f0d0', '#e5d5e3', '#ffdee2',
  '#e2d4ce', '#ecebe8',
]

function pickColorIndex(code: string | null, fallbackIndex: number): number {
  if (!code) return fallbackIndex % ACTIVE_PALETTE.length
  let hash = 0
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return Math.abs(hash) % ACTIVE_PALETTE.length
}

interface MapShape {
  code: string | null
  name: string
  d: string
  clickable: boolean
  fill: string
}

const shapes = computed<MapShape[]>(() => {
  if (!topo.value) return []

  const countriesObj = topo.value.objects.countries
  if (!countriesObj) return []

  const fc = feature(topo.value, countriesObj) as FeatureCollection<
    Geometry,
    GeoJsonProperties
  >

  const projection = geoNaturalEarth1().fitSize(
    [props.width, props.height],
    fc
  )
  const path = geoPath(projection)

  const sourcesByCode = new Map(props.countries.map((c) => [c.code, c]))

  const out: MapShape[] = []
  for (const f of fc.features as Feature<Geometry, GeoJsonProperties>[]) {
    const code = numericToAlpha2(String(f.id ?? ''))
    const nameFromProps =
      (f.properties && typeof f.properties.name === 'string'
        ? (f.properties.name as string)
        : null) ?? code ?? 'Unknown'
    const name = code
      ? (sourcesByCode.get(code)?.nameEn ?? nameFromProps)
      : nameFromProps
    const d = path(f)
    if (!d) continue

    const country = code ? sourcesByCode.get(code) : undefined
    const clickable = Boolean(country?.hasSources)
    const ci = pickColorIndex(code, out.length)
    const fill = clickable
      ? (ACTIVE_PALETTE[ci] ?? ACTIVE_PALETTE[0]!)
      : (MUTED_PALETTE[ci] ?? MUTED_PALETTE[0]!)

    out.push({ code, name, d, clickable, fill })
  }
  return out
})

const availableCount = computed(() => shapes.value.filter((s) => s.clickable).length)

const hovered = ref<{ name: string; x: number; y: number } | null>(null)

function handleActivate(shape: MapShape) {
  if (!shape.clickable || !shape.code) return
  emit('country-click', { code: shape.code, name: shape.name })
}

function onMouseMove(shape: MapShape, e: MouseEvent) {
  hovered.value = { name: shape.name, x: e.clientX, y: e.clientY }
}

function onMouseLeave() {
  hovered.value = null
}
</script>

<template>
  <div class="relative w-full">
    <div
      v-if="!topo"
      class="flex items-center justify-center rounded-lg border border-dashed border-black/10 bg-surface-muted p-8 text-sm text-ink-muted dark:border-white/10 dark:bg-surface-dark-muted dark:text-ink-dark-muted"
      role="status"
    >
      World map data is loading. If this persists, the
      <code class="mx-1 rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">
        assets/geo/countries-110m.json
      </code>
      file may be missing — see project README for setup.
    </div>

    <svg
      v-else
      :viewBox="`0 0 ${props.width} ${props.height}`"
      role="img"
      aria-label="World map; click a country to read news"
      class="block h-auto w-full select-none"
    >
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
              : 'cursor-default opacity-70',
          ]"
          :tabindex="shape.clickable ? 0 : -1"
          :role="shape.clickable ? 'button' : 'presentation'"
          :aria-label="
            shape.clickable
              ? `${shape.name} — view news`
              : `${shape.name} — no feeds yet`
          "
          :aria-disabled="!shape.clickable"
          stroke="var(--map-stroke)"
          stroke-width="0.5"
          @click="handleActivate(shape)"
          @keydown.enter.prevent="handleActivate(shape)"
          @keydown.space.prevent="handleActivate(shape)"
          @mousemove="onMouseMove(shape, $event)"
          @mouseleave="onMouseLeave"
        />
      </g>
    </svg>

    <!-- legend -->
    <div
      v-if="topo"
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
          — click to read news
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="inline-block h-3 w-6 rounded-sm bg-[#c8dce8] opacity-70 dark:bg-[#c9e3e1]" />
        <span>No coverage yet</span>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hovered"
        class="pointer-events-none fixed z-50 rounded-md bg-black/80 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-ink"
        :style="{
          left: hovered.x + 12 + 'px',
          top: hovered.y + 12 + 'px',
        }"
        role="tooltip"
      >
        {{ hovered.name }}
      </div>
    </Teleport>
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

@media (pointer: coarse) {
  :deep([role='tooltip']) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  svg path {
    transition: none !important;
    animation: none !important;
  }
}
</style>
