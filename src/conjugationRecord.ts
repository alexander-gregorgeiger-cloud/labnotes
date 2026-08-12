// Conjugation Record types and constants
// Based on AP-REC-01 - FM ADAPTERS - Adapter Conjugation Record v1.0

// ── Adapter Library (fixed) ──────────────────────────────────────────

export interface AdapterVariant {
  name: string
  mwProtein: number   // kDa
  mwAdapter: number   // kDa
  e280Protein: number // M⁻¹cm⁻¹
  e280Adapter: number // M⁻¹cm⁻¹
  // Pre-calculated for 1 mg input
  proteinAmount: number // nmol
  linkerAmount: number  // nmol
  linkerVolume: number  // µL
  oligoAmount: number   // nmol
  oligoVolume: number   // µL
}

export const ADAPTER_VARIANTS: AdapterVariant[] = [
  {
    name: 'Neutravidin',
    mwProtein: 60.0,
    mwAdapter: 66.8,
    e280Protein: 99600,
    e280Adapter: 232933,
    proteinAmount: 16.7,
    linkerAmount: 33.4,
    linkerVolume: 33.4,
    oligoAmount: 41.8,
    oligoVolume: 418,
  },
  {
    name: 'Protein A/G',
    mwProtein: 47.7,
    mwAdapter: 54.5,
    e280Protein: 27390,
    e280Adapter: 160723,
    proteinAmount: 21.0,
    linkerAmount: 42.0,
    linkerVolume: 42.0,
    oligoAmount: 52.5,
    oligoVolume: 525,
  },
  {
    name: 'Protein A/G/L',
    mwProtein: 89.2,
    mwAdapter: 96.0,
    e280Protein: 63150,
    e280Adapter: 196483,
    proteinAmount: 11.2,
    linkerAmount: 22.4,
    linkerVolume: 22.4,
    oligoAmount: 28.0,
    oligoVolume: 280,
  },
  {
    name: 'Strep-Tactin XT',
    mwProtein: 53.4,
    mwAdapter: 60.2,
    e280Protein: 152000,
    e280Adapter: 272000,
    proteinAmount: 18.7,
    linkerAmount: 37.4,
    linkerVolume: 37.4,
    oligoAmount: 46.8,
    oligoVolume: 468,
  },
]

// ── Custom Adapter Definition ────────────────────────────────────────

export interface CustomAdapterDef {
  name: string
  mwProtein: number    // kDa
  mwAdapter: number    // kDa
  e280Protein: number  // M⁻¹cm⁻¹
  e280Adapter: number  // M⁻¹cm⁻¹
}

// ── Record Data Structures ───────────────────────────────────────────

// ── AKTA Gradient Modes ──────────────────────────────────────────────

export type AktaGradientMode = '' | 'normal' | 'long' | 'slow' | 'custom'

export const AKTA_GRADIENT_MODES: { value: Exclude<AktaGradientMode, ''>; label: string }[] = [
  { value: 'normal', label: 'Normal gradient' },
  { value: 'long', label: 'Long gradient' },
  { value: 'slow', label: 'Slow gradient' },
  { value: 'custom', label: 'Custom' },
]

