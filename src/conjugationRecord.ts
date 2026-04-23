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
    e280Protein: 38000,
    e280Adapter: 171333,
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

export interface TubeData {
  adapterVariant: string  // name from ADAPTER_VARIANTS
  oligoId: string
  lotNumber: string       // <YYMMDD>-<ID>
  // Section 3.2 - Variable Input Materials
  proteinLot: string
  oligoLot: string
  // Section 4.1 - Protein Input
  inputConc: number | null      // mg/mL
  inputVolume: number | null    // mL
  // Section 4.3 - Recovery
  recoveredVolume: number | null // µL
  recoveryVisualCheck: 'clear' | 'turbid' | ''
  // Section 5 - Post-Exchange Quantification (3x NanoDrop)
  postExM1: number | null
  postExM2: number | null
  postExM3: number | null
  postExVolume: number | null   // µL (same as recoveredVolume usually)
  // Section 8 - AKTA Purification
  aktaTopUp: boolean
  aktaRunTime: string
  aktaResultFile: string
  aktaFractionsCollected: string
  aktaCollectedVolume: number | null // µL
  // Section 9.2 - Final Buffer Exchange Recovery
  finalRecoveredVolume: number | null // µL
  finalVisualCheck: 'clear' | 'turbid' | ''
  // Section 10 - Final Quantification (3x NanoDrop)
  finalM1: number | null
  finalM2: number | null
  finalM3: number | null
  finalVolume: number | null     // µL
  // Section 11 - Aliquoting
  aliquotCount: number | null
  aliquotLotNumber: string
  aliquotLabelsVerified: boolean
  // Section 12.1 - Yield
  yieldStatus: 'pass' | 'fail' | ''
  // Section 12.2 - SDS-PAGE
  sdsMwShift: boolean | null
  sdsFreeProteinUnder10: boolean | null
  sdsPurityStatus: 'pass' | 'fail' | ''
  // Section 12.3 - Functional QC
  qcImmobRatio: number | null
  qcActivityRatio: number | null
  qcKoff: number | null
  qcStatus: 'pass' | 'fail' | ''
  // Section 13 - Final Disposition
  coaReference: string
  disposition: 'release' | 'reject' | 'quarantine' | ''
}

export interface OligoReconstitution {
  oligoId: string
  tubeCount: number | null
  measuredNgUl: number | null
  // calculatedUm is derived: (measuredNgUl / 1000) / (MW_oligo_kDa)
  // For standard oligo MW ~6.8 kDa → µM = ng/µL / 6.8
}

export interface CommonMaterial {
  materialName: string
  internalId: string
  vendorLot: string
  verified: boolean
}

export interface ConjugationRecord {
  id: string
  name: string
  // Section 1 - Batch Identity
  dateStarted: string    // ISO date string
  dateFinished: string
  preparedBy: string
  // Section 2.3 - Acceptance Criteria (per variant)
  acceptanceCriteria: Record<string, { minYield: number | null; activity: number | null; koff: number | null }>
  // Section 3.1 - Common Reagents
  commonMaterials: CommonMaterial[]
  // Section 6.1 - Oligo Reconstitution
  oligoReconstitutions: OligoReconstitution[]
  // Section 7 - Process Execution
  activationStartTime: string
  conjugationStartTime: string
  conjugationEndTime: string
  // Section 8.1 - AKTA Setup
  aktaColumnPosition: string
  aktaMethodName: string
  // Section 12.2 - SDS-PAGE shared
  sdsExperimentRef: string
  sdsLoadAmount: string
  sdsStainStart: string
  sdsStainEnd: string
  // Section 12.3 - Functional QC shared
  qcExperimentRef: string
  // Section 13 - Deviations
  hasDeviations: boolean
  deviationNcrNumber: string
  // Section 13.3 - Release Authorization
  releaseOperatorName: string
  releaseOperatorDate: string
  releaseQcName: string
  releaseQcDate: string
  // Section 11.4 - Storage
  storageLocation: string
  calculatedExpiry: string
  // Custom adapters (user-defined, per record)
  customAdapters: CustomAdapterDef[]
  // Mixing ratio Protein : Linker : Oligo (protein is always 1)
  mixingRatioLinker: number   // default 2
  mixingRatioOligo: number    // default 2.5
  // Tubes (1-15)
  tubeCount: number
  tubes: TubeData[]
  // Procedure checklists (section 4, 6, 7, 8, 9)
  checklists: Record<string, boolean>
  // Section comments (for improvement notes)
  sectionComments: Record<string, string>
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
    proteinLot: '',
    oligoLot: '',
    inputConc: null,
    inputVolume: null,
    recoveredVolume: null,
    recoveryVisualCheck: '',
    postExM1: null,
    postExM2: null,
    postExM3: null,
    postExVolume: null,
    aktaTopUp: false,
    aktaRunTime: '',
    aktaResultFile: '',
    aktaFractionsCollected: '',
    aktaCollectedVolume: null,
    finalRecoveredVolume: null,
    finalVisualCheck: '',
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
    coaReference: '',
    disposition: '',
  }
}

