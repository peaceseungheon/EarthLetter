// composables/useCountryIdMap.ts
//
// world-atlas TopoJSON encodes each country with an ISO-3166 M49 numeric id
// (e.g. 840 → United States). Frontend everywhere else works with alpha-2
// codes ("US"). This table bridges the two.
//
// Countries absent from this table will render muted + non-clickable even if
// their feature appears on the map (architecture § 8.2). Expanding the table
// does not require a schema change — purely a client-side display concern.

export const NUMERIC_TO_ALPHA2: Readonly<Record<string, string>> = Object.freeze({
  // Launch set (must match prisma/seed.ts Country rows)
  '840': 'US', // United States
  '826': 'GB', // United Kingdom
  '156': 'CN', // China
  '643': 'RU', // Russian Federation
  '392': 'JP', // Japan
  '410': 'KR', // Republic of Korea
  '276': 'DE', // Germany
  '250': 'FR', // France
  '376': 'IL', // Israel
  '356': 'IN', // India

  // Major countries — rendered clickable once seeded; else muted.
  '036': 'AU', // Australia
  '076': 'BR', // Brazil
  '124': 'CA', // Canada
  '152': 'CL', // Chile
  '170': 'CO', // Colombia
  '192': 'CU', // Cuba
  '231': 'ET', // Ethiopia
  '300': 'GR', // Greece
  '344': 'HK', // Hong Kong
  '348': 'HU', // Hungary
  '360': 'ID', // Indonesia
  '364': 'IR', // Iran
  '368': 'IQ', // Iraq
  '372': 'IE', // Ireland
  '380': 'IT', // Italy
  '398': 'KZ', // Kazakhstan
  '400': 'JO', // Jordan
  '404': 'KE', // Kenya
  '408': 'KP', // DPRK (North Korea)
  '414': 'KW', // Kuwait
  '422': 'LB', // Lebanon
  '434': 'LY', // Libya
  '458': 'MY', // Malaysia
  '484': 'MX', // Mexico
  '504': 'MA', // Morocco
  '516': 'NA', // Namibia
  '528': 'NL', // Netherlands
  '554': 'NZ', // New Zealand
  '566': 'NG', // Nigeria
  '578': 'NO', // Norway
  '586': 'PK', // Pakistan
  '604': 'PE', // Peru
  '608': 'PH', // Philippines
  '616': 'PL', // Poland
  '620': 'PT', // Portugal
  '634': 'QA', // Qatar
  '642': 'RO', // Romania
  '682': 'SA', // Saudi Arabia
  '688': 'RS', // Serbia
  '702': 'SG', // Singapore
  '703': 'SK', // Slovakia
  '704': 'VN', // Viet Nam
  '710': 'ZA', // South Africa
  '716': 'ZW', // Zimbabwe
  '724': 'ES', // Spain
  '752': 'SE', // Sweden
  '756': 'CH', // Switzerland
  '760': 'SY', // Syria
  '764': 'TH', // Thailand
  '780': 'TT', // Trinidad and Tobago
  '784': 'AE', // United Arab Emirates
  '788': 'TN', // Tunisia
  '792': 'TR', // Türkiye
  '800': 'UG', // Uganda
  '804': 'UA', // Ukraine
  '818': 'EG', // Egypt
  '834': 'TZ', // Tanzania
  '858': 'UY', // Uruguay
  '862': 'VE', // Venezuela
  '894': 'ZM', // Zambia
  '012': 'DZ', // Algeria
  '024': 'AO', // Angola
  '032': 'AR', // Argentina
  '040': 'AT', // Austria
  '056': 'BE', // Belgium
  '104': 'MM', // Myanmar
  '112': 'BY', // Belarus
  '144': 'LK', // Sri Lanka
  '158': 'TW', // Taiwan
  '180': 'CD', // DR Congo
  '188': 'CR', // Costa Rica
  '203': 'CZ', // Czechia
  '208': 'DK', // Denmark
  '214': 'DO', // Dominican Republic
  '218': 'EC', // Ecuador
  '222': 'SV', // El Salvador
  '246': 'FI', // Finland
  '268': 'GE', // Georgia
  '288': 'GH', // Ghana
  '320': 'GT', // Guatemala
})

/**
 * Normalize numeric ids from world-atlas (some serializations strip leading
 * zeros, e.g. 12 vs "012"). Returns alpha-2 or `null` when unmapped.
 */
export function numericToAlpha2(rawId: number | string): string | null {
  const padded = String(rawId).padStart(3, '0')
  return NUMERIC_TO_ALPHA2[padded] ?? null
}

/**
 * Convenience hook returning the lookup function; exposed so consumers can
 * `const { alpha2 } = useCountryIdMap(); alpha2(d.id)`.
 */
export function useCountryIdMap() {
  return { alpha2: numericToAlpha2 }
}
