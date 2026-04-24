// composables/useRelativeTime.ts
// ISO-8601 -> localized relative string ("3 hours ago").
// Uses Intl.RelativeTimeFormat; falls back to the original ISO string.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1]
]

export function useRelativeTime(iso: string, locale = 'en'): string {
  if (!iso) return ''
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const diffSec = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSec)
  const [unit, size] = UNITS.find(([, s]) => abs >= s) ?? ['second', 1]
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    return rtf.format(Math.round(diffSec / size), unit)
  } catch {
    return iso
  }
}