export const DEFAULT_COMMON_MATERIALS: CommonMaterial[] = [
  { materialName: 'MeTz-PEG4-NHS Solution', internalId: 'SOL-001', vendorLot: '', verified: false },
  { materialName: 'PBS-T pH 7.4', internalId: 'SOL-002', vendorLot: '', verified: false },
  { materialName: 'Buffer A (AKTA)', internalId: 'SOL-003', vendorLot: '', verified: false },
  { materialName: 'Buffer B (AKTA)', internalId: 'SOL-004', vendorLot: '', verified: false },
  { materialName: '10K Amicon Filter (0.5 mL)', internalId: 'MAT-001', vendorLot: '', verified: false },
  { materialName: '10K Amicon Filter (2.0 mL)', internalId: 'MAT-002', vendorLot: '', verified: false },
]

export const CHECKLIST_ITEMS: Record<string, string> = {
  // Section 4.2 - Buffer Exchange
  'bufex_prewash': 'Pre-Wash: Add 500 µL PBS-T → Spin (14k rcf, 10 min) → Discard flow-through',
  'bufex_load': 'Load: Add Sample + PBS-T to 500 µL → Spin (14k rcf, 10 min) → Discard flow-through',
  'bufex_wash1': 'Wash 1: Add 450 µL PBS-T → Spin (14k rcf, 10 min) → Discard flow-through',
  'bufex_wash2': 'Wash 2: Add 450 µL PBS-T → Spin (14k rcf, 10 min) → Discard flow-through',
  'bufex_wash3': 'Wash 3: Add 450 µL PBS-T → Spin (14k rcf, 10 min) → Discard flow-through',
  'bufex_recovery': 'Recovery: Invert filter → Spin (1k rcf, 2 min) → Collect retentate',
  // Section 6.2 - Linker
  'linker_dilution': 'Dilution: Add 495 µL PBS-T to 5 µL MeTz-PEG4-NHS Solution (100 mM)',
  'linker_mixing': 'Mixing: Vortex briefly (≤ 3 sec)',
  // Section 7.1 - Activation
  'activation_addition': 'Addition: Add prescribed Linker Volume to each tube',
  'activation_mixing': 'Mixing: Mix gently by pipetting up and down (5x)',
  'activation_incubation': 'Incubation: 60 min, 25 ºC, 500 rpm',
  // Section 7.2 - Conjugation
  'conjugation_addition': 'Addition: Add prescribed Oligo Volume to each tube',
  'conjugation_mixing': 'Mixing: Mix gently by pipetting up and down (5x)',
  'conjugation_incubation': 'Incubation: 60 min, 25 ºC, 500 rpm',
  // Section 8.1 - AKTA Setup
  'akta_column': 'Column Verification: Resource Q in position',
  'akta_buffer_inspect': 'Buffer Inspection: Verify Buffer A and B are particle-free and clear',
  'akta_degas': 'Buffer Degassing: Degas Buffer A and Buffer B',
  'akta_wash': 'System Wash: Perform standard wash/prime routines',
  // Section 9.1 - Final Buffer Exchange
  'finbufex_prewash': 'Pre-Wash: Add 500 µL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_load': 'Load: Add Sample + PBS-T to 2 mL → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_wash1': 'Wash 1: Add 1.9 mL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_wash2': 'Wash 2: Add 1.9 mL PBS-T → Spin (7k rcf, 10 min) → Discard flow-through',
  'finbufex_recovery': 'Recovery: Invert filter → Spin (1k rcf, 2 min) → Collect retentate',
  // Section 11
  'aliquot_adjustment': 'Adjustment: Add calculated volume of PBS-T to each tube',
  'aliquot_mixing': 'Mixing: Mix gently by pipetting to ensure homogeneity',
  'aliquot_dispensing': 'Dispensing: Dispense each solution in 110 µL aliquots',
  'aliquot_inventory': 'Inventory: Register New Lots in eLabNext; decrement parent stocks',
  'aliquot_labeling': 'Labeling: Apply FLUICS Label to each tube per Policy',
  'aliquot_storage': 'Store: Tubes placed in -20°C Freezer',
  // Section 13.1
  'review_coa': 'Certificate of Analysis (CoA): Generated automatically via software',
  'review_documentation': 'Documentation: Complete (no empty fields, corrections initialed)',
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

export function calcInputMass(conc: number | null, volume: number | null): number | null {
  if (conc === null || volume === null) return null
  return conc * volume // mg/mL * mL = mg
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

export function calcOligoConcentrationUm(ngPerUl: number | null, mwKda: number): number | null {
  if (ngPerUl === null || mwKda === 0) return null
  return ngPerUl / mwKda // ng/µL / kDa ≈ µM
}

// Standard oligo MW for reconstitution QC (can be adjusted)
export const OLIGO_MW_KDA = 6.8

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
  oligoRatio: number
): { proteinAmount: number; linkerAmount: number; linkerVolume: number; oligoAmount: number; oligoVolume: number } {
  const proteinAmount = 1000 / mwProtein
  const linkerAmount  = proteinAmount * linkerRatio
  const linkerVolume  = linkerAmount               // µL (1 mM stock)
  const oligoAmount   = proteinAmount * oligoRatio
  const oligoVolume   = oligoAmount * 10           // µL (100 µM stock)
  return { proteinAmount, linkerAmount, linkerVolume, oligoAmount, oligoVolume }
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
