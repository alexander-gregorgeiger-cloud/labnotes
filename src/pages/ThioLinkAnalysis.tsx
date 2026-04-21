import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Save, Download, RotateCcw, ChevronDown, ChevronUp, BookOpen, FolderOpen } from 'lucide-react'

interface Component {
  id: string
  name: string
  oligoRatio: string // '0' for free protein, 'NA' for free oligo, '1','2',... for conjugates
  av: string // A*V in mA*mL
}

interface SavedAnalysis {
  id: string
  title: string
  createdAt: Date
  data: AnalysisData
}

interface AnalysisData {
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

let nextId = 1
function makeId() { return `t${nextId++}` }

function newComponent(name: string, oligoRatio: string): Component {
  return { id: makeId(), name, oligoRatio, av: '' }
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

  // Calculate epsilon for a component based on oligo ratio
  function calcEpsilon(oligoRatio: string): number {
    const pE = parseFloat(proteinE280) || 0
    const oE = parseFloat(oligoE280) || 0
    const ratio = parseFloat(oligoRatio)
    if (oligoRatio === 'NA') return oE
    if (isNaN(ratio) || ratio === 0) return pE
    return pE + ratio * oE
  }

  // Calculate MW for a component
  function calcMW(oligoRatio: string): number {
    const pMW = parseFloat(proteinMW) || 0
    const oMW = parseFloat(oligoMW) || 0
    const ratio = parseFloat(oligoRatio)
    if (oligoRatio === 'NA') return oMW
    if (isNaN(ratio) || ratio === 0) return pMW
    return pMW + ratio * oMW
  }

  // Calculate n, c, m for a component
  function calcComponent(comp: Component) {
    const av = parseFloat(comp.av) || 0
    const eps = calcEpsilon(comp.oligoRatio)
    const l = parseFloat(pathLength) || 0.2
    if (av === 0 || eps === 0 || l === 0) return { n: 0, m: 0, valid: false }
    // A*V in mA·mL: 1 mA·mL = 1e-3 AU * 1e-3 L = 1e-6 AU·L
    // n(mol) = A*V(mA·mL) * 1e-6 / (ε * l)
    // n(nmol) = A*V(mA·mL) * 1e3 / (ε * l)
    const nNmol = (av * 1e3) / (eps * l)
    const mw = calcMW(comp.oligoRatio)
    const mUg = nNmol * mw / 1e3 // nmol * g/mol / 1e3 = µg
    return { n: nNmol, m: mUg, valid: true }
  }

  // Verify calculation matches spreadsheet:
  // Control Nb: A*V=80, eps=62015, l=0.2 → n = 80*1000/(62015*0.2) = 80000/12403 = 6.450 nmol ✓
  // Control Oligo: A*V=530, eps=138193.5, l=0.2 → n = 530000/27638.7 = 19.176 nmol ✓

  // Calculate yields
  function calcYields() {
    const controlProtein = controlComponents.find(c => c.oligoRatio === '0')
    const controlOligo = controlComponents.find(c => c.oligoRatio === 'NA')
    const testProtein = testComponents.find(c => c.oligoRatio === '0')
    const testOligo = testComponents.find(c => c.oligoRatio === 'NA')
    const conjugates = testComponents.filter(c => c.oligoRatio !== '0' && c.oligoRatio !== 'NA')

    const nControlProtein = controlProtein ? calcComponent(controlProtein).n : 0
    const mControlProtein = controlProtein ? calcComponent(controlProtein).m : 0
    const nControlOligo = controlOligo ? calcComponent(controlOligo).n : 0
    const nTestProtein = testProtein ? calcComponent(testProtein).n : 0
    const nTestOligo = testOligo ? calcComponent(testOligo).n : 0

    // Total conjugate moles
    let totalConjN = 0
    const pMW = parseFloat(proteinMW) || 0
    const conjDetails: { name: string; n: number; m: number; conjYield: number; recYield: number }[] = []

    for (const conj of conjugates) {
      const r = calcComponent(conj)
      totalConjN += r.n
    }

    const totalTestN = nTestProtein + totalConjN

    // Build per-conjugate details (needs totalTestN, so second pass)
    for (const conj of conjugates) {
      const r = calcComponent(conj)
      const proteinMassRecovered = r.n * pMW / 1e3
      conjDetails.push({
        name: conj.name,
        n: r.n,
        m: r.m,
        conjYield: totalTestN > 0 ? r.n / totalTestN : 0,
        recYield: mControlProtein > 0 ? proteinMassRecovered / mControlProtein : 0,
      })
    }

    // Conjugation yield: fraction of recovered protein moles that are conjugated
    const conjugationYield = totalTestN > 0 ? totalConjN / totalTestN : 0

    // Recovery yield: total recovered protein mass vs control input
    // Uses protein MW for all species (tracks original protein recovery)
    const totalRecoveredProteinM = totalTestN * pMW / 1e3
    const recoveryYield = mControlProtein > 0 ? totalRecoveredProteinM / mControlProtein : 0

    // Oligo removal yield: fraction of oligo removed
    const oligoRemovalYield = nControlOligo > 0
      ? 1 - (nTestOligo / nControlOligo)
      : 0

    return { conjugationYield, recoveryYield, oligoRemovalYield, conjDetails, nControlProtein, mControlProtein }
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

  function getAnalysisData(): AnalysisData {
    return {
      correctionFactor, pathLength,
      proteinName, proteinE280, proteinE260, proteinMW,
      oligoName, oligoE280, oligoE260, oligoMW,
      controlComponents, testComponents,
    }
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
    let csv = `ThioLink Conjugation Analysis\n`
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

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `thiolink_analysis_${new Date().toISOString().slice(0, 10)}.csv`
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
  const hasOligoDef = (parseFloat(oligoE280) || 0) > 0
  const hasDefinitions = hasProteinDef && hasOligoDef
  const hasControlData = controlComponents.some(c => parseFloat(c.av) > 0)
  const hasTestData = testComponents.some(c => parseFloat(c.av) > 0)
  const hasResults = hasControlData && hasTestData && hasDefinitions

  function InputField({ label, value, onChange, placeholder, unit }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; unit?: string
  }) {
    return (
      <div>
        <label className="text-xs text-slate-400">{label}</label>
        <div className="relative">
          <input
            type="number"
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

  function ComponentRow({ comp, onUpdate, onRemove, canRemove }: {
    comp: Component
    onUpdate: (field: keyof Component, value: string) => void
    onRemove?: () => void
    canRemove?: boolean
  }) {
    const r = calcComponent(comp)
    const eps = calcEpsilon(comp.oligoRatio)
    const mw = calcMW(comp.oligoRatio)
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
                type="number"
                value={comp.oligoRatio}
                onChange={e => onUpdate('oligoRatio', e.target.value)}
                className="w-12 px-1.5 py-0.5 text-xs border border-slate-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-primary-light"
                min="1"
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
            <label className="text-[10px] text-slate-400">A×V (mA·mL)</label>
            <input
              type="number"
              value={comp.av}
              onChange={e => onUpdate('av', e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400">ε (calc.)</label>
              <div className="px-2 py-1 bg-slate-50 rounded-lg text-sm text-slate-600 mt-0.5">
                {eps > 0 ? eps.toLocaleString('en-US') : '—'}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400">MW (calc.)</label>
              <div className="px-2 py-1 bg-slate-50 rounded-lg text-sm text-slate-600 mt-0.5">
                {mw > 0 ? mw.toLocaleString('en-US') : '—'}
              </div>
            </div>
          </div>
        </div>

        {r.valid && (
          <div className="bg-slate-50 rounded-lg p-2 grid grid-cols-2 gap-1">
            <ResultCell label="Moles" value={r.n.toFixed(3)} unit="nmol" />
            <ResultCell label="Mass" value={r.m.toFixed(1)} unit="µg" color="accent" />
          </div>
        )}
      </div>
    )
  }

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
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">ThioLink Analysis</h1>
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
          <InputField label="ε₂₆₀" value={proteinE260} onChange={setProteinE260} placeholder="" />
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
          <InputField label="ε₂₈₀" value={oligoE280} onChange={setOligoE280} placeholder="138194" />
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
          <div className="grid grid-cols-3 gap-3">
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
