import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Save, Download, RotateCcw, ChevronDown, ChevronUp, BookOpen, FolderOpen, FolderPlus } from 'lucide-react'
import {
  type Component,
  type AnalysisData,
  calcEpsilon as utilCalcEpsilon,
  calcMW as utilCalcMW,
  calcComponent as utilCalcComponent,
  calcYields as utilCalcYields,
} from '../thiolinkCalc'

// --- Standalone UI components (outside parent to prevent remounting on state change) ---

function InputField({ label, value, onChange, placeholder, unit }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; unit?: string
}) {
  return (
    <div>
      <label className="text-xs text-slate-400">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
        />
        {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-300 mt-0.5">{unit}</span>}
      </div>
    </div>
  )
}

function ResultCell({ label, value, unit, color = 'primary' }: {
  label: string; value: string; unit: string; color?: string
}) {
  const colorClass = color === 'accent' ? 'text-accent' : color === 'green' ? 'text-emerald-600' : 'text-primary'
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{unit}</div>
    </div>
  )
}

function ComponentRow({ comp, onUpdate, onRemove, canRemove, eps, mw, result }: {
  comp: Component
  onUpdate: (field: keyof Component, value: string) => void
  onRemove?: () => void
  canRemove?: boolean
  eps: number
  mw: number
  result: { n: number; m: number; valid: boolean }
}) {
  const isConjugate = comp.oligoRatio !== '0' && comp.oligoRatio !== 'NA'

  return (
    <div className="bg-white rounded-xl p-3 border border-slate-100">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          value={comp.name}
          onChange={e => onUpdate('name', e.target.value)}
          className="flex-1 text-sm font-medium text-slate-800 bg-transparent border-none focus:outline-none"
        />
        {isConjugate && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">ratio:</span>
            <input
              type="text"
              inputMode="numeric"
              value={comp.oligoRatio}
              onChange={e => onUpdate('oligoRatio', e.target.value)}
              className="w-12 px-1.5 py-0.5 text-xs border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary-light"
            />
          </div>
        )}
        {canRemove && onRemove && (
          <button onClick={onRemove} className="text-slate-300 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[10px] text-slate-400">
              {(() => {
                const m = comp.inputMode || 'av'
                if (m === 'cv') return 'Mass Conc + Vol'
                if (m === 'mv') return 'Molar Conc + Vol'
                return 'A×V (mA·mL)'
              })()}
            </label>
            <div className="flex rounded overflow-hidden border border-slate-200 text-[9px] font-medium">
              <button
                type="button"
                onClick={() => onUpdate('inputMode', 'av')}
                className={`px-1.5 py-0.5 transition-colors ${(comp.inputMode || 'av') === 'av' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >A×V</button>
              <button
                type="button"
                onClick={() => onUpdate('inputMode', 'cv')}
                className={`px-1.5 py-0.5 transition-colors border-l border-slate-200 ${comp.inputMode === 'cv' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >C+V</button>
              <button
                type="button"
                onClick={() => onUpdate('inputMode', 'mv')}
                className={`px-1.5 py-0.5 transition-colors border-l border-slate-200 ${comp.inputMode === 'mv' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >M+V</button>
            </div>
          </div>
          {(comp.inputMode || 'av') === 'cv' ? (
            <div className="grid grid-cols-2 gap-1">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={comp.conc || ''}
                  onChange={e => onUpdate('conc', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 pr-8 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 pointer-events-none">mg/mL</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={comp.vol || ''}
                  onChange={e => onUpdate('vol', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 pr-5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 pointer-events-none">µL</span>
              </div>
            </div>
          ) : comp.inputMode === 'mv' ? (
            <div className="grid grid-cols-2 gap-1">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={comp.molarConc || ''}
                  onChange={e => onUpdate('molarConc', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 pr-7 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 pointer-events-none">µM</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={comp.vol || ''}
                  onChange={e => onUpdate('vol', e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1 pr-5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 pointer-events-none">µL</span>
              </div>
            </div>
          ) : (
            <input
              type="text"
              inputMode="decimal"
              value={comp.av}
              onChange={e => onUpdate('av', e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          )}
        </div>
        <div className="flex items-end gap-2">
          {(comp.inputMode || 'av') === 'av' && (
            <div className="flex-1">
              <label className="text-[10px] text-slate-400">ε (calc.)</label>
              <div className="px-2 py-1 bg-slate-50 rounded-lg text-sm text-slate-600 mt-0.5">
                {eps > 0 ? eps.toLocaleString('en-US') : '—'}
              </div>
            </div>
          )}
          <div className="flex-1">
            <label className="text-[10px] text-slate-400">MW (calc.)</label>
            <div className="px-2 py-1 bg-slate-50 rounded-lg text-sm text-slate-600 mt-0.5">
              {mw > 0 ? mw.toLocaleString('en-US') : '—'}
            </div>
          </div>
        </div>
      </div>

      {result.valid && (
        <div className="bg-slate-50 rounded-lg p-2 grid grid-cols-2 gap-1">
          <ResultCell label="Moles" value={result.n.toFixed(3)} unit="nmol" />
          <ResultCell label="Mass" value={result.m.toFixed(1)} unit="µg" color="accent" />
        </div>
      )}
    </div>
  )
}

interface SavedAnalysis {
  id: string
  title: string
  createdAt: Date
  data: AnalysisData
}

let nextId = 1
function makeId() { return `t${nextId++}` }

function newComponent(name: string, oligoRatio: string): Component {
  return { id: makeId(), name, oligoRatio, av: '', inputMode: 'av', conc: '', molarConc: '', vol: '' }
}

export default function ThioLinkAnalysis() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Global params
  const [correctionFactor, setCorrectionFactor] = useState('1.55')
  const [pathLength, setPathLength] = useState('0.2')

  // Protein definition
  const [proteinName, setProteinName] = useState('Nb')
  const [proteinE280, setProteinE280] = useState('')
  const [proteinE260, setProteinE260] = useState('')
  const [proteinMW, setProteinMW] = useState('')

  // Oligo definition
  const [oligoName, setOligoName] = useState('')
  const [oligoE280, setOligoE280] = useState('')
  const [oligoE260, setOligoE260] = useState('')
  const [oligoMW, setOligoMW] = useState('')

  // Control section
  const [controlComponents, setControlComponents] = useState<Component[]>([
    newComponent('Protein', '0'),
    newComponent('Oligo', 'NA'),
  ])

  // Test section
  const [testComponents, setTestComponents] = useState<Component[]>([
    newComponent('Protein', '0'),
    newComponent('1:1 Conjugate', '1'),
    newComponent('Oligo', 'NA'),
  ])

  // UI state
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saved, setSaved] = useState(false)
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([])
  const [showLoadMenu, setShowLoadMenu] = useState(false)
  const [showEpsLibrary, setShowEpsLibrary] = useState(false)
  const [epsTarget, setEpsTarget] = useState<'protein' | 'oligo'>('protein')

  // Embed-to-project modal
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [embedTitle, setEmbedTitle] = useState('Conjugation Analysis')
  const [embedProjects, setEmbedProjects] = useState<{ id: string; name: string }[]>([])
  const [embedLoading, setEmbedLoading] = useState(false)
  const [embedSaving, setEmbedSaving] = useState(false)
  const [embedDone, setEmbedDone] = useState<string | null>(null)

  // Epsilon library
  interface EpsEntry { id: string; name: string; epsilon280: string; epsilon260: string; mw: string }
  const [epsLibrary, setEpsLibrary] = useState<EpsEntry[]>([])

  // Load saved analyses
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'thiolinkAnalyses'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setSavedAnalyses(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          title: data.title || 'Untitled',
          createdAt: data.createdAt?.toDate() || new Date(),
          data: data.analysisData || {},
        }
      }))
    })
    return unsub
  }, [user])

  // Load epsilon library
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'epsilonLibrary'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setEpsLibrary(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id, name: data.name,
          epsilon280: data.epsilon280 || '', epsilon260: data.epsilon260 || '',
          mw: data.mw || '',
        }
      }))
    })
    return unsub
  }, [user])

  // Build the AnalysisData snapshot from current state — used both by the
  // util-backed calc wrappers below and by save/embed actions further down.
  function getAnalysisData(): AnalysisData {
    return {
      correctionFactor, pathLength,
      proteinName, proteinE280, proteinE260, proteinMW,
      oligoName, oligoE280, oligoE260, oligoMW,
      controlComponents, testComponents,
    }
  }

  // Thin wrappers — delegate to the pure util in src/thiolinkCalc.ts.
  function calcEpsilon(oligoRatio: string): number {
    return utilCalcEpsilon(getAnalysisData(), oligoRatio)
  }
  function calcMW(oligoRatio: string): number {
    return utilCalcMW(getAnalysisData(), oligoRatio)
  }
  function calcComponent(comp: Component) {
    return utilCalcComponent(getAnalysisData(), comp)
  }
  function calcYields() {
    return utilCalcYields(getAnalysisData())
  }

  function updateComponent(
    setter: React.Dispatch<React.SetStateAction<Component[]>>,
    id: string,
    field: keyof Component,
    value: string
  ) {
    setter(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function addTestComponent() {
    const existingRatios = testComponents
      .filter(c => c.oligoRatio !== '0' && c.oligoRatio !== 'NA')
      .map(c => parseInt(c.oligoRatio) || 0)
    const nextRatio = existingRatios.length > 0 ? Math.max(...existingRatios) + 1 : 1
    const insertIdx = testComponents.findIndex(c => c.oligoRatio === 'NA')
    const newComp = newComponent(`1:${nextRatio} Conjugate`, String(nextRatio))
    setter(prev => {
      const copy = [...prev]
      if (insertIdx >= 0) copy.splice(insertIdx, 0, newComp)
      else copy.push(newComp)
      return copy
    })

    function setter(fn: (prev: Component[]) => Component[]) {
      setTestComponents(fn)
    }
  }

  function removeTestComponent(id: string) {
    setTestComponents(prev => {
      if (prev.length <= 2) return prev
      return prev.filter(c => c.id !== id)
    })
  }

  function loadAnalysis(analysis: SavedAnalysis) {
    const d = analysis.data
    if (d.correctionFactor) setCorrectionFactor(d.correctionFactor)
    if (d.pathLength) setPathLength(d.pathLength)
    if (d.proteinName) setProteinName(d.proteinName)
    if (d.proteinE280) setProteinE280(d.proteinE280)
    if (d.proteinE260) setProteinE260(d.proteinE260)
    if (d.proteinMW) setProteinMW(d.proteinMW)
    if (d.oligoName) setOligoName(d.oligoName)
    if (d.oligoE280) setOligoE280(d.oligoE280)
    if (d.oligoE260) setOligoE260(d.oligoE260)
    if (d.oligoMW) setOligoMW(d.oligoMW)
    if (d.controlComponents?.length) setControlComponents(d.controlComponents)
    if (d.testComponents?.length) setTestComponents(d.testComponents)
    setShowLoadMenu(false)
  }

  async function saveAnalysis() {
    if (!user || !saveTitle.trim()) return
    await addDoc(collection(firestore, 'users', user.uid, 'thiolinkAnalyses'), {
      title: saveTitle.trim(),
      createdAt: Timestamp.now(),
      analysisData: getAnalysisData(),
    })
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSaveModal(false); setSaveTitle('') }, 1500)
  }

  async function deleteAnalysis(id: string) {
    if (!user) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'thiolinkAnalyses', id))
  }

  async function openEmbedModal() {
    if (!user) return
    setShowEmbedModal(true)
    setEmbedDone(null)
    setEmbedLoading(true)
    try {
      const snap = await getDocs(
        query(collection(firestore, 'users', user.uid, 'projects'), orderBy('updatedAt', 'desc'))
      )
      setEmbedProjects(snap.docs.map(d => ({ id: d.id, name: d.data().name || 'Untitled' })))
    } finally {
      setEmbedLoading(false)
    }
  }

  async function embedToProject(projectId: string) {
    if (!user) return
    setEmbedSaving(true)
    try {
      const yields = calcYields()
      const now = Timestamp.now()
      await addDoc(collection(firestore, 'users', user.uid, 'projects', projectId, 'notes'), {
        content: '',
        type: 'thiolink',
        thiolinkData: {
          title: embedTitle.trim() || 'Conjugation Analysis',
          analysisData: getAnalysisData(),
          yields: {
            conjugationYield: yields.conjugationYield,
            recoveryYield: yields.recoveryYield,
            oligoRemovalYield: yields.oligoRemovalYield,
            productYield: yields.productYield,
          },
          capturedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      })
      const projectName = embedProjects.find(p => p.id === projectId)?.name || 'project'
      setEmbedDone(projectName)
      setTimeout(() => {
        setShowEmbedModal(false)
        setEmbedDone(null)
      }, 1500)
    } finally {
      setEmbedSaving(false)
    }
  }

  function resetAll() {
    setCorrectionFactor('1.55')
    setPathLength('0.2')
    setProteinName('Nb')
    setProteinE280(''); setProteinE260(''); setProteinMW('')
    setOligoName(''); setOligoE280(''); setOligoE260(''); setOligoMW('')
    nextId = 1
    setControlComponents([newComponent('Protein', '0'), newComponent('Oligo', 'NA')])
    setTestComponents([newComponent('Protein', '0'), newComponent('1:1 Conjugate', '1'), newComponent('Oligo', 'NA')])
  }

  function downloadCSV() {
    const yields = calcYields()
    let csv = `Conjugation Efficiency Analysis\n`
    csv += `Date,${new Date().toLocaleDateString()}\n`
    csv += `A280/A260 correction factor,${correctionFactor}\n`
    csv += `Path length (cm),${pathLength}\n\n`
    csv += `Protein,${proteinName},ε280=${proteinE280},ε260=${proteinE260},MW=${proteinMW}\n`
    csv += `Oligo,${oligoName},ε280=${oligoE280},ε260=${oligoE260},MW=${oligoMW}\n\n`
    csv += `Section,Component,Oligo-ratio,A*V (mA*mL),ε (1/M*cm),MW (g/mol),n (nmol),m (µg)\n`

    for (const c of controlComponents) {
      const r = calcComponent(c)
      csv += `Control,${c.name},${c.oligoRatio},${c.av},${calcEpsilon(c.oligoRatio).toFixed(0)},${calcMW(c.oligoRatio).toFixed(0)},${r.n.toFixed(3)},${r.m.toFixed(2)}\n`
    }
    for (const c of testComponents) {
      const r = calcComponent(c)
      csv += `Test,${c.name},${c.oligoRatio},${c.av},${calcEpsilon(c.oligoRatio).toFixed(0)},${calcMW(c.oligoRatio).toFixed(0)},${r.n.toFixed(3)},${r.m.toFixed(2)}\n`
    }
    csv += `\nConjugation Yield,${(yields.conjugationYield * 100).toFixed(1)}%\n`
    csv += `Recovery Yield,${(yields.recoveryYield * 100).toFixed(1)}%\n`
    csv += `Oligo Removal Yield,${(yields.oligoRemovalYield * 100).toFixed(1)}%\n`
    csv += `Product Yield (1:1),${(yields.productYield * 100).toFixed(1)}%\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conjugation_efficiency_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function useEpsEntry(entry: EpsEntry) {
    if (epsTarget === 'protein') {
      if (entry.epsilon280) setProteinE280(entry.epsilon280)
      if (entry.epsilon260) setProteinE260(entry.epsilon260)
      if (entry.mw) setProteinMW(entry.mw)
      setProteinName(entry.name)
    } else {
      if (entry.epsilon280) setOligoE280(entry.epsilon280)
      if (entry.epsilon260) setOligoE260(entry.epsilon260)
      if (entry.mw) setOligoMW(entry.mw)
      setOligoName(entry.name)
    }
    setShowEpsLibrary(false)
  }

  const yields = calcYields()
  const hasProteinDef = (parseFloat(proteinE280) || 0) > 0
  const hasOligoDef = (parseFloat(oligoE280) || 0) > 0 || (parseFloat(oligoE260) || 0) > 0
  const hasDefinitions = hasProteinDef && hasOligoDef
  const hasControlData = controlComponents.some(c => calcComponent(c).valid)
  const hasTestData = testComponents.some(c => calcComponent(c).valid)
  const hasResults = hasControlData && hasTestData && hasDefinitions

  // Auto-compute missing ε values
  const proteinE260Auto = (parseFloat(proteinE280) || 0) > 0 && !proteinE260
    ? String(Math.round((parseFloat(proteinE280) || 0) / (parseFloat(correctionFactor) || 1.55)))
    : ''
  const oligoE280Auto = (parseFloat(oligoE260) || 0) > 0 && !oligoE280
    ? String(Math.round((parseFloat(oligoE260) || 0) * 0.5))
    : ''

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={resetAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            title="Reset all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={downloadCSV}
            disabled={!hasResults}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={openEmbedModal}
            disabled={!hasResults}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-40"
            title="Embed snapshot in a project"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Conjugation Efficiency</h1>
      <p className="text-sm text-slate-500 mb-4">Post-conjugation analysis from SEC/absorbance data</p>

      {/* Load saved analysis */}
      {savedAnalyses.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowLoadMenu(!showLoadMenu)}
            className="w-full flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all"
          >
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-medium text-slate-900 text-sm">Saved Analyses</span>
              <p className="text-xs text-slate-400">{savedAnalyses.length} saved</p>
            </div>
            {showLoadMenu ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
          </button>
          {showLoadMenu && (
            <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {savedAnalyses.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                  <button
                    onClick={() => loadAnalysis(a)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-medium text-slate-800">{a.title}</div>
                    <div className="text-xs text-slate-400">{a.createdAt.toLocaleDateString()}</div>
                  </button>
                  <button
                    onClick={() => deleteAnalysis(a.id)}
                    className="text-slate-300 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Global Settings */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Global Settings</h2>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="A280/A260 correction" value={correctionFactor} onChange={setCorrectionFactor} placeholder="1.55" />
          <InputField label="Path length" value={pathLength} onChange={setPathLength} placeholder="0.2" unit="cm" />
        </div>
      </div>

      {/* Protein & Oligo Definitions */}
      <div className={`bg-white rounded-2xl p-4 shadow-sm border mb-4 ${!hasProteinDef && (hasControlData || hasTestData) ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide">Protein Definition</h2>
          <button
            onClick={() => { setEpsTarget('protein'); setShowEpsLibrary(true) }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
          >
            <BookOpen className="w-3.5 h-3.5" />
            ε Library
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-slate-400">Name</label>
            <input
              type="text"
              value={proteinName}
              onChange={e => setProteinName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <InputField label="ε₂₈₀" value={proteinE280} onChange={setProteinE280} placeholder="62015" />
          <InputField label="ε₂₆₀" value={proteinE260} onChange={setProteinE260} placeholder={proteinE260Auto ? `~${proteinE260Auto}` : ''} />
          <InputField label="MW" value={proteinMW} onChange={setProteinMW} placeholder="32500" unit="Da" />
        </div>
      </div>

      <div className={`bg-white rounded-2xl p-4 shadow-sm border mb-4 ${!hasOligoDef && (hasControlData || hasTestData) ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide">Oligo Definition</h2>
          <button
            onClick={() => { setEpsTarget('oligo'); setShowEpsLibrary(true) }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
          >
            <BookOpen className="w-3.5 h-3.5" />
            ε Library
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="text-xs text-slate-400">Name</label>
            <input
              type="text"
              value={oligoName}
              onChange={e => setOligoName(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <InputField label="ε₂₈₀" value={oligoE280} onChange={setOligoE280} placeholder={oligoE280Auto ? `~${oligoE280Auto}` : '138194'} />
          <InputField label="ε₂₆₀" value={oligoE260} onChange={setOligoE260} placeholder="" />
          <InputField label="MW" value={oligoMW} onChange={setOligoMW} placeholder="6487" unit="Da" />
        </div>
      </div>

      {/* Control Section */}
      <div className="mb-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 px-1">Control (Pre-conjugation)</h2>
        <div className="space-y-2">
          {controlComponents.map(comp => (
            <ComponentRow
              key={comp.id}
              comp={comp}
              eps={calcEpsilon(comp.oligoRatio)}
              mw={calcMW(comp.oligoRatio)}
              result={calcComponent(comp)}
              onUpdate={(field, value) => updateComponent(setControlComponents, comp.id, field, value)}
            />
          ))}
        </div>
      </div>

      {/* Test Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Test (Post-conjugation)</h2>
          <button
            onClick={addTestComponent}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark"
          >
            <Plus className="w-3.5 h-3.5" />
            Add conjugate
          </button>
        </div>
        <div className="space-y-2">
          {testComponents.map(comp => {
            const isConjugate = comp.oligoRatio !== '0' && comp.oligoRatio !== 'NA'
            return (
              <ComponentRow
                key={comp.id}
                comp={comp}
                eps={calcEpsilon(comp.oligoRatio)}
                mw={calcMW(comp.oligoRatio)}
                result={calcComponent(comp)}
                onUpdate={(field, value) => updateComponent(setTestComponents, comp.id, field, value)}
                onRemove={isConjugate ? () => removeTestComponent(comp.id) : undefined}
                canRemove={isConjugate}
              />
            )
          })}
        </div>
      </div>

      {/* Warning when definitions are missing */}
      {(hasControlData || hasTestData) && !hasDefinitions && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <p className="text-sm text-amber-800 font-medium">Missing definitions</p>
          <p className="text-xs text-amber-600 mt-1">
            Fill in {!hasProteinDef && 'Protein ε₂₈₀'}{!hasProteinDef && !hasOligoDef && ' and '}{!hasOligoDef && 'Oligo ε₂₈₀'} above to calculate results.
          </p>
        </div>
      )}

      {/* Results Summary */}
      {hasResults && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-primary/20 mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Results Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center bg-blue-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Conjugation</div>
              <div className="text-xl font-bold text-primary">
                {(yields.conjugationYield * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">yield</div>
            </div>
            <div className="text-center bg-orange-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Recovery</div>
              <div className="text-xl font-bold text-accent">
                {(yields.recoveryYield * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">yield</div>
            </div>
            <div className="text-center bg-emerald-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Oligo Removal</div>
              <div className="text-xl font-bold text-emerald-600">
                {(yields.oligoRemovalYield * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">yield</div>
            </div>
            <div className="text-center bg-purple-50 rounded-xl p-3">
              <div className="text-xs text-slate-500 mb-1">Product (1:1)</div>
              <div className="text-xl font-bold text-purple-700">
                {(yields.productYield * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">n₁:₁ / n_protein</div>
            </div>
          </div>

          {/* Per-conjugate breakdown */}
          {yields.conjDetails.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-2">Per-conjugate breakdown</div>
              {yields.conjDetails.map((d, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-600">{d.name}</span>
                  <div className="flex gap-4 text-xs">
                    <span className="text-primary font-medium">{(d.conjYield * 100).toFixed(1)}% conj.</span>
                    <span className="text-accent font-medium">{(d.recYield * 100).toFixed(1)}% rec.</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Embed-to-Project Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !embedSaving && setShowEmbedModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {embedDone ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-sm text-slate-600">Added to <span className="font-medium">{embedDone}</span></p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Add to Project</h3>
                <p className="text-xs text-slate-400 mb-3">Embeds a snapshot of the current results into a project.</p>
                <label className="text-xs text-slate-500">Snapshot title</label>
                <input
                  type="text"
                  value={embedTitle}
                  onChange={e => setEmbedTitle(e.target.value)}
                  placeholder="Conjugation Analysis"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-3 mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <div className="text-xs text-slate-500 mb-2">Pick a project</div>
                {embedLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Loading projects...</p>
                ) : embedProjects.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No projects yet. Create one first.</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {embedProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => embedToProject(p.id)}
                        disabled={embedSaving}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all disabled:opacity-40"
                      >
                        <div className="text-sm font-medium text-slate-800">{p.name}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowEmbedModal(false)}
                  disabled={embedSaving}
                  className="w-full mt-3 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-40"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            {saved ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className="text-sm text-slate-600">Saved!</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-3">Save Analysis</h3>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={e => setSaveTitle(e.target.value)}
                  placeholder="Analysis name..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="flex-1 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAnalysis}
                    disabled={!saveTitle.trim()}
                    className="flex-1 py-2 text-sm text-white bg-primary rounded-xl hover:bg-primary-dark disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Epsilon Library Modal */}
      {showEpsLibrary && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowEpsLibrary(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-1">ε Library</h3>
            <p className="text-xs text-slate-400 mb-3">Select {epsTarget} values</p>
            {epsLibrary.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No entries yet. Add some in the ε Library page.</p>
            ) : (
              <div className="space-y-1">
                {epsLibrary.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => useEpsEntry(entry)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"
                  >
                    <div className="text-sm font-medium text-slate-800">{entry.name}</div>
                    <div className="text-xs text-slate-400">
                      ε₂₈₀={entry.epsilon280 || '—'} · ε₂₆₀={entry.epsilon260 || '—'} · MW={entry.mw || '—'}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowEpsLibrary(false)}
              className="w-full mt-3 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
