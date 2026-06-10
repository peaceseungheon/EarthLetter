// composables/useMapMode.ts
//
// 2D/3D map mode with localStorage persistence (architecture § 6.6).
// SSR always renders 'globe'; the stored preference is applied after mount
// (localStorage does not exist on the server). The post-mount swap is a plain
// component switch, so it cannot cause a hydration mismatch.

import { onMounted } from 'vue'
import type { Ref } from 'vue'

export type MapMode = 'globe' | 'flat'

const STORAGE_KEY = 'earthletter-map-mode'

export interface UseMapModeResult {
  mode: Ref<MapMode>
  setMode: (next: MapMode) => void
}

export function useMapMode(): UseMapModeResult {
  // Shared across pages within one app instance; default is always 'globe'.
  const mode = useState<MapMode>('earthletter-map-mode', () => 'globe')

  onMounted(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'globe' || stored === 'flat') mode.value = stored
    } catch {
      // Storage unavailable (private mode / blocked) — keep the default.
    }
  })

  function setMode(next: MapMode): void {
    mode.value = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persisting is best-effort; the in-memory mode still applies.
    }
  }

  return { mode, setMode }
}
