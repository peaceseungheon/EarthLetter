// composables/useGlobeProjection.ts
//
// Orthographic globe projection state for GlobeMap.vue (architecture § 6.1).
// Loads the world-atlas TopoJSON once, converts it to GeoJSON features
// (held immutably in a shallowRef) and derives per-frame SVG path strings
// from the caller-owned rotation ref. The color hash / palettes /
// numericToAlpha2 logic is ported verbatim from WorldMap.vue so both map
// modes stay visually consistent (§ 9-7: WorldMap.vue itself is untouched).

import { computed, shallowRef } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo'
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

/** Same structure as WorldMap.vue's MapShape (§ 6.1). */
export interface GlobeShape {
  code: string | null
  name: string
  d: string
  clickable: boolean
  fill: string
  trendingIntensity: number // 0 = not trending; 1 = max (≥500% spike)
}

export interface UseGlobeProjectionOptions {
  /** Viewport width in SVG units (static — matches WorldMap's prop model). */
  width: number
  /** Viewport height in SVG units. */
  height: number
  /** [λ, φ, γ] owned by useGlobeRotation; shapes re-derive when it changes. */
  rotation: Ref<[number, number, number]>
  countries: Ref<CountryDTO[]>
  trendingCountries: Ref<Record<string, number>>
}

export interface UseGlobeProjectionResult {
  /** false when the TopoJSON asset is missing (render fallback message). */
  loaded: ComputedRef<boolean>
  shapes: ComputedRef<GlobeShape[]>
  /** Ocean disc — path({ type: 'Sphere' }). */
  spherePath: ComputedRef<string>
  /** 10° graticule lines (visual polish). */
  graticulePath: ComputedRef<string>
  availableCount: ComputedRef<number>
  /** SVG-coordinate centroid for the popover anchor; null when on the back hemisphere. */
  centroidOf: (code: string) => { x: number; y: number } | null
  /** Spherical centroid [lon, lat] — used to derive a rotation facing a country. */
  lonLatOf: (code: string) => [number, number] | null
}

// Distinct enough that adjacent countries rarely share a color (WorldMap parity).
const ACTIVE_PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac'
]
const MUTED_PALETTE = [
  '#c8dce8', '#fde4c5', '#f5cbcc', '#c9e3e1',
  '#c5e1c2', '#f9f0d0', '#e5d5e3', '#ffdee2',
  '#e2d4ce', '#ecebe8'
]

const GLOBE_MARGIN = 10
const SPHERE = { type: 'Sphere' } as const
// Computed once at module scope — the graticule geometry never changes.
const GRATICULE_10 = geoGraticule10()

function pickColorIndex(code: string | null, fallbackIndex: number): number {
  if (!code) return fallbackIndex % ACTIVE_PALETTE.length
  let hash = 0
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  return Math.abs(hash) % ACTIVE_PALETTE.length
}

export async function useGlobeProjection(
  options: UseGlobeProjectionOptions
): Promise<UseGlobeProjectionResult> {
  const { width, height, rotation, countries, trendingCountries } = options

  type CountryFeature = Feature<Geometry, GeoJsonProperties>

  // Loaded + converted exactly once; features are treated as immutable.
  const features = shallowRef<CountryFeature[]>([])
  const featureByCode = new Map<string, CountryFeature>()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('~/assets/geo/countries-110m.json')) as any
    const topo = (mod.default ?? mod) as Topology
    const countriesObj = topo.objects.countries
    if (countriesObj) {
      const fc = feature(topo, countriesObj) as FeatureCollection<
        Geometry,
        GeoJsonProperties
      >
      features.value = fc.features
      for (const f of fc.features) {
        const code = numericToAlpha2(String(f.id ?? ''))
        if (code) featureByCode.set(code, f)
      }
    }
  } catch {
    features.value = []
  }

  const loaded = computed(() => features.value.length > 0)

  // Re-created per rotation change (cheap); the d3 projection object itself is
  // mutable, so deriving a fresh one keeps the reactive graph side-effect free.
  const projection = computed(() =>
    geoOrthographic()
      .scale(Math.min(width, height) / 2 - GLOBE_MARGIN)
      .translate([width / 2, height / 2])
      .rotate([rotation.value[0], rotation.value[1], rotation.value[2]])
  )
  const pathOf = computed(() => geoPath(projection.value))

  const shapes = computed<GlobeShape[]>(() => {
    if (features.value.length === 0) return []

    const path = pathOf.value
    const sourcesByCode = new Map(countries.value.map((c) => [c.code, c]))
    const trending = trendingCountries.value

    const out: GlobeShape[] = []
    for (const f of features.value) {
      const code = numericToAlpha2(String(f.id ?? ''))
      const nameFromProps =
        (f.properties && typeof f.properties.name === 'string'
          ? (f.properties.name as string)
          : null) ?? code ?? 'Unknown'
      const name = code
        ? (sourcesByCode.get(code)?.nameEn ?? nameFromProps)
        : nameFromProps
      // Back-hemisphere features are clipped by d3 → null/empty d → skipped.
      const d = path(f)
      if (!d) continue

      const country = code ? sourcesByCode.get(code) : undefined
      const clickable = Boolean(country?.hasSources)
      const ci = pickColorIndex(code, out.length)
      const fill = clickable
        ? (ACTIVE_PALETTE[ci] ?? ACTIVE_PALETTE[0]!)
        : (MUTED_PALETTE[ci] ?? MUTED_PALETTE[0]!)

      const trendingIntensity = code
        ? Math.min((trending[code] ?? 0) / 500, 1)
        : 0
      out.push({ code, name, d, clickable, fill, trendingIntensity })
    }
    return out
  })

  const availableCount = computed(
    () => shapes.value.filter((s) => s.clickable).length
  )

  const spherePath = computed(() => pathOf.value(SPHERE) ?? '')
  const graticulePath = computed(() => pathOf.value(GRATICULE_10) ?? '')

  function centroidOf(code: string): { x: number; y: number } | null {
    const f = featureByCode.get(code)
    if (!f) return null
    const path = pathOf.value
    // Fully clipped (back hemisphere) → no anchor.
    if (!path(f)) return null
    const [x, y] = path.centroid(f)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    return { x, y }
  }

  function lonLatOf(code: string): [number, number] | null {
    const f = featureByCode.get(code)
    if (!f) return null
    const [lon, lat] = geoCentroid(f)
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    return [lon, lat]
  }

  return {
    loaded,
    shapes,
    spherePath,
    graticulePath,
    availableCount,
    centroidOf,
    lonLatOf
  }
}