export interface TubeData {
  adapterVariant: string  // name from ADAPTER_VARIANTS
  oligoId: string
  lotNumber: string       // <YYMMDD>-<ID>
  // Section 4 - Input Quantification (3x NanoDrop)
  // Input mode: 'a280' → M1..M3 stored as A₂₈₀ units;
  // 'manual' → operator-entered concentration in postExManualConc (µM), M1..M3 ignored.
  // 'conc' is a legacy mode (mg/mL inputs in M1..M3) kept for backward-compat with existing records.
  postExInputMode?: 'conc' | 'a280' | 'manual'
  postExM1: number | null
  postExM2: number | null
  postExM3: number | null
  postExManualConc?: number | null  // µM — used only when postExInputMode === 'manual'
  postExVolume: number | null   // µL
  // Section 6 - AKTA Purification (per conjugation)
  aktaGradientMode: AktaGradientMode
  aktaGradientNotes: string     // free text, used with the 'custom' mode
  aktaTopUp: boolean
  aktaRunTime: string
  aktaResultFile: string
  aktaFractionsCollected: string
  aktaCollectedVolume: number | null // µL
  // Peak integral from the ÄKTA UV trace, used by the inline AUC calculator
  aktaAuc: number | null             // mAU·mL
  aktaAucPathLength: number | null   // cm (ÄKTA flow cell, typically 0.2)
  // Section 8 - Final Quantification (3x NanoDrop)
  // Input mode: 'conc' → M1..M3 stored as mg/mL; 'a280' → stored as A₂₈₀ units (uses ε/MW of the Adapter conjugate)
  finalInputMode?: 'conc' | 'a280'
  finalM1: number | null
  finalM2: number | null
  finalM3: number | null
  finalVolume: number | null     // µL
  // Section 10 - Aliquoting
  aliquotCount: number | null
  aliquotLotNumber: string
  aliquotLabelsVerified: boolean
  // Section 11.1 - Yield
  yieldStatus: 'pass' | 'fail' | ''
  // Section 11.2 - SDS-PAGE
  sdsMwShift: boolean | null
  sdsFreeProteinUnder10: boolean | null
  sdsPurityStatus: 'pass' | 'fail' | ''
  // Section 11.3 - Functional QC
  qcImmobRatio: number | null
  qcActivityRatio: number | null
  qcKoff: number | null
  qcStatus: 'pass' | 'fail' | ''
  // Identity verification by binding assay on the MatchMaker (Focal Molography)
  identityVerified: boolean
  identityLigand: string   // binding partner injected, e.g. Cetuximab, TNFα
  identityNotes: string
  // Section 12 - Final Disposition
  coaReference: string
  disposition: 'release' | 'reject' | 'quarantine' | ''
}

// ── Attachments (stored in the `attachments` subcollection of a record) ──

export type AttachmentKind = 'akta' | 'fm'

export interface RecordAttachment {
  id: string
  kind: AttachmentKind
  tubeIndex: number
  dataUrl: string   // JPEG data URL
  createdAt: Date
}

export const ATTACHMENT_LABELS: Record<AttachmentKind, string> = {
  akta: 'ÄKTA Chromatogram',
  fm: 'FM Sensogram',
}

/**
 * Binding partners routinely injected on the MatchMaker to confirm the identity
 * of a conjugated receptor. Offered as quick-picks in Section 10.3.
 */
export const IDENTITY_LIGAND_SUGGESTIONS = ['Cetuximab', 'TNFα', 'TGF-β1']

export interface ConjugationRecord {
  id: string
  name: string
  // Section 1 - Batch Identity
  dateStarted: string    // ISO date string
  dateFinished: string
  preparedBy: string
  // Section 3 - Buffer Exchange (performed yes/no)
  bufferExchangeDone: boolean
  // Section 5 - Process Execution
  activationStartTime: string
  conjugationStartTime: string
  conjugationEndTime: string
  // Section 6.1 - AKTA Setup
  aktaColumnPosition: string
  aktaMethodName: string
  // Section 10.2 - SDS-PAGE shared
  sdsExperimentRef: string
  sdsLoadAmount: string
  sdsStainStart: string
  sdsStainEnd: string
  // Section 10.3 - Functional QC shared
  qcExperimentRef: string
  // Section 11 - Deviations
  hasDeviations: boolean
  deviationNcrNumber: string
  // Section 11.3 - Release Authorization
  releaseOperatorName: string
  releaseOperatorDate: string
  releaseQcName: string
  releaseQcDate: string
  // Section 9.4 - Storage
  storageLocation: string
  calculatedExpiry: string
  // Custom adapters (user-defined, per record)
  customAdapters: CustomAdapterDef[]
  // Mixing ratio Protein : Linker : Oligo (protein is always 1)
  mixingRatioLinker: number   // default 2
  mixingRatioOligo: number    // default 2.5
  // Input mass per tube for pre-calculated volumes (mg, default 1)
  inputMassPerTube: number
  // Tubes (1-15)
  tubeCount: number
  tubes: TubeData[]
  // Procedure checklists (sections 5, 6, 7, 9, 11)
  checklists: Record<string, boolean>
  // Section comments (for improvement notes), keyed 's1'…'s11'
  sectionComments: Record<string, string>
  // See CURRENT_SCHEMA_VERSION. Absent/1 = original layout.
  schemaVersion?: number
  // Timestamps
  createdAt: Date
  updatedAt: Date
}

