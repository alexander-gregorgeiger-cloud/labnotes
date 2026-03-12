import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Copy, Save, Download, FlaskConical, Droplets, Atom } from 'lucide-react'
import type { Project } from '../db'

interface Construct {
  id: string
  name: string
  proteinConc: string
  proteinVol: string
  linkerConc: string
  oligoConc: string
}

let nextId = 1
function makeId() {
  return `c${nextId++}`
}

function newConstruct(name?: string): Construct {
  return {
    id: makeId(),
    name: name || `Construct ${nextId - 1}`,
    proteinConc: '',
    proteinVol: '',
    linkerConc: '',
    oligoConc: '',
  }
}

export default function ConjugationCalculator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [linkerExcess, setLinkerExcess] = useState('2')
  const [oligoExcess, setOligoExcess] = useState('3')
  const [defaultStock, setDefaultStock] = useState('100')
  const [targetVolume, setTargetVolume] = useState('510')
  const [constructs, setConstructs] = useState<Construct[]>([newConstruct()])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || '')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<'conjugation' | 'tools' | 'protein'>('conjugation')

  // Protein Calculator
  const [pAbs, setPAbs] = useState('')
  const [pEpsilon, setPEpsilon] = useState('')
  const [pMW, setPMW] = useState('')       // Da
  const [pPath, setPPath] = useState('1')  // cm
  const [pVol, setPVol] = useState('')     // mL

  // Mass → Concentration tool
  const [massMass, setMassMass] = useState('')
  const [massMW, setMassMW] = useState('')
  const [massVol, setMassVol] = useState('')

  // A280 → Concentration tool
  const [a280Abs, setA280Abs] = useState('')
  const [a280Ext, setA280Ext] = useState('')
  const [a280Path, setA280Path] = useState('1')
  const [a280MW, setA280MW] = useState('')

  // Dilution tool (C1V1 = C2V2)
  const [dilC1, setDilC1] = useState('')
  const [dilC2, setDilC2] = useState('')
  const [dilV2, setDilV2] = useState('')

  // Load projects for "Save to Project" picker
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'projects'),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        description: d.data().description || '',
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      })))
    })
    return unsub
  }, [user])

  function calc(c: Construct) {
    const pConc = parseFloat(c.proteinConc) || 0
    const pVol = parseFloat(c.proteinVol) || 0
    const lConc = parseFloat(c.linkerConc) || parseFloat(defaultStock) || 100
    const oConc = parseFloat(c.oligoConc) || parseFloat(defaultStock) || 100
    const lEx = parseFloat(linkerExcess) || 2
    const oEx = parseFloat(oligoExcess) || 3
    const target = parseFloat(targetVolume) || 510

    const n = pConc * pVol * 1e-3 // nmol
    const linkerV = pConc > 0 && pVol > 0 ? (n * lEx * 1000) / lConc : 0
    const oligoV = pConc > 0 && pVol > 0 ? (n * oEx * 1000) / oConc : 0
    const totalV = pVol + linkerV + oligoV
    const fillUp = target - totalV

    return { n, linkerV, oligoV, totalV, fillUp, valid: pConc > 0 && pVol > 0 }
  }

  function updateConstruct(id: string, field: keyof Construct, value: string) {
    setConstructs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  function addConstruct() {
    setConstructs(prev => [...prev, newConstruct()])
  }

  function removeConstruct(id: string) {
    if (constructs.length <= 1) return
    setConstructs(prev => prev.filter(c => c.id !== id))
  }

  function cloneConstruct(c: Construct) {
    const clone = { ...c, id: makeId(), name: `${c.name} (copy)` }
    setConstructs(prev => [...prev, clone])
  }

  function buildTableText(): string {
    const lEx = parseFloat(linkerExcess) || 2
    const oEx = parseFloat(oligoExcess) || 3
    const target = parseFloat(targetVolume) || 510

    let text = `Conjugation Calculator Results\n`
    text += `Linker excess: ${lEx}×  |  Oligo excess: ${oEx}×  |  Target volume: ${target} µL\n\n`

    const validConstructs = constructs.filter(c => calc(c).valid)
    let totalLinker = 0
    let totalFillUp = 0

    for (const c of validConstructs) {
      const r = calc(c)
      totalLinker += r.linkerV
      totalFillUp += r.fillUp

      text += `── ${c.name} ──\n`
      text += `Protein: ${c.proteinConc} µM × ${c.proteinVol} µL = ${r.n.toFixed(2)} nmol\n`
      text += `Linker (${lEx}×): ${r.linkerV.toFixed(1)} µL\n`
      text += `Oligo (${oEx}×): ${r.oligoV.toFixed(1)} µL\n`
      text += `Total: ${r.totalV.toFixed(1)} µL\n`
      text += `Fill-up: ${r.fillUp.toFixed(1)} µL\n\n`
    }

    text += `── Summary ──\n`
    text += `Total linker needed: ${totalLinker.toFixed(1)} µL\n`
    text += `Constructs: ${validConstructs.length}`

    return text
  }

  async function saveToProject() {
    if (!user || !selectedProjectId) return
    const now = Timestamp.now()
    const text = buildTableText()
    await addDoc(
      collection(firestore, 'users', user.uid, 'projects', selectedProjectId, 'notes'),
      { content: text, createdAt: now, updatedAt: now }
    )
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', selectedProjectId), { updatedAt: now })
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSaveModal(false) }, 1500)
  }

  function downloadCSV() {
    const lEx = parseFloat(linkerExcess) || 2
    const oEx = parseFloat(oligoExcess) || 3
    const target = parseFloat(targetVolume) || 510

    let csv = `Conjugation Calculator Export\n`
    csv += `Date,${new Date().toLocaleDateString()}\n`
    csv += `Linker excess,${lEx}x\n`
    csv += `Oligo excess,${oEx}x\n`
    csv += `Target volume,${target} µL\n\n`
    csv += `Construct,Protein c (µM),Protein V (µL),n (nmol),Linker V (µL),Oligo V (µL),Total V (µL),Fill-up (µL)\n`

    for (const c of constructs) {
      const r = calc(c)
      if (!r.valid) continue
      csv += `${c.name},${c.proteinConc},${c.proteinVol},${r.n.toFixed(2)},${r.linkerV.toFixed(1)},${r.oligoV.toFixed(1)},${r.totalV.toFixed(1)},${r.fillUp.toFixed(1)}\n`
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'conjugation_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = constructs.filter(c => calc(c).valid).length
  const totalLinker = constructs.reduce((sum, c) => sum + calc(c).linkerV, 0)

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
            onClick={downloadCSV}
            disabled={validCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={validCount === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            Save to Project
          </button>
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Conjugation Calculator</h1>
      <p className="text-sm text-slate-500 mb-4">Plan conjugation reactions and save results to your projects</p>

      {/* Tab Bar */}
      <div className="flex mb-4 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('conjugation')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'conjugation'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <FlaskConical className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Conjugation
        </button>
        <button
          onClick={() => setActiveTab('tools')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'tools'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Droplets className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Tools
        </button>
        <button
          onClick={() => setActiveTab('protein')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'protein'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Atom className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Protein
        </button>
      </div>

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <div className="space-y-4">
          {/* Mass → Concentration */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Mass → Concentration</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-xs text-slate-400">Mass (µg)</label>
                <input
                  type="number"
                  value={massMass}
                  onChange={e => setMassMass(e.target.value)}
                  placeholder="µg"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">MW (kDa)</label>
                <input
                  type="number"
                  value={massMW}
                  onChange={e => setMassMW(e.target.value)}
                  placeholder="kDa"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Volume (µL)</label>
                <input
                  type="number"
                  value={massVol}
                  onChange={e => setMassVol(e.target.value)}
                  placeholder="µL"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
            </div>
            {(() => {
              const mass = parseFloat(massMass) || 0
              const mw = parseFloat(massMW) || 0
              const vol = parseFloat(massVol) || 0
              if (mass > 0 && mw > 0 && vol > 0) {
                const molNmol = (mass / (mw * 1000)) * 1e3 // nmol
                const concUM = molNmol / vol * 1e3 // µM (nmol / µL * 1000 = µM)
                const concMgMl = mass / vol // µg/µL = mg/mL
                return (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div>
                        <div className="text-xs text-slate-400">Moles</div>
                        <div className="text-sm font-semibold text-primary">{molNmol.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">nmol</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Conc.</div>
                        <div className="text-sm font-semibold text-accent">{concUM.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">µM</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Conc.</div>
                        <div className="text-sm font-semibold text-accent">{concMgMl.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">mg/mL</div>
                      </div>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>

          {/* A280 → Concentration */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">A280 → Concentration</h2>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-slate-400">Absorbance (A280)</label>
                <input
                  type="number"
                  value={a280Abs}
                  onChange={e => setA280Abs(e.target.value)}
                  placeholder="A280"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.001"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">ε (M⁻¹cm⁻¹)</label>
                <input
                  type="number"
                  value={a280Ext}
                  onChange={e => setA280Ext(e.target.value)}
                  placeholder="Ext. coeff."
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Path length (cm)</label>
                <input
                  type="number"
                  value={a280Path}
                  onChange={e => setA280Path(e.target.value)}
                  placeholder="1"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">MW (kDa)</label>
                <input
                  type="number"
                  value={a280MW}
                  onChange={e => setA280MW(e.target.value)}
                  placeholder="kDa"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
            </div>
            {(() => {
              const abs = parseFloat(a280Abs) || 0
              const ext = parseFloat(a280Ext) || 0
              const path = parseFloat(a280Path) || 1
              const mw = parseFloat(a280MW) || 0
              if (abs > 0 && ext > 0) {
                // Beer-Lambert: A = ε * c * l → c = A / (ε * l) in M
                const concM = abs / (ext * path) // M
                const concUM = concM * 1e6 // µM
                const concMgMl = mw > 0 ? concM * mw * 1000 : 0 // M * kDa * 1000 = M * g/mol = g/L = mg/mL
                return (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className={`grid ${mw > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-1 text-center`}>
                      <div>
                        <div className="text-xs text-slate-400">Conc.</div>
                        <div className="text-sm font-semibold text-accent">{concUM.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">µM</div>
                      </div>
                      {mw > 0 && (
                        <div>
                          <div className="text-xs text-slate-400">Conc.</div>
                          <div className="text-sm font-semibold text-accent">{concMgMl.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-400">mg/mL</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>

          {/* Dilution Calculator (C1V1 = C2V2) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Dilution (C₁V₁ = C₂V₂)</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-xs text-slate-400">C₁ initial (µM)</label>
                <input
                  type="number"
                  value={dilC1}
                  onChange={e => setDilC1(e.target.value)}
                  placeholder="µM"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">C₂ target (µM)</label>
                <input
                  type="number"
                  value={dilC2}
                  onChange={e => setDilC2(e.target.value)}
                  placeholder="µM"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">V₂ final (µL)</label>
                <input
                  type="number"
                  value={dilV2}
                  onChange={e => setDilV2(e.target.value)}
                  placeholder="µL"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
            </div>
            {(() => {
              const c1 = parseFloat(dilC1) || 0
              const c2 = parseFloat(dilC2) || 0
              const v2 = parseFloat(dilV2) || 0
              if (c1 > 0 && c2 > 0 && v2 > 0 && c1 >= c2) {
                const v1 = (c2 * v2) / c1 // µL of stock needed
                const buffer = v2 - v1
                return (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="grid grid-cols-2 gap-1 text-center">
                      <div>
                        <div className="text-xs text-slate-400">Stock (V₁)</div>
                        <div className="text-sm font-semibold text-primary">{v1.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">µL</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Buffer</div>
                        <div className="text-sm font-semibold text-accent">{buffer.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">µL</div>
                      </div>
                    </div>
                  </div>
                )
              }
              if (c1 > 0 && c2 > 0 && c1 < c2) {
                return (
                  <div className="bg-red-50 rounded-xl p-3 text-center">
                    <p className="text-sm text-red-500">C₁ must be ≥ C₂</p>
                  </div>
                )
              }
              return null
            })()}
          </div>
        </div>
      )}

      {/* Protein Tab */}
      {activeTab === 'protein' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">A280 → Amount & Mass</h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-slate-400">Absorbance (A)</label>
                <input
                  type="number"
                  value={pAbs}
                  onChange={e => setPAbs(e.target.value)}
                  placeholder="A280"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.001"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">ε (M⁻¹cm⁻¹)</label>
                <input
                  type="number"
                  value={pEpsilon}
                  onChange={e => setPEpsilon(e.target.value)}
                  placeholder="Ext. coeff."
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-xs text-slate-400">MW (Da)</label>
                <input
                  type="number"
                  value={pMW}
                  onChange={e => setPMW(e.target.value)}
                  placeholder="Da"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Path (cm)</label>
                <input
                  type="number"
                  value={pPath}
                  onChange={e => setPPath(e.target.value)}
                  placeholder="1"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Volume (mL)</label>
                <input
                  type="number"
                  value={pVol}
                  onChange={e => setPVol(e.target.value)}
                  placeholder="mL"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.1"
                />
              </div>
            </div>
            {(() => {
              const abs = parseFloat(pAbs) || 0
              const eps = parseFloat(pEpsilon) || 0
              const path = parseFloat(pPath) || 1
              const mw = parseFloat(pMW) || 0
              const vol = parseFloat(pVol) || 0
              if (abs > 0 && eps > 0) {
                const cM = abs / (eps * path)
                const cUM = cM * 1e6
                const hasVol = vol > 0
                const hasMW = mw > 0
                const hasAll = hasVol && hasMW
                const nMol = hasVol ? cM * vol * 1e-3 : 0
                const nNmol = nMol * 1e9
                const mG = hasAll ? nMol * mw : 0
                const mUg = mG * 1e6
                return (
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Concentration</div>
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div>
                          <div className="text-sm font-bold text-accent">{cM.toExponential(3)}</div>
                          <div className="text-[10px] text-slate-400">M</div>
                        </div>
                        <div>
                          <div className="text-sm font-bold text-accent">{cUM.toFixed(2)}</div>
                          <div className="text-[10px] text-slate-400">µM</div>
                        </div>
                      </div>
                    </div>
                    {hasVol && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Amount</div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div>
                            <div className="text-sm font-bold text-primary">{nMol.toExponential(3)}</div>
                            <div className="text-[10px] text-slate-400">mol</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-primary">{nNmol.toFixed(2)}</div>
                            <div className="text-[10px] text-slate-400">nmol</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {hasAll && (
                      <div className="bg-slate-50 rounded-xl p-3">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mass</div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div>
                            <div className="text-sm font-bold text-primary">{mG.toExponential(3)}</div>
                            <div className="text-[10px] text-slate-400">g</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-primary">{mUg.toFixed(1)}</div>
                            <div className="text-[10px] text-slate-400">µg</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              return null
            })()}
          </div>
          <div className="text-xs text-slate-400 text-center">
            c = A / (ε × l) · n = c × V · m = n × MW
          </div>
        </div>
      )}

      {/* Global Parameters */}
      {activeTab === 'conjugation' && <>
      {/* Global Parameters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Parameters</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Linker excess</label>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                value={linkerExcess}
                onChange={e => setLinkerExcess(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                step="0.5"
                min="1"
              />
              <span className="text-sm text-slate-400">×</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Oligo excess</label>
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                value={oligoExcess}
                onChange={e => setOligoExcess(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
                step="0.5"
                min="1"
              />
              <span className="text-sm text-slate-400">×</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Default stock (µM)</label>
            <input
              type="number"
              value={defaultStock}
              onChange={e => setDefaultStock(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Target volume (µL)</label>
            <input
              type="number"
              value={targetVolume}
              onChange={e => setTargetVolume(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
        </div>
      </div>

      {/* Constructs */}
      <div className="space-y-3 mb-4">
        {constructs.map(c => {
          const r = calc(c)
          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <input
                  type="text"
                  value={c.name}
                  onChange={e => updateConstruct(c.id, 'name', e.target.value)}
                  className="font-semibold text-slate-900 bg-transparent border-none outline-none text-base w-full"
                  placeholder="Construct name"
                />
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => cloneConstruct(c)}
                    className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                    title="Clone"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeConstruct(c.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-xs text-slate-400">Protein c (µM)</label>
                  <input
                    type="number"
                    value={c.proteinConc}
                    onChange={e => updateConstruct(c.id, 'proteinConc', e.target.value)}
                    placeholder="µM"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Protein V (µL)</label>
                  <input
                    type="number"
                    value={c.proteinVol}
                    onChange={e => updateConstruct(c.id, 'proteinVol', e.target.value)}
                    placeholder="µL"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Linker c (µM)</label>
                  <input
                    type="number"
                    value={c.linkerConc}
                    onChange={e => updateConstruct(c.id, 'linkerConc', e.target.value)}
                    placeholder={defaultStock || '100'}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Oligo c (µM)</label>
                  <input
                    type="number"
                    value={c.oligoConc}
                    onChange={e => updateConstruct(c.id, 'oligoConc', e.target.value)}
                    placeholder={defaultStock || '100'}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  />
                </div>
              </div>

              {/* Results */}
              {r.valid && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <div>
                      <div className="text-xs text-slate-400">n</div>
                      <div className="text-sm font-semibold text-primary">{r.n.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-400">nmol</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Linker</div>
                      <div className="text-sm font-semibold text-accent">{r.linkerV.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-400">µL</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Oligo</div>
                      <div className="text-sm font-semibold text-accent">{r.oligoV.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-400">µL</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Total</div>
                      <div className="text-sm font-semibold text-slate-700">{r.totalV.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-400">µL</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Fill-up</div>
                      <div className={`text-sm font-semibold ${r.fillUp < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                        {r.fillUp.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-slate-400">µL</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add construct button */}
      <button
        onClick={addConstruct}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-medium text-slate-400 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add Construct
      </button>

      {/* Summary */}
      {validCount > 0 && (
        <div className="mt-4 bg-primary/5 rounded-2xl p-4 border border-primary/10">
          <h3 className="text-xs font-bold text-primary uppercase tracking-wide mb-2">Summary</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-slate-500">Total linker: </span>
              <span className="font-semibold text-primary">{totalLinker.toFixed(1)} µL</span>
            </div>
            <div>
              <span className="text-slate-500">Constructs: </span>
              <span className="font-semibold text-primary">{validCount}</span>
            </div>
          </div>
        </div>
      )}

      </>}

      {/* Save to Project Modal */}
      {showSaveModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {saved ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-lg font-semibold text-primary">Saved to project!</p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Save to Project</h2>
                <p className="text-sm text-slate-500 mb-4">
                  The calculation table will be added as a note to the selected project.
                </p>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={saveToProject}
                    disabled={!selectedProjectId}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
