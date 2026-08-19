// Client for the Lino Protein Registry — the lab's source of truth for reference
// reagent data (https://reagents.blue-kanyu.ts.net).
//
// The registry is tailnet-only and has no authentication: reaching it depends on the
// device being on Tailscale, not on the user logging in anywhere. That means this works
// from the Vercel build too, as long as Tailscale is on, and fails cleanly when it isn't.

const REGISTRY_URL = 'https://reagents.blue-kanyu.ts.net'
const TIMEOUT_MS = 6000

export interface RegistryProtein {
  id: string
  name: string
  vendor: string
  product_number: string
  epsilon_280: number | null
  epsilon_280_source: 'vendor' | 'computed' | 'measured' | 'unknown'
  mw_da: number | null
  verification_status: 'verified' | 'unverified'
}

// GET /api/proteins takes no query parameters — it always returns the whole catalog
// (~190 records, ~190 KB), so searching happens here and the list is fetched once.
let cache: RegistryProtein[] | null = null

export async function fetchRegistry(): Promise<RegistryProtein[]> {
  if (cache) return cache

  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${REGISTRY_URL}/api/proteins`, { signal: abort.signal })
    if (!response.ok) throw new Error(`Registry returned ${response.status}`)
    const body = await response.json()
    cache = (body.items ?? []) as RegistryProtein[]
    return cache
  } finally {
    clearTimeout(timer)
  }
}

/** Best matches first: exact name, then name prefix, then any substring. */
export function searchRegistry(items: RegistryProtein[], term: string): RegistryProtein[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return []

  const scored: { item: RegistryProtein; score: number }[] = []
  for (const item of items) {
    const name = item.name.toLowerCase()
    let score: number
    if (name === needle) score = 0
    else if (name.startsWith(needle)) score = 1
    else if (name.includes(needle)) score = 2
    else if (`${item.vendor} ${item.product_number}`.toLowerCase().includes(needle)) score = 3
    else continue
    scored.push({ item, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .map(entry => entry.item)
}

/** Absorbance of a 1 g/L solution — what the ε Library stores as ε(mg/mL). */
export function absorbanceAt1gPerL(protein: RegistryProtein): string {
  // Explicit null checks, not truthiness: the registry accepts ε₂₈₀ = 0 as a real
  // value (a protein with no Trp/Tyr/cystine does not absorb at 280 nm), and that
  // must not be silently treated as "no value recorded". MW is validated > 0.
  if (protein.epsilon_280 == null || protein.mw_da == null) return ''
  return (protein.epsilon_280 / protein.mw_da).toFixed(3)
}
