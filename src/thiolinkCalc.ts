// Pure ThioLink / conjugation-efficiency calculations.
// Extracted from src/pages/ThioLinkAnalysis.tsx so saved snapshots
// can be re-rendered (and verified) outside that page's React state.

export interface Component {
  id: string
  name: string
  oligoRatio: string // '0' for free protein, 'NA' for free oligo, '1','2',... for conjugates
  av: string         // A*V in mA*mL (used when inputMode === 'av')
  inputMode?: 'av' | 'cv' | 'mv'
  conc?: string      // mg/mL (cv)
  molarConc?: string // µM (mv)
  vol?: string       // µL (cv or mv)
}

export interface AnalysisData {
  correctionFactor: string
  pathLength: string
  proteinName: string
  proteinE280: string
  proteinE260: string
  proteinMW: string
  oligoName: string
  oligoE280: string
  oligoE260: string
  oligoMW: string
  controlComponents: Component[]
  testComponents: Component[]
}

export interface ComponentResult {
  n: number // nmol
  m: number // µg
  valid: boolean
}

export interface ConjDetail {
  name: string
  n: number
  m: number
  conjYield: number
  recYield: number
}

export interface YieldResult {
  conjugationYield: number
  recoveryYield: number
  oligoRemovalYield: number
  productYield: number
  conjDetails: ConjDetail[]
  nControlProtein: number
  mControlProtein: number
}

// Calculate epsilon for a component based on oligo ratio.
// Uses ε₂₆₀ × 0.5 as fallback for oligo if ε₂₈₀ not provided.
export function calcEpsilon(data: AnalysisData, oligoRatio: string): number {
  const pE = parseFloat(data.proteinE280) || 0
  const oE = parseFloat(data.oligoE280) || (parseFloat(data.oligoE260) || 0) * 0.5
  const ratio = parseFloat(oligoRatio)
  if (oligoRatio === 'NA') return oE
  if (isNaN(ratio) || ratio === 0) return pE
  return pE + ratio * oE
}

// Calculate molecular weight for a component based on oligo ratio.
export function calcMW(data: AnalysisData, oligoRatio: string): number {
  const pMW = parseFloat(data.proteinMW) || 0
  const oMW = parseFloat(data.oligoMW) || 0
  const ratio = parseFloat(oligoRatio)
  if (oligoRatio === 'NA') return oMW
  if (isNaN(ratio) || ratio === 0) return pMW
  return pMW + ratio * oMW
}

// Calculate moles (nmol) and mass (µg) for a component, using the
// component's own input mode (A×V, C+V, or M+V).
export function calcComponent(data: AnalysisData, comp: Component): ComponentResult {
  const mode = comp.inputMode || 'av'

  if (mode === 'cv') {
    // m(µg) = conc(mg/mL) × vol(µL); n(nmol) = m(µg) × 1000 / MW(Da)
    const conc = parseFloat(comp.conc || '') || 0
    const vol = parseFloat(comp.vol || '') || 0
    const mw = calcMW(data, comp.oligoRatio)
    if (conc === 0 || vol === 0 || mw === 0) return { n: 0, m: 0, valid: false }
    const mUg = conc * vol
    const nNmol = (mUg * 1000) / mw
    return { n: nNmol, m: mUg, valid: true }
  }

  if (mode === 'mv') {
    // n(nmol) = c(µM) × V(µL) / 1000; m(µg) = n(nmol) × MW(Da) / 1000
    const cUm = parseFloat(comp.molarConc || '') || 0
    const vol = parseFloat(comp.vol || '') || 0
    const mw = calcMW(data, comp.oligoRatio)
    if (cUm === 0 || vol === 0) return { n: 0, m: 0, valid: false }
    const nNmol = (cUm * vol) / 1000
    const mUg = mw > 0 ? (nNmol * mw) / 1e3 : 0
    return { n: nNmol, m: mUg, valid: true }
  }

  // A×V mode (default)
  const av = parseFloat(comp.av) || 0
  const eps = calcEpsilon(data, comp.oligoRatio)
  const l = parseFloat(data.pathLength) || 0.2
  if (av === 0 || eps === 0 || l === 0) return { n: 0, m: 0, valid: false }
  // n(nmol) = A*V(mA·mL) * 1e3 / (ε * l)
  const nNmol = (av * 1e3) / (eps * l)
  const mw = calcMW(data, comp.oligoRatio)
  const mUg = nNmol * mw / 1e3 // nmol * Da / 1e3 = µg
  return { n: nNmol, m: mUg, valid: true }
}

export function calcYields(data: AnalysisData): YieldResult {
  const controlProtein = data.controlComponents.find(c => c.oligoRatio === '0')
  const controlOligo = data.controlComponents.find(c => c.oligoRatio === 'NA')
  const testProtein = data.testComponents.find(c => c.oligoRatio === '0')
  const testOligo = data.testComponents.find(c => c.oligoRatio === 'NA')
  const conjugates = data.testComponents.filter(c => c.oligoRatio !== '0' && c.oligoRatio !== 'NA')

  const nControlProtein = controlProtein ? calcComponent(data, controlProtein).n : 0
  const mControlProtein = controlProtein ? calcComponent(data, controlProtein).m : 0
  const nControlOligo = controlOligo ? calcComponent(data, controlOligo).n : 0
  const nTestProtein = testProtein ? calcComponent(data, testProtein).n : 0
  const nTestOligo = testOligo ? calcComponent(data, testOligo).n : 0

  let totalConjN = 0
  const pMW = parseFloat(data.proteinMW) || 0
  const conjDetails: ConjDetail[] = []

  for (const conj of conjugates) {
    totalConjN += calcComponent(data, conj).n
  }

  const totalTestN = nTestProtein + totalConjN

  for (const conj of conjugates) {
    const r = calcComponent(data, conj)
    const proteinMassRecovered = r.n * pMW / 1e3
    conjDetails.push({
      name: conj.name,
      n: r.n,
      m: r.m,
      conjYield: totalTestN > 0 ? r.n / totalTestN : 0,
      recYield: mControlProtein > 0 ? proteinMassRecovered / mControlProtein : 0,
    })
  }

  const conjugationYield = totalTestN > 0 ? totalConjN / totalTestN : 0

  // Recovery yield: total recovered protein mass vs control input
  const totalRecoveredProteinM = totalTestN * pMW / 1e3
  const recoveryYield = mControlProtein > 0 ? totalRecoveredProteinM / mControlProtein : 0

  const oligoRemovalYield = nControlOligo > 0
    ? 1 - (nTestOligo / nControlOligo)
    : 0

  // Product yield: moles of 1:1 conjugate / moles of pre-conjugation protein
  const oneToOneConj = conjugates.find(c => c.oligoRatio === '1')
  const nOneToOne = oneToOneConj ? calcComponent(data, oneToOneConj).n : 0
  const productYield = nControlProtein > 0 ? nOneToOne / nControlProtein : 0

  return {
    conjugationYield,
    recoveryYield,
    oligoRemovalYield,
    productYield,
    conjDetails,
    nControlProtein,
    mControlProtein,
  }
}