// ── Default Factory ──────────────────────────────────────────────────

export function createDefaultTube(): TubeData {
  return {
    adapterVariant: '',
    oligoId: '',
    lotNumber: '',
    postExInputMode: 'a280',
    postExM1: null,
    postExM2: null,
    postExM3: null,
    postExManualConc: null,
    postExVolume: null,
    aktaGradientMode: '',
    aktaGradientNotes: '',
    aktaTopUp: false,
    aktaRunTime: '',
    aktaResultFile: '',
    aktaFractionsCollected: '',
    aktaCollectedVolume: null,
    aktaAuc: null,
    aktaAucPathLength: AKTA_DEFAULT_PATH_LENGTH_CM,
    finalInputMode: 'conc',
    finalM1: null,
    finalM2: null,
    finalM3: null,
    finalVolume: null,
    aliquotCount: null,
    aliquotLotNumber: '',
    aliquotLabelsVerified: false,
    yieldStatus: '',
    sdsMwShift: null,
    sdsFreeProteinUnder10: null,
    sdsPurityStatus: '',
    qcImmobRatio: null,
    qcActivityRatio: null,
    qcKoff: null,
    qcStatus: '',
    identityVerified: false,
    identityLigand: '',
    identityNotes: '',
    coaReference: '',
    disposition: '',
  }
}

export const CHECKLIST_ITEMS: Record<string, string> = {
  // Section 5.1 - Activation
  'activation_addition': 'Addition: Add prescribed Linker Volume to each tube',
  'activation_mixing': 'Mixing: Mix gently by pipetting up and down (5x)',
  'activation_incubation': 'Incubation: 60 min, 25 ºC, 500 rpm',
  // Section 5.2 - Conjugation
  'conjugation_addition': 'Addition: Add prescribed Oligo Volume to each tube',
  'conjugation_mixing': 'Mixing: Mix gently by pipetting up and down (5x)',
  'conjugation_incubation': 'Incubation: 60 min, 25 ºC, 500 rpm',
  // Section 6.1 - AKTA Setup
  'akta_column': 'Column Verification: Resource Q in position',
  'akta_buffer_inspect': 'Buffer Inspection: Verify Buffer A and B are particle-free and clear',
  'akta_degas': 'Buffer Degassing: Degas Buffer A and Buffer B',
  'akta_wash': 'System Wash: Perform standard wash/prime routines',
  // Section 7.1 - Final Buffer Exchange
  'finbufex_prewash': 'Pre-Wash: Add 500 µL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_load': 'Load: Add Sample + PBS-T to 2 mL → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_wash1': 'Wash 1: Add 1.9 mL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_wash2': 'Wash 2: Add 1.9 mL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_recovery': 'Recovery: Invert filter → Spin (1k rcf, 2 min) → Collect retentate',
  // Section 9
  'aliquot_adjustment': 'Adjustment: Add calculated volume of PBS-T to each tube',
  'aliquot_mixing': 'Mixing: Mix gently by pipetting to ensure homogeneity',
  'aliquot_dispensing': 'Dispensing: Dispense each solution in 110 µL aliquots',
  'aliquot_inventory': 'Inventory: Register New Lots in eLabNext; decrement parent stocks',
  'aliquot_labeling': 'Labeling: Apply FLUICS Label to each tube per Policy',
  'aliquot_storage': 'Store: Tubes placed in -20°C Freezer',
  // Section 11.1
  'review_coa': 'Certificate of Analysis (CoA): Generated automatically via software',
  'review_documentation': 'Documentation: Complete (no empty fields, corrections initialed)',
}

// ── Schema Migration ─────────────────────────────────────────────────

export const CURRENT_SCHEMA_VERSION = 3

