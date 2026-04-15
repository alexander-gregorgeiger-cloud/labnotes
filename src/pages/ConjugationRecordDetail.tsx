import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardList, Check, X, AlertTriangle, Download, MessageSquare } from 'lucide-react'
import { exportConjugationRecordPDF } from '../exportConjugationRecord'
import {
  ADAPTER_VARIANTS,
  CHECKLIST_ITEMS,
  DEFAULT_COMMON_MATERIALS,
  OLIGO_MW_KDA,
  median3,
  calcTotalMassUg,
  calcAmountNmol,
  calcYieldPercent,
  calcDilutionVolume,
  calcOligoConcentrationUm,
  type ConjugationRecord,
  type TubeData,
  type CommonMaterial,
  type OligoReconstitution,
  type AdapterVariant,
} from '../conjugationRecord'

// ── Helpers ──────────────────────────────────────────────────────────

function getVariant(name: string): AdapterVariant | undefined {
  return ADAPTER_VARIANTS.find(v => v.name === name)
}

// ── Section Wrapper ──────────────────────────────────────────────────

function Section({ num, title, children, defaultOpen = false, comment, onCommentChange }: {
  num: number; title: string; children: React.ReactNode; defaultOpen?: boolean
  comment?: string; onCommentChange?: (v: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [showComment, setShowComment] = useState(false)
  const hasComment = comment && comment.trim().length > 0
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">{num}</span>
        </div>
        <span className="font-semibold text-slate-900 flex-1">{title}</span>
        {hasComment && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        {open ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {children}
          {/* Comment toggle */}
          {onCommentChange && (
            <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
              <button
                onClick={() => setShowComment(!showComment)}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  hasComment ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {hasComment ? 'Comment' : 'Add comment'}
              </button>
              {(showComment || hasComment) && (
                <textarea
                  value={comment || ''}
                  onChange={e => onCommentChange(e.target.value)}
                  placeholder="Notes for improvement, issues, suggestions..."
                  rows={2}
                  className="mt-2 w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50/50 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-y placeholder:text-amber-300"
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Input Components ─────────────────────────────────────────────────

function TextInput({ label, value, onChange, placeholder, className }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
      />
    </div>
  )
}

function NumInput({ label, value, onChange, placeholder, unit, className }: {
  label?: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; unit?: string; className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>}
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="any"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent"
        />
        {unit && <span className="text-xs text-slate-400 whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  )
}

function CheckItem({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-2 py-1.5 cursor-pointer group">
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
        checked ? 'bg-primary border-primary' : 'border-slate-300 group-hover:border-primary-light'
      }`}>
        {checked && <Check className="w-3.5 h-3.5 text-white" />}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="hidden" />
      <span className={`text-sm ${checked ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{label}</span>
    </label>
  )
}

function CalcField({ label, value, unit }: { label: string; value: number | null | string; unit?: string }) {
  const display = value === null ? '—' : typeof value === 'number' ? value.toFixed(2) : value
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono">
        {display}{unit ? ` ${unit}` : ''}
      </div>
    </div>
  )
}

function PassFail({ value, onChange }: { value: string; onChange: (v: 'pass' | 'fail' | '') => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(value === 'pass' ? '' : 'pass')}
        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
          value === 'pass' ? 'bg-green-100 text-green-700 ring-2 ring-green-300' : 'bg-slate-100 text-slate-500 hover:bg-green-50'
        }`}
      >PASS</button>
      <button
        type="button"
        onClick={() => onChange(value === 'fail' ? '' : 'fail')}
        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
          value === 'fail' ? 'bg-red-100 text-red-700 ring-2 ring-red-300' : 'bg-slate-100 text-slate-500 hover:bg-red-50'
        }`}
      >FAIL</button>
    </div>
  )
}

function VisualCheck({ value, onChange }: { value: string; onChange: (v: 'clear' | 'turbid' | '') => void }) {
  return (
    <div className="flex gap-1">
      <button type="button" onClick={() => onChange(value === 'clear' ? '' : 'clear')}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          value === 'clear' ? 'bg-green-100 text-green-700 ring-2 ring-green-300' : 'bg-slate-100 text-slate-500'
        }`}>Clear</button>
      <button type="button" onClick={() => onChange(value === 'turbid' ? '' : 'turbid')}
        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
          value === 'turbid' ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' : 'bg-slate-100 text-slate-500'
        }`}>Turbid</button>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────

export default function ConjugationRecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [record, setRecord] = useState<ConjugationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load record
  useEffect(() => {
    if (!user || !id) return
    const ref = doc(firestore, 'users', user.uid, 'conjugationRecords', id)
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { navigate('/records'); return }
      const d = snap.data()
      setRecord({
        id: snap.id,
        ...d,
        createdAt: d.createdAt?.toDate() || new Date(),
        updatedAt: d.updatedAt?.toDate() || new Date(),
      } as ConjugationRecord)
      setLoading(false)
    })
    return unsub
  }, [user, id, navigate])

  // Save helper - debounced
  const save = useCallback(async (updates: Partial<ConjugationRecord>) => {
    if (!user || !id) return
    setSaving(true)
    try {
      const ref = doc(firestore, 'users', user.uid, 'conjugationRecords', id)
      await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() })
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }, [user, id])

  // Update a top-level field
  function updateField<K extends keyof ConjugationRecord>(key: K, value: ConjugationRecord[K]) {
    if (!record) return
    setRecord({ ...record, [key]: value })
    save({ [key]: value })
  }

  // Update a tube field
  function updateTube(index: number, field: keyof TubeData, value: TubeData[keyof TubeData]) {
    if (!record) return
    const tubes = [...record.tubes]
    tubes[index] = { ...tubes[index], [field]: value }
    setRecord({ ...record, tubes })
    save({ tubes })
  }

  // Update checklist
  function updateChecklist(key: string, value: boolean) {
    if (!record) return
    const checklists = { ...record.checklists, [key]: value }
    setRecord({ ...record, checklists })
    save({ checklists })
  }

  // Update section comment
  function updateComment(section: string, value: string) {
    if (!record) return
    const sectionComments = { ...(record.sectionComments || {}), [section]: value }
    setRecord({ ...record, sectionComments })
    save({ sectionComments })
  }

  // Update common material
  function updateMaterial(index: number, field: keyof CommonMaterial, value: string | boolean) {
    if (!record) return
    const commonMaterials = [...record.commonMaterials]
    commonMaterials[index] = { ...commonMaterials[index], [field]: value }
    setRecord({ ...record, commonMaterials })
    save({ commonMaterials })
  }

  // Update oligo reconstitution
  function updateOligo(index: number, field: keyof OligoReconstitution, value: string | number | null) {
    if (!record) return
    const oligoReconstitutions = [...record.oligoReconstitutions]
    oligoReconstitutions[index] = { ...oligoReconstitutions[index], [field]: value }
    setRecord({ ...record, oligoReconstitutions })
    save({ oligoReconstitutions })
  }

  function addOligo() {
    if (!record) return
    const oligoReconstitutions = [...record.oligoReconstitutions, { oligoId: '', tubeCount: null, measuredNgUl: null }]
    setRecord({ ...record, oligoReconstitutions })
    save({ oligoReconstitutions })
  }

  // Update acceptance criteria
  function updateAcceptance(variant: string, field: string, value: number | null) {
    if (!record) return
    const acceptanceCriteria = { ...record.acceptanceCriteria }
    acceptanceCriteria[variant] = { ...acceptanceCriteria[variant], [field]: value }
    setRecord({ ...record, acceptanceCriteria })
    save({ acceptanceCriteria })
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!record) return null
  const r = record

  // Tube labels
  const tubeNums = Array.from({ length: r.tubeCount }, (_, i) => i)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/records')}
          className="w-10 h-10 text-primary hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 truncate">{r.name}</h1>
          <p className="text-xs text-slate-400">
            AP-REC-01 · {r.tubeCount} tube{r.tubeCount !== 1 ? 's' : ''}
            {saving && ' · Saving...'}
          </p>
        </div>
        <button
          onClick={() => exportConjugationRecordPDF(r)}
          className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all shadow-lg"
          title="Download PDF"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* ── Section 1: Batch Identity ── */}
        <Section num={1} title="Batch Identity" defaultOpen comment={r.sectionComments?.['s1']} onCommentChange={v => updateComment('s1', v)}>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <TextInput label="Date Started" value={r.dateStarted} onChange={v => updateField('dateStarted', v)} placeholder="YYYY-MM-DD" />
            <TextInput label="Date Finished" value={r.dateFinished} onChange={v => updateField('dateFinished', v)} placeholder="YYYY-MM-DD" />
            <TextInput label="Prepared By" value={r.preparedBy} onChange={v => updateField('preparedBy', v)} placeholder="Name" className="col-span-2" />
          </div>
          {/* Tube assignment */}
          <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">Tube Assignment</h3>
          <div className="space-y-2">
            {tubeNums.map(i => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                <select
                  value={r.tubes[i]?.adapterVariant || ''}
                  onChange={e => updateTube(i, 'adapterVariant', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Select adapter...</option>
                  {ADAPTER_VARIANTS.map(v => (
                    <option key={v.name} value={v.name}>{v.name}</option>
                  ))}
                </select>
                <TextInput value={r.tubes[i]?.oligoId || ''} onChange={v => updateTube(i, 'oligoId', v)} placeholder="Oligo ID" className="w-24" />
                <TextInput value={r.tubes[i]?.lotNumber || ''} onChange={v => updateTube(i, 'lotNumber', v)} placeholder="Lot #" className="w-28" />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 2: Adapter Specifications ── */}
        <Section num={2} title="Adapter Specifications" comment={r.sectionComments?.['s2']} onCommentChange={v => updateComment('s2', v)}>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-2">Standard Input: 1 mg protein per tube. Ratio (Protein : Linker : Oligo) = 1 : 2 : 2.5</p>

            <h3 className="text-sm font-semibold text-slate-700 mb-2">2.1 Protein & Adapter Properties</h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-2 py-1.5 text-left rounded-tl-lg">Variant</th>
                    <th className="px-2 py-1.5 text-right">MW Prot</th>
                    <th className="px-2 py-1.5 text-right">MW Adapt</th>
                    <th className="px-2 py-1.5 text-right">ε Prot</th>
                    <th className="px-2 py-1.5 text-right rounded-tr-lg">ε Adapt</th>
                  </tr>
                </thead>
                <tbody>
                  {ADAPTER_VARIANTS.map(v => (
                    <tr key={v.name} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-medium">{v.name}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.mwProtein}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.mwAdapter}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.e280Protein.toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.e280Adapter.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">2.2 Pre-Calculated Volumes (1 mg input)</h3>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-2 py-1.5 text-left rounded-tl-lg">Variant</th>
                    <th className="px-2 py-1.5 text-right">Prot (nmol)</th>
                    <th className="px-2 py-1.5 text-right">Linker (µL)</th>
                    <th className="px-2 py-1.5 text-right">Oligo (nmol)</th>
                    <th className="px-2 py-1.5 text-right rounded-tr-lg">Oligo (µL)</th>
                  </tr>
                </thead>
                <tbody>
                  {ADAPTER_VARIANTS.map(v => (
                    <tr key={v.name} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 font-medium">{v.name}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.proteinAmount}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.linkerVolume}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.oligoAmount}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{v.oligoVolume}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">2.3 Acceptance Criteria</h3>
            {ADAPTER_VARIANTS.map(v => {
              const ac = r.acceptanceCriteria?.[v.name] || { minYield: null, activity: null, koff: null }
              return (
                <div key={v.name} className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-600 w-28 shrink-0">{v.name}</span>
                  <NumInput label="" value={ac.minYield} onChange={val => updateAcceptance(v.name, 'minYield', val)} placeholder="Min %" unit="% yield" />
                  <NumInput label="" value={ac.activity} onChange={val => updateAcceptance(v.name, 'activity', val)} placeholder="Activity" unit="%" />
                  <NumInput label="" value={ac.koff} onChange={val => updateAcceptance(v.name, 'koff', val)} placeholder="k_off" unit="s⁻¹" />
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 3: Materials Traceability ── */}
        <Section num={3} title="Materials Traceability" comment={r.sectionComments?.['s3']} onCommentChange={v => updateComment('s3', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">3.1 Common Reagents & Consumables</h3>
            {(r.commonMaterials || DEFAULT_COMMON_MATERIALS).map((m, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-600 w-44 shrink-0 truncate" title={m.materialName}>{m.materialName}</span>
                <span className="text-xs text-slate-400 w-16 shrink-0">{m.internalId}</span>
                <TextInput value={m.vendorLot} onChange={v => updateMaterial(i, 'vendorLot', v)} placeholder="Lot #" className="flex-1" />
                <CheckItem label="" checked={m.verified} onChange={v => updateMaterial(i, 'verified', v)} />
              </div>
            ))}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">3.2 Variable Input Materials</h3>
            {tubeNums.map(i => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                <TextInput value={r.tubes[i]?.proteinLot || ''} onChange={v => updateTube(i, 'proteinLot', v)} placeholder="Protein Lot #" className="flex-1" />
                <TextInput value={r.tubes[i]?.oligoLot || ''} onChange={v => updateTube(i, 'oligoLot', v)} placeholder="Oligo Lot #" className="flex-1" />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 4: Buffer Exchange ── */}
        <Section num={4} title="Buffer Exchange" comment={r.sectionComments?.['s4']} onCommentChange={v => updateComment('s4', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">4.1 Protein Input Parameters</h3>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              const inputMass = t.inputConc !== null && t.inputVolume !== null ? t.inputConc * t.inputVolume : null
              const inRange = inputMass !== null ? inputMass >= 0.9 && inputMass <= 1.1 : null
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                  <NumInput value={t.inputConc} onChange={v => updateTube(i, 'inputConc', v)} placeholder="Conc" unit="mg/mL" className="flex-1" />
                  <NumInput value={t.inputVolume} onChange={v => updateTube(i, 'inputVolume', v)} placeholder="Vol" unit="mL" className="flex-1" />
                  <CalcField label="" value={inputMass !== null ? `${inputMass.toFixed(2)} mg` : '—'} />
                  {inRange !== null && (
                    inRange
                      ? <Check className="w-4 h-4 text-green-500" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                </div>
              )
            })}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">4.2 Procedure</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
              <p className="text-xs text-amber-700 font-medium">⚠ Align all filters with Membrane Panel facing OUTWARDS</p>
            </div>
            {['bufex_prewash', 'bufex_load', 'bufex_wash1', 'bufex_wash2', 'bufex_wash3', 'bufex_recovery'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">4.3 Recovery Parameters</h3>
            {tubeNums.map(i => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                <NumInput value={r.tubes[i].recoveredVolume} onChange={v => updateTube(i, 'recoveredVolume', v)} placeholder="Vol" unit="µL" className="flex-1" />
                <VisualCheck value={r.tubes[i].recoveryVisualCheck} onChange={v => updateTube(i, 'recoveryVisualCheck', v)} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 5: Post-Exchange Quantification ── */}
        <Section num={5} title="Post-Exchange Quantification" comment={r.sectionComments?.['s5']} onCommentChange={v => updateComment('s5', v)}>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-3">Method: NanoDrop, Protein A280, Blank with PBS-T. 3 measurements per tube.</p>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              const variant = getVariant(t.adapterVariant)
              const medianConc = median3(t.postExM1, t.postExM2, t.postExM3)
              const vol = t.postExVolume ?? t.recoveredVolume
              const totalMass = calcTotalMassUg(medianConc, vol)
              const amount = variant ? calcAmountNmol(totalMass, variant.mwProtein) : null
              const massOk = totalMass !== null ? totalMass >= 900 : null
              return (
                <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{t.adapterVariant || `Tube ${i + 1}`}</span>
                    {massOk !== null && (massOk
                      ? <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">≥ 900 µg ✓</span>
                      : <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">&lt; 900 µg ✗</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <NumInput label="M1" value={t.postExM1} onChange={v => updateTube(i, 'postExM1', v)} unit="mg/mL" />
                    <NumInput label="M2" value={t.postExM2} onChange={v => updateTube(i, 'postExM2', v)} unit="mg/mL" />
                    <NumInput label="M3" value={t.postExM3} onChange={v => updateTube(i, 'postExM3', v)} unit="mg/mL" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <CalcField label="Median" value={medianConc} unit="mg/mL" />
                    <NumInput label="Volume" value={t.postExVolume} onChange={v => updateTube(i, 'postExVolume', v)} unit="µL" />
                    <CalcField label="Mass" value={totalMass} unit="µg" />
                    <CalcField label="Amount" value={amount} unit="nmol" />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 6: Reagent Preparation ── */}
        <Section num={6} title="Reagent Preparation" comment={r.sectionComments?.['s6']} onCommentChange={v => updateComment('s6', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">6.1 Oligo Reconstitution</h3>
            <p className="text-xs text-slate-500 mb-2">Add 100 µL PBS-T per lyophilised tube. QC: NanoDrop, ssDNA mode, Blank PBS-T.</p>
            {(r.oligoReconstitutions || []).map((oligo, i) => {
              const calcUm = calcOligoConcentrationUm(oligo.measuredNgUl, OLIGO_MW_KDA)
              const ok = calcUm !== null ? calcUm >= 95 : null
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <TextInput value={oligo.oligoId} onChange={v => updateOligo(i, 'oligoId', v)} placeholder="Oligo ID" className="w-24" />
                  <NumInput value={oligo.tubeCount} onChange={v => updateOligo(i, 'tubeCount', v)} placeholder="# Tubes" className="w-20" />
                  <NumInput value={oligo.measuredNgUl} onChange={v => updateOligo(i, 'measuredNgUl', v)} placeholder="ng/µL" unit="ng/µL" className="flex-1" />
                  <CalcField label="" value={calcUm} unit="µM" />
                  {ok !== null && (ok
                    ? <Check className="w-4 h-4 text-green-500" />
                    : <X className="w-4 h-4 text-red-500" />
                  )}
                </div>
              )
            })}
            <button onClick={addOligo} className="text-xs text-primary font-medium hover:underline mt-1">+ Add Oligo</button>

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">6.2 Linker Working Solution</h3>
            {['linker_dilution', 'linker_mixing'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
              <p className="text-xs text-red-700 font-medium">🔴 CRITICAL: Proceed to 7.1 Protein Activation immediately (within 2 min)</p>
            </div>
          </div>
        </Section>

        {/* ── Section 7: Process Execution ── */}
        <Section num={7} title="Process Execution" comment={r.sectionComments?.['s7']} onCommentChange={v => updateComment('s7', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">7.1 Protein Activation</h3>
            <TextInput label="Start Time" value={r.activationStartTime} onChange={v => updateField('activationStartTime', v)} placeholder="HH:MM" className="mb-2 w-32" />
            {['activation_addition', 'activation_mixing', 'activation_incubation'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">7.2 Oligo Conjugation</h3>
            <TextInput label="Start Time" value={r.conjugationStartTime} onChange={v => updateField('conjugationStartTime', v)} placeholder="HH:MM" className="mb-2 w-32" />
            {['conjugation_addition', 'conjugation_mixing', 'conjugation_incubation'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}
            <TextInput label="End Time" value={r.conjugationEndTime} onChange={v => updateField('conjugationEndTime', v)} placeholder="HH:MM" className="mt-2 w-32" />
          </div>
        </Section>

        {/* ── Section 8: AKTA Purification ── */}
        <Section num={8} title="AKTA Purification" comment={r.sectionComments?.['s8']} onCommentChange={v => updateComment('s8', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">8.1 System Setup & Verification</h3>
            {['akta_column', 'akta_buffer_inspect', 'akta_degas', 'akta_wash'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <TextInput label="Column Position" value={r.aktaColumnPosition} onChange={v => updateField('aktaColumnPosition', v)} />
              <TextInput label="Method Name" value={r.aktaMethodName} onChange={v => updateField('aktaMethodName', v)} />
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">8.2 Purification Runs</h3>
            {tubeNums.map(i => (
              <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm">{i + 1}</span>
                  <span className="text-sm font-medium text-slate-700">{r.tubes[i].adapterVariant || `Tube ${i + 1}`}</span>
                  <CheckItem label="Top-up" checked={r.tubes[i].aktaTopUp} onChange={v => updateTube(i, 'aktaTopUp', v)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <TextInput label="Run Time" value={r.tubes[i].aktaRunTime} onChange={v => updateTube(i, 'aktaRunTime', v)} />
                  <TextInput label="Result File" value={r.tubes[i].aktaResultFile} onChange={v => updateTube(i, 'aktaResultFile', v)} />
                  <TextInput label="Fractions" value={r.tubes[i].aktaFractionsCollected} onChange={v => updateTube(i, 'aktaFractionsCollected', v)} />
                  <NumInput label="Collected Vol" value={r.tubes[i].aktaCollectedVolume} onChange={v => updateTube(i, 'aktaCollectedVolume', v)} unit="µL" />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 9: Final Buffer Exchange ── */}
        <Section num={9} title="Final Buffer Exchange" comment={r.sectionComments?.['s9']} onCommentChange={v => updateComment('s9', v)}>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-2">Filter: 10K Amicon, 2.0 mL format. Centrifugation: 7k rcf.</p>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">9.1 Procedure</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
              <p className="text-xs text-amber-700 font-medium">⚠ Align 2.0 mL filters with Membrane Panel facing OUTWARDS</p>
            </div>
            {['finbufex_prewash', 'finbufex_load', 'finbufex_wash1', 'finbufex_wash2', 'finbufex_recovery'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">9.2 Recovery Parameters</h3>
            {tubeNums.map(i => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                <NumInput value={r.tubes[i].finalRecoveredVolume} onChange={v => updateTube(i, 'finalRecoveredVolume', v)} placeholder="Vol" unit="µL" className="flex-1" />
                <VisualCheck value={r.tubes[i].finalVisualCheck} onChange={v => updateTube(i, 'finalVisualCheck', v)} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 10: Final Quantification ── */}
        <Section num={10} title="Final Quantification" comment={r.sectionComments?.['s10']} onCommentChange={v => updateComment('s10', v)}>
          <div className="mt-3">
            <p className="text-xs text-slate-500 mb-3">Method: NanoDrop, Protein A280, Blank with PBS-T. Use ε₂₈₀ Adapter (not Protein).</p>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              const variant = getVariant(t.adapterVariant)
              const medianConc = median3(t.finalM1, t.finalM2, t.finalM3)
              const vol = t.finalVolume ?? t.finalRecoveredVolume
              const totalMass = calcTotalMassUg(medianConc, vol)
              const amount = variant ? calcAmountNmol(totalMass, variant.mwAdapter) : null
              return (
                <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{t.adapterVariant || `Tube ${i + 1}`}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <NumInput label="M1" value={t.finalM1} onChange={v => updateTube(i, 'finalM1', v)} unit="mg/mL" />
                    <NumInput label="M2" value={t.finalM2} onChange={v => updateTube(i, 'finalM2', v)} unit="mg/mL" />
                    <NumInput label="M3" value={t.finalM3} onChange={v => updateTube(i, 'finalM3', v)} unit="mg/mL" />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <CalcField label="Median" value={medianConc} unit="mg/mL" />
                    <NumInput label="Volume" value={t.finalVolume} onChange={v => updateTube(i, 'finalVolume', v)} unit="µL" />
                    <CalcField label="Mass" value={totalMass} unit="µg" />
                    <CalcField label="Amount" value={amount} unit="nmol" />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 11: Aliquoting & Storage ── */}
        <Section num={11} title="Aliquoting & Storage" comment={r.sectionComments?.['s11']} onCommentChange={v => updateComment('s11', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">11.1 Dilution to 2.6 µM</h3>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              const variant = getVariant(t.adapterVariant)
              const medianConc = median3(t.finalM1, t.finalM2, t.finalM3)
              const vol = t.finalVolume ?? t.finalRecoveredVolume
              const totalMass = calcTotalMassUg(medianConc, vol)
              const amount = variant ? calcAmountNmol(totalMass, variant.mwAdapter) : null
              const { targetVolumeUl } = calcDilutionVolume(amount, 2.6)
              const bufferToAdd = targetVolumeUl !== null && vol !== null ? targetVolumeUl - vol : null
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                  <CalcField label="Amount" value={amount} unit="nmol" />
                  <CalcField label="Target Vol" value={targetVolumeUl} unit="µL" />
                  <CalcField label="Buffer to Add" value={bufferToAdd !== null && bufferToAdd > 0 ? bufferToAdd : bufferToAdd !== null ? 0 : null} unit="µL" />
                </div>
              )
            })}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">11.2–11.3 Aliquoting & Inventory</h3>
            {['aliquot_adjustment', 'aliquot_mixing', 'aliquot_dispensing', 'aliquot_inventory', 'aliquot_labeling'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}
            {tubeNums.map(i => (
              <div key={i} className="flex items-center gap-2 mb-2 mt-2">
                <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                <NumInput label="# Aliquots" value={r.tubes[i].aliquotCount} onChange={v => updateTube(i, 'aliquotCount', v)} className="w-24" />
                <TextInput label="Lot # (eLabNext)" value={r.tubes[i].aliquotLotNumber} onChange={v => updateTube(i, 'aliquotLotNumber', v)} className="flex-1" />
                <CheckItem label="Labels ✓" checked={r.tubes[i].aliquotLabelsVerified} onChange={v => updateTube(i, 'aliquotLabelsVerified', v)} />
              </div>
            ))}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">11.4 Storage</h3>
            <CheckItem label={CHECKLIST_ITEMS['aliquot_storage']} checked={r.checklists?.['aliquot_storage'] || false} onChange={v => updateChecklist('aliquot_storage', v)} />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <TextInput label="Storage Location" value={r.storageLocation} onChange={v => updateField('storageLocation', v)} placeholder="-20°C Freezer, Location..." />
              <TextInput label="Calculated Expiry" value={r.calculatedExpiry} onChange={v => updateField('calculatedExpiry', v)} placeholder="Prep Date + 12 Months" />
            </div>
          </div>
        </Section>

        {/* ── Section 12: Quality Control ── */}
        <Section num={12} title="Quality Control" comment={r.sectionComments?.['s12']} onCommentChange={v => updateComment('s12', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">12.1 Yield Assessment</h3>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              const variant = getVariant(t.adapterVariant)
              // Start amount from Section 5
              const postMedian = median3(t.postExM1, t.postExM2, t.postExM3)
              const postVol = t.postExVolume ?? t.recoveredVolume
              const postMass = calcTotalMassUg(postMedian, postVol)
              const startAmount = variant ? calcAmountNmol(postMass, variant.mwProtein) : null
              // Final amount from Section 10
              const finalMedian = median3(t.finalM1, t.finalM2, t.finalM3)
              const finalVol = t.finalVolume ?? t.finalRecoveredVolume
              const finalMass = calcTotalMassUg(finalMedian, finalVol)
              const finalAmount = variant ? calcAmountNmol(finalMass, variant.mwAdapter) : null
              const yieldPct = calcYieldPercent(startAmount, finalAmount)
              const spec = r.acceptanceCriteria?.[t.adapterVariant]?.minYield
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-600 w-24 truncate">{t.adapterVariant || '—'}</span>
                  <CalcField label="" value={startAmount} unit="nmol" />
                  <span className="text-xs text-slate-400">→</span>
                  <CalcField label="" value={finalAmount} unit="nmol" />
                  <CalcField label="" value={yieldPct !== null ? `${yieldPct.toFixed(1)}%` : '—'} />
                  {spec && <span className="text-xs text-slate-400">≥ {spec}%</span>}
                  <PassFail value={t.yieldStatus} onChange={v => updateTube(i, 'yieldStatus', v)} />
                </div>
              )
            })}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">12.2 Purity & Identity (SDS-PAGE)</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <TextInput label="Experiment Ref" value={r.sdsExperimentRef} onChange={v => updateField('sdsExperimentRef', v)} />
              <TextInput label="Load Amount" value={r.sdsLoadAmount} onChange={v => updateField('sdsLoadAmount', v)} placeholder="µg per lane" />
              <TextInput label="Staining Start" value={r.sdsStainStart} onChange={v => updateField('sdsStainStart', v)} placeholder="HH:MM" />
              <TextInput label="Staining End" value={r.sdsStainEnd} onChange={v => updateField('sdsStainEnd', v)} placeholder="HH:MM" />
            </div>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-600 w-24 truncate">{t.adapterVariant || '—'}</span>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={t.sdsMwShift === true} onChange={e => updateTube(i, 'sdsMwShift', e.target.checked)} className="rounded" />
                    MW Shift
                  </label>
                  <label className="text-xs flex items-center gap-1">
                    <input type="checkbox" checked={t.sdsFreeProteinUnder10 === true} onChange={e => updateTube(i, 'sdsFreeProteinUnder10', e.target.checked)} className="rounded" />
                    Free &lt;10%
                  </label>
                  <PassFail value={t.sdsPurityStatus} onChange={v => updateTube(i, 'sdsPurityStatus', v)} />
                </div>
              )
            })}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">12.3 Functional QC (Focal Molography)</h3>
            <TextInput label="Experiment Ref" value={r.qcExperimentRef} onChange={v => updateField('qcExperimentRef', v)} className="mb-3" />
            {tubeNums.map(i => {
              const t = r.tubes[i]
              return (
                <div key={i} className="bg-slate-50 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{t.adapterVariant || `Tube ${i + 1}`}</span>
                    <div className="ml-auto"><PassFail value={t.qcStatus} onChange={v => updateTube(i, 'qcStatus', v)} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumInput label="Immob. Ratio" value={t.qcImmobRatio} onChange={v => updateTube(i, 'qcImmobRatio', v)} />
                    <NumInput label="Activity Ratio" value={t.qcActivityRatio} onChange={v => updateTube(i, 'qcActivityRatio', v)} />
                    <NumInput label="k_off (s⁻¹)" value={t.qcKoff} onChange={v => updateTube(i, 'qcKoff', v)} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── Section 13: Final Disposition ── */}
        <Section num={13} title="Final Disposition" comment={r.sectionComments?.['s13']} onCommentChange={v => updateComment('s13', v)}>
          <div className="mt-3">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">13.1 Batch Review</h3>
            {['review_coa', 'review_documentation'].map(key => (
              <CheckItem key={key} label={CHECKLIST_ITEMS[key]} checked={r.checklists?.[key] || false} onChange={v => updateChecklist(key, v)} />
            ))}
            <div className="flex items-center gap-3 mt-2 mb-3">
              <label className="text-sm text-slate-700 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={r.hasDeviations}
                  onChange={e => updateField('hasDeviations', e.target.checked)}
                  className="rounded"
                />
                Deviations?
              </label>
              {r.hasDeviations && (
                <TextInput value={r.deviationNcrNumber} onChange={v => updateField('deviationNcrNumber', v)} placeholder="NCR #" className="flex-1" />
              )}
            </div>

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">13.2 Final Decision</h3>
            {tubeNums.map(i => {
              const t = r.tubes[i]
              return (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-sm shrink-0">{i + 1}</span>
                  <span className="text-xs text-slate-600 w-24 truncate">{t.adapterVariant || '—'}</span>
                  <TextInput value={t.coaReference} onChange={v => updateTube(i, 'coaReference', v)} placeholder="CoA Ref" className="flex-1" />
                  <div className="flex gap-1">
                    {(['release', 'reject', 'quarantine'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateTube(i, 'disposition', t.disposition === d ? '' : d)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-all capitalize ${
                          t.disposition === d
                            ? d === 'release' ? 'bg-green-100 text-green-700 ring-2 ring-green-300'
                              : d === 'reject' ? 'bg-red-100 text-red-700 ring-2 ring-red-300'
                              : 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >{d}</button>
                    ))}
                  </div>
                </div>
              )
            })}

            <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">13.3 Release Authorization</h3>
            <div className="grid grid-cols-2 gap-2">
              <TextInput label="Operator Name" value={r.releaseOperatorName} onChange={v => updateField('releaseOperatorName', v)} />
              <TextInput label="Operator Date" value={r.releaseOperatorDate} onChange={v => updateField('releaseOperatorDate', v)} placeholder="YYYY-MM-DD" />
              <TextInput label="QC / QM Name" value={r.releaseQcName} onChange={v => updateField('releaseQcName', v)} />
              <TextInput label="QC / QM Date" value={r.releaseQcDate} onChange={v => updateField('releaseQcDate', v)} placeholder="YYYY-MM-DD" />
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