/** Section number that was deleted at each schema bump. */
const REMOVED_SECTION_BY_VERSION: Record<number, number> = {
  2: 3, // v1 → v2: "Materials Traceability" removed
  3: 5, // v2 → v3: "Reagent Preparation" removed
}

/**
 * Section comments are keyed by section number ('s1', 's2', …), so removing a
 * section shifts every later key up by one. Replays every bump between the
 * record's stored version and CURRENT_SCHEMA_VERSION; the comment belonging to
 * the deleted section is dropped.
 */
export function migrateSectionComments(
  old: Record<string, string> | undefined,
  fromVersion: number = 1
): Record<string, string> {
  let current = { ...(old || {}) }
  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    const removed = REMOVED_SECTION_BY_VERSION[v]
    if (removed === undefined) continue
    const next: Record<string, string> = {}
    for (const [key, value] of Object.entries(current)) {
      const num = parseInt(key.replace('s', ''), 10)
      if (isNaN(num) || num === removed) continue
      next[num < removed ? key : `s${num - 1}`] = value
    }
    current = next
  }
  return current
}

// ── Calculation Helpers ──────────────────────────────────────────────

export function median3(a: number | null, b: number | null, c: number | null): number | null {
  const vals = [a, b, c].filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  if (vals.length === 1) return vals[0]
  if (vals.length === 2) return (vals[0] + vals[1]) / 2
  vals.sort((x, y) => x - y)
  return vals[1]
}

export function calcTotalMassUg(concMgMl: number | null, volumeUl: number | null): number | null {
  if (concMgMl === null || volumeUl === null) return null
  return concMgMl * volumeUl // mg/mL * µL = µg
}

export function calcAmountNmol(massUg: number | null, mwKda: number | null): number | null {
  if (massUg === null || mwKda === null || mwKda === 0) return null
  return massUg / mwKda // µg / kDa = nmol
}

export function calcYieldPercent(startNmol: number | null, finalNmol: number | null): number | null {
  if (startNmol === null || finalNmol === null || startNmol === 0) return null
  return (finalNmol / startNmol) * 100
}

export function calcDilutionVolume(amountNmol: number | null, targetUm: number): { targetVolumeUl: number | null } {
  if (amountNmol === null) return { targetVolumeUl: null }
  const targetVolumeUl = (amountNmol * 1000) / targetUm
  return { targetVolumeUl }
}

// ── AKTA AUC Helpers ─────────────────────────────────────────────────

/** Default ÄKTA UV flow-cell path length. */
export const AKTA_DEFAULT_PATH_LENGTH_CM = 0.2

/**
 * Convert an ÄKTA peak integral to amount, mass and concentration.
 *
 * Beer–Lambert over the eluted peak with ε in M⁻¹·cm⁻¹ and AUC in mAU·mL:
 *   n (mol) = AUC / (ε × l × 10⁶)   →   n (nmol) = AUC × 10³ / (ε × l)
 * Mass follows from MW in kDa (1 nmol × 1 kDa = 1 µg), and the concentration
 * uses the volume actually collected off the fraction collector.
 */
export function calcAktaAuc(
  aucMauMl: number | null,
  e280: number | null,
  pathLengthCm: number | null,
  mwKda: number | null,
  collectedVolumeUl: number | null
): { amountNmol: number | null; massUg: number | null; concUm: number | null } {
  const l = pathLengthCm ?? AKTA_DEFAULT_PATH_LENGTH_CM
  if (aucMauMl === null || !e280 || !l) {
    return { amountNmol: null, massUg: null, concUm: null }
  }
  const amountNmol = (aucMauMl * 1e3) / (e280 * l)
  const massUg = mwKda ? amountNmol * mwKda : null
  const concUm = collectedVolumeUl ? (amountNmol / collectedVolumeUl) * 1000 : null
  return { amountNmol, massUg, concUm }
}

// ── Ratio-Aware Volume Helpers ───────────────────────────────────────

/**
 * Compute pre-calculated nmol / µL volumes for 1 mg protein input
 * at the given mixing ratios.
 *   linkerVolume: µL based on 1 mM (1 nmol/µL) linker stock
 *   oligoVolume:  µL based on 100 µM (0.1 nmol/µL) oligo stock
 */
export function calcVariantVolumes(
  mwProtein: number,
  linkerRatio: number,
  oligoRatio: number,
  inputMassMg: number = 1
): { proteinAmount: number; linkerAmount: number; linkerVolume: number; oligoAmount: number; oligoVolume: number } {
  const proteinAmount = (inputMassMg * 1000) / mwProtein
  const linkerAmount  = proteinAmount * linkerRatio
  const linkerVolume  = linkerAmount               // µL (1 mM stock)
  const oligoAmount   = proteinAmount * oligoRatio
  const oligoVolume   = oligoAmount * 10           // µL (100 µM stock)
  return { proteinAmount, linkerAmount, linkerVolume, oligoAmount, oligoVolume }
}

/**
 * Convert A₂₈₀ absorbance (1 cm path) to concentration in mg/mL using
 * Beer–Lambert: c (mol/L) = A / ε.  Then c (mg/mL) = c (M) × MW (g/mol),
 * which equals A × MW_kDa × 1000 / ε for ε in M⁻¹·cm⁻¹.
 */
export function a280ToMgPerMl(
  a280: number | null,
  mwKda: number,
  e280: number
): number | null {
  if (a280 === null || e280 === 0) return null
  return (a280 * mwKda * 1000) / e280
}

/**
 * Return the median post-exchange concentration in mg/mL, accounting for
 * whether the tube's measurements were entered as concentration or A₂₈₀.
 */
export function getPostExMedianMgPerMl(
  tube: {
    postExInputMode?: 'conc' | 'a280' | 'manual'
    postExM1: number | null
    postExM2: number | null
    postExM3: number | null
    postExManualConc?: number | null
  },
  variant?: { mwProtein: number; e280Protein: number } | null
): number | null {
  if (tube.postExInputMode === 'manual') {
    if (tube.postExManualConc == null) return null
    if (!variant) return null
    // Manual entry is in µM → convert to mg/mL via protein MW (kDa).
    // c[mg/mL] = c[µM] × MW[kDa] / 1000
    return (tube.postExManualConc * variant.mwProtein) / 1000
  }
  const med = median3(tube.postExM1, tube.postExM2, tube.postExM3)
  if (med === null) return null
  if (tube.postExInputMode === 'a280') {
    if (!variant) return null
    return a280ToMgPerMl(med, variant.mwProtein, variant.e280Protein)
  }
  return med
}

/**
 * Return the median final-quantification concentration in mg/mL,
 * accounting for whether the tube's measurements were entered as
 * concentration or as A₂₈₀. Conversion uses the conjugate (adapter)
 * extinction coefficient and MW, since after AKTA the species in the
 * tube is the protein–oligo conjugate.
 */
export function getFinalMedianMgPerMl(
  tube: {
    finalInputMode?: 'conc' | 'a280'
    finalM1: number | null
    finalM2: number | null
    finalM3: number | null
  },
  variant?: { mwAdapter: number; e280Adapter: number } | null
): number | null {
  const med = median3(tube.finalM1, tube.finalM2, tube.finalM3)
  if (med === null) return null
  if (tube.finalInputMode === 'a280') {
    if (!variant) return null
    return a280ToMgPerMl(med, variant.mwAdapter, variant.e280Adapter)
  }
  return med
}

/**
 * Returns all adapter variants for a record — built-in ADAPTER_VARIANTS
 * first, then any user-defined custom adapters (with volumes computed
 * from the record's current mixing ratios).
 */
export function getAllVariants(record: {
  customAdapters?: CustomAdapterDef[]
  mixingRatioLinker?: number
  mixingRatioOligo?: number
}): AdapterVariant[] {
  const lr = record.mixingRatioLinker ?? 2
  const or_ = record.mixingRatioOligo ?? 2.5
  const custom: AdapterVariant[] = (record.customAdapters || []).map(c => ({
    ...c,
    ...calcVariantVolumes(c.mwProtein, lr, or_),
  }))
  return [...ADAPTER_VARIANTS, ...custom]
}
