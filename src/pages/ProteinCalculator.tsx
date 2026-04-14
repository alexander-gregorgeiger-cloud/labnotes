import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Save, BookOpen, Plus, Trash2, Copy } from 'lucide-react'
import type { Project } from '../db'

interface EpsilonEntry {
  id: string
  name: string
  epsilon280: string
  epsilon260: string
  epsilonMass: string
  mw: string
  createdAt: Date
}

export default function ProteinCalculator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [mode, setMode] = useState<'a280' | 'auc' | 'dilution'>('a280')
  const [epsMode, setEpsMode] = useState<'molar' | 'mass'>('molar')
  const [abs, setAbs] = useState('')
  const [auc, setAuc] = useState('')     // mAU·mL
  const [epsilon, setEpsilon] = useState('')
  const [mw, setMw] = useState('')
  const [mwUnit, setMwUnit] = useState<'da' | 'kda'>('da')
  const [path, setPath] = useState('1')  // cm (default 1 for A280, 0.2 for AUC)
  const [vol, setVol] = useState('')     // µL

  // Conjugate ε/MW calculator
  const [conjProtE280, setConjProtE280] = useState('210000')
  const [conjProtE260, setConjProtE260] = useState('120000')
  const [conjProtMW, setConjProtMW] = useState('150000')
  const [conjOligoE280, setConjOligoE280] = useState('100000')
  const [conjOligoE260, setConjOligoE260] = useState('200000')
  const [conjOligoMW, setConjOligoMW] = useState('6600')
  const [conjDOL, setConjDOL] = useState('1')

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saved, setSaved] = useState(false)

  // Epsilon library
  const [epsilonLibrary, setEpsilonLibrary] = useState<EpsilonEntry[]>([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [showAddEpsilon, setShowAddEpsilon] = useState(false)
  const [newEpsName, setNewEpsName] = useState('')
  const [newEps280, setNewEps280] = useState('')
  const [newEps260, setNewEps260] = useState('')
  const [newEpsMass, setNewEpsMass] = useState('')
  const [newEpsMW, setNewEpsMW] = useState('')

  // Dilution calculator (C1V1 = C2V2)
  const [dilC1, setDilC1] = useState('')
  const [dilC2, setDilC2] = useState('')
  const [dilV2, setDilV2] = useState('')

  // Pre-fill from URL params (from projects)
  useEffect(() => {
    const pProjectId = searchParams.get('projectId')
    if (pProjectId) setSelectedProjectId(pProjectId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const absVal = parseFloat(abs) || 0
  const aucVal = parseFloat(auc) || 0
  const epsVal = parseFloat(epsilon) || 0
  const pathVal = parseFloat(path) || (mode === 'auc' ? 0.2 : 1)
  const mwVal = (parseFloat(mw) || 0) * (mwUnit === 'kda' ? 1000 : 1)
  const volVal = parseFloat(vol) || 0

  const hasResult = mode === 'a280'
    ? absVal > 0 && epsVal > 0
    : mode === 'auc'
    ? aucVal > 0 && epsVal > 0
    : (parseFloat(dilC1) || 0) > 0 && (parseFloat(dilC2) || 0) > 0 && (parseFloat(dilV2) || 0) > 0
  const hasVol = volVal > 0
  const hasMW = mwVal > 0
  const isMass = epsMode === 'mass'

  // Compute all derived values based on mode and ε type
  let cMgMl = 0, cM = 0, nMol = 0, massMg = 0
  let aucCMgMl = 0, aucCM = 0

  if (mode === 'a280' && hasResult) {
    if (isMass) {
      // ε(mg): c(mg/mL) = A / (ε_mg × l)
      cMgMl = absVal / (epsVal * pathVal)
      if (hasMW) cM = cMgMl / mwVal
      if (hasVol) massMg = cMgMl * volVal * 1e-3
      if (hasVol && hasMW) nMol = massMg * 1e-3 / mwVal
    } else {
      // ε(M): c(M) = A / (ε × l)
      cM = absVal / (epsVal * pathVal)
      if (hasVol) nMol = cM * volVal * 1e-6
      if (hasVol && hasMW) massMg = nMol * mwVal * 1e3
    }
  } else if (mode === 'auc' && hasResult) {
    if (isMass) {
      // ε(mg): mass(mg) = AUC / (ε_mg × l × 1000)
      massMg = aucVal / (epsVal * pathVal * 1000)
      if (hasMW) nMol = massMg * 1e-3 / mwVal
      if (hasVol) aucCMgMl = massMg / (volVal * 1e-3)
      if (hasVol && hasMW) aucCM = nMol / (volVal * 1e-6)
    } else {
      // ε(M): n(mol) = AUC / (ε × l × 1e6)
      nMol = aucVal / (epsVal * pathVal * 1e6)
      if (hasMW) massMg = nMol * mwVal * 1e3
      if (hasVol) aucCM = nMol / (volVal * 1e-6)
    }
  }

  const cUM = cM * 1e6
  const nNmol = nMol * 1e9
  const aucCUM = aucCM * 1e6
  const mG = massMg * 1e-3
  const mUg = massMg * 1e3

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

  // Epsilon library listener
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'epsilonLibrary'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setEpsilonLibrary(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name,
          epsilon280: data.epsilon280 || '',
          epsilon260: data.epsilon260 || '',
          epsilonMass: data.epsilonMass || '',
          mw: data.mw || '',
          createdAt: data.createdAt?.toDate() || new Date(),
        }
      }))
    })
    return unsub
  }, [user])

  async function addEpsilonEntry() {
    if (!newEpsName.trim() || !user) return
    await addDoc(collection(firestore, 'users', user.uid, 'epsilonLibrary'), {
      name: newEpsName.trim(),
      epsilon280: newEps280.trim(),
      epsilon260: newEps260.trim(),
      epsilonMass: newEpsMass.trim(),
      mw: newEpsMW.trim(),
      createdAt: Timestamp.now(),
    })
    setNewEpsName(''); setNewEps280(''); setNewEps260(''); setNewEpsMass(''); setNewEpsMW('')
    setShowAddEpsilon(false)
  }

  async function deleteEpsilonEntry(entryId: string) {
    if (!user || !confirm('Delete this entry?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'epsilonLibrary', entryId))
  }

  function useEpsilonEntry(entry: { epsilon280: string; epsilonMass: string; mw: string }) {
    if (epsMode === 'mass' && entry.epsilonMass) {
      setEpsilon(entry.epsilonMass)
    } else if (entry.epsilon280) {
      setEpsilon(entry.epsilon280)
      if (epsMode === 'mass') setEpsMode('molar')
    }
    if (entry.mw) {
      setMw(entry.mw)
      setMwUnit('da')
    }
    setShowLibrary(false)
  }

  function buildText(): string {
    if (mode === 'dilution') {
      const c1 = parseFloat(dilC1) || 0
      const c2 = parseFloat(dilC2) || 0
      const v2 = parseFloat(dilV2) || 0
      const v1 = c1 > 0 ? (c2 * v2) / c1 : 0
      const buffer = v2 - v1
      let text = `Dilution (C₁V₁ = C₂V₂)\nDate: ${new Date().toLocaleDateString()}\n\n`
      text += `C₁ = ${c1} µM, C₂ = ${c2} µM, V₂ = ${v2} µL\n`
      text += `V₁ (stock) = ${v1.toFixed(2)} µL\n`
      text += `Buffer = ${buffer.toFixed(2)} µL\n`
      return text
    }
    let text = `Protein Calculator Results (${mode === 'auc' ? 'AUC/ÄKTA' : 'A280'})\n`
    text += `Date: ${new Date().toLocaleDateString()}\n\n`
    text += `── Parameters ──\n`
    if (mode === 'auc') {
      text += `AUC = ${aucVal} mAU·mL\n`
    } else {
      text += `A280 = ${absVal}\n`
    }
    text += `ε = ${epsVal} ${isMass ? '(mg/mL)⁻¹cm⁻¹' : 'M⁻¹cm⁻¹'}\n`
    if (hasMW) text += `MW = ${parseFloat(mw)} ${mwUnit === 'kda' ? 'kDa' : 'Da'}\n`
    text += `Path = ${pathVal} cm\n`
    if (hasVol) text += `Volume = ${volVal} µL\n`
    text += `\n── Results ──\n`
    if (mode === 'a280') {
      if (isMass) {
        text += `c = ${cMgMl.toFixed(3)} mg/mL\n`
        if (hasMW) text += `c = ${cM.toExponential(3)} M (${cUM.toFixed(2)} µM)\n`
      } else {
        text += `c = ${cM.toExponential(3)} M (${cUM.toFixed(2)} µM)\n`
      }
      if (nMol > 0) text += `n = ${nMol.toExponential(3)} mol (${nNmol.toFixed(2)} nmol)\n`
      if (massMg > 0) text += `m = ${mG.toExponential(3)} g (${mUg.toFixed(1)} µg)\n`
    } else {
      if (isMass) {
        text += `m = ${mG.toExponential(3)} g (${mUg.toFixed(1)} µg)\n`
        if (hasVol) text += `c = ${aucCMgMl.toFixed(3)} mg/mL\n`
        if (nMol > 0) text += `n = ${nMol.toExponential(3)} mol (${nNmol.toFixed(2)} nmol)\n`
        if (aucCM > 0) text += `c = ${aucCM.toExponential(3)} M (${aucCUM.toFixed(2)} µM)\n`
      } else {
        text += `n = ${nMol.toExponential(3)} mol (${nNmol.toFixed(2)} nmol)\n`
        if (hasVol) text += `c = ${aucCM.toExponential(3)} M (${aucCUM.toFixed(2)} µM)\n`
        if (massMg > 0) text += `m = ${mG.toExponential(3)} g (${mUg.toFixed(1)} µg)\n`
      }
    }
    return text
  }

  async function saveToProject() {
    if (!user || !selectedProjectId) return
    const now = Timestamp.now()
    await addDoc(
      collection(firestore, 'users', user.uid, 'projects', selectedProjectId, 'notes'),
      { content: buildText(), createdAt: now, updatedAt: now }
    )
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', selectedProjectId), { updatedAt: now })
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSaveModal(false) }, 1500)
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
        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!hasResult}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Protein Calculator</h1>
      <p className="text-sm text-slate-500 mb-4">Concentration, Amount & Mass</p>

      {/* Mode Toggle */}
      <div className="flex mb-4 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => { setMode('a280'); setPath('1') }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'a280' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          A280
        </button>
        <button
          onClick={() => { setMode('auc'); setPath('0.2') }}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'auc' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          AUC (ÄKTA)
        </button>
        <button
          onClick={() => setMode('dilution')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
            mode === 'dilution' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Dilution
        </button>
      </div>

      {/* A280 / AUC content */}
      {mode !== 'dilution' && (<>
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Parameters</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            {mode === 'a280' ? (
              <>
                <label className="text-xs text-slate-500 font-medium">Absorbance (A)</label>
                <input
                  type="number"
                  value={abs}
                  onChange={e => setAbs(e.target.value)}
                  placeholder="A280"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
                  step="0.001"
                />
              </>
            ) : (
              <>
                <label className="text-xs text-slate-500 font-medium">AUC (mAU·mL)</label>
                <input
                  type="number"
                  value={auc}
                  onChange={e => setAuc(e.target.value)}
                  placeholder="Integral"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
              </>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs text-slate-500 font-medium">ε</label>
              <div className="flex bg-slate-100 rounded-md p-0.5">
                <button
                  onClick={() => setEpsMode('molar')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    epsMode === 'molar' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  M⁻¹cm⁻¹
                </button>
                <button
                  onClick={() => setEpsMode('mass')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    epsMode === 'mass' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  (mg/mL)⁻¹cm⁻¹
                </button>
              </div>
              <button
                onClick={() => setShowLibrary(true)}
                className="ml-auto p-1 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-md transition-colors"
                title="ε Library"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              type="number"
              value={epsilon}
              onChange={e => setEpsilon(e.target.value)}
              placeholder={isMass ? 'e.g. 1.4' : 'e.g. 210000'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs text-slate-500 font-medium">MW</label>
              <div className="flex bg-slate-100 rounded-md p-0.5">
                <button
                  onClick={() => setMwUnit('da')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    mwUnit === 'da' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Da
                </button>
                <button
                  onClick={() => setMwUnit('kda')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    mwUnit === 'kda' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  kDa
                </button>
              </div>
            </div>
            <input
              type="number"
              value={mw}
              onChange={e => setMw(e.target.value)}
              placeholder={mwUnit === 'kda' ? 'e.g. 150' : 'e.g. 150000'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Path (cm)</label>
            <input
              type="number"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder={mode === 'auc' ? '0.2' : '1'}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">{mode === 'auc' ? 'Collected V (µL)' : 'Volume (µL)'}</label>
            <input
              type="number"
              value={vol}
              onChange={e => setVol(e.target.value)}
              placeholder="µL"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.1"
            />
          </div>
        </div>
        {mode === 'auc' && (
          <p className="text-[10px] text-slate-400 mt-2">Standard ÄKTA UV cell: 0.2 cm (2 mm). Enter collected fraction volume to get concentration.</p>
        )}
        {isMass && (
          <p className="text-[10px] text-slate-400 mt-2">ε(mg) gives concentration in mg/mL directly. MW is only needed for molar values.</p>
        )}
      </div>

      {/* Results */}
      {hasResult && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Results</h2>

          {/* A280 mode */}
          {mode === 'a280' && (
            <>
              {/* Concentration */}
              <div className={`bg-slate-50 rounded-xl p-4 ${nMol > 0 || massMg > 0 ? 'mb-3' : ''}`}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concentration</div>
                <div className={`grid gap-3 text-center ${isMass && cM > 0 ? 'grid-cols-3' : isMass ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {isMass && (
                    <div>
                      <div className="text-lg font-bold text-accent">{cMgMl.toFixed(3)}</div>
                      <div className="text-xs text-slate-400">mg/mL</div>
                    </div>
                  )}
                  {cM > 0 && (
                    <>
                      <div>
                        <div className="text-lg font-bold text-accent">{cM.toExponential(3)}</div>
                        <div className="text-xs text-slate-400">M</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-accent">{cUM.toFixed(2)}</div>
                        <div className="text-xs text-slate-400">µM</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Amount */}
              {nMol > 0 && (
                <div className={`bg-slate-50 rounded-xl p-4 ${massMg > 0 ? 'mb-3' : ''}`}>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{nMol.toExponential(3)}</div>
                      <div className="text-xs text-slate-400">mol</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{nNmol.toFixed(2)}</div>
                      <div className="text-xs text-slate-400">nmol</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mass */}
              {massMg > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mass</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{mG.toExponential(3)}</div>
                      <div className="text-xs text-slate-400">g</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{mUg.toFixed(1)}</div>
                      <div className="text-xs text-slate-400">µg</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* AUC mode with ε(mg): Mass → Concentration → Amount */}
          {mode === 'auc' && isMass && (
            <>
              {/* Mass (primary result) */}
              <div className={`bg-slate-50 rounded-xl p-4 ${hasVol || nMol > 0 ? 'mb-3' : ''}`}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mass</div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary">{mG.toExponential(3)}</div>
                    <div className="text-xs text-slate-400">g</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-primary">{mUg.toFixed(1)}</div>
                    <div className="text-xs text-slate-400">µg</div>
                  </div>
                </div>
              </div>

              {/* Concentration (if volume given) */}
              {hasVol && (
                <div className={`bg-slate-50 rounded-xl p-4 ${nMol > 0 ? 'mb-3' : ''}`}>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concentration (in collected volume)</div>
                  <div className={`grid gap-3 text-center ${aucCM > 0 ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    <div>
                      <div className="text-lg font-bold text-accent">{aucCMgMl.toFixed(3)}</div>
                      <div className="text-xs text-slate-400">mg/mL</div>
                    </div>
                    {aucCM > 0 && (
                      <>
                        <div>
                          <div className="text-lg font-bold text-accent">{aucCM.toExponential(3)}</div>
                          <div className="text-xs text-slate-400">M</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-accent">{aucCUM.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">µM</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Amount (if MW given) */}
              {nMol > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{nMol.toExponential(3)}</div>
                      <div className="text-xs text-slate-400">mol</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{nNmol.toFixed(2)}</div>
                      <div className="text-xs text-slate-400">nmol</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* AUC mode with ε(molar): Amount → Concentration → Mass */}
          {mode === 'auc' && !isMass && (
            <>
              {/* Amount (primary result) */}
              <div className={`bg-slate-50 rounded-xl p-4 ${hasVol || massMg > 0 ? 'mb-3' : ''}`}>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount</div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary">{nMol.toExponential(3)}</div>
                    <div className="text-xs text-slate-400">mol</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-primary">{nNmol.toFixed(2)}</div>
                    <div className="text-xs text-slate-400">nmol</div>
                  </div>
                </div>
              </div>

              {/* Concentration (if volume given) */}
              {hasVol && (
                <div className={`bg-slate-50 rounded-xl p-4 ${massMg > 0 ? 'mb-3' : ''}`}>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concentration (in collected volume)</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-accent">{aucCM.toExponential(3)}</div>
                      <div className="text-xs text-slate-400">M</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-accent">{aucCUM.toFixed(2)}</div>
                      <div className="text-xs text-slate-400">µM</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mass (if MW given) */}
              {massMg > 0 && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mass</div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div>
                      <div className="text-lg font-bold text-primary">{mG.toExponential(3)}</div>
                      <div className="text-xs text-slate-400">g</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{mUg.toFixed(1)}</div>
                      <div className="text-xs text-slate-400">µg</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Conjugate ε/MW Calculator */}
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Conjugate ε & MW</h2>
        <p className="text-[10px] text-slate-400 mb-3">Calculate combined values for a protein–oligo conjugate</p>

        {/* Protein row */}
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Protein</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-slate-400">ε₂₈₀</label>
            <input type="number" value={conjProtE280} onChange={e => setConjProtE280(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">ε₂₆₀</label>
            <input type="number" value={conjProtE260} onChange={e => setConjProtE260(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">MW (Da)</label>
            <input type="number" value={conjProtMW} onChange={e => setConjProtMW(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
        </div>

        {/* Oligo row */}
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Oligo</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="text-[10px] text-slate-400">ε₂₈₀</label>
            <input type="number" value={conjOligoE280} onChange={e => setConjOligoE280(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">ε₂₆₀</label>
            <input type="number" value={conjOligoE260} onChange={e => setConjOligoE260(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">MW (Da)</label>
            <input type="number" value={conjOligoMW} onChange={e => setConjOligoMW(e.target.value)}
              className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
        </div>

        {/* DOL */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-400">DOL (oligos per protein)</label>
          <input type="number" value={conjDOL} onChange={e => setConjDOL(e.target.value)}
            className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light"
            step="0.1" min="0" />
        </div>

        {/* Conjugate results */}
        {(() => {
          const pE280 = parseFloat(conjProtE280) || 0
          const pE260 = parseFloat(conjProtE260) || 0
          const pMW = parseFloat(conjProtMW) || 0
          const oE280 = parseFloat(conjOligoE280) || 0
          const oE260 = parseFloat(conjOligoE260) || 0
          const oMW = parseFloat(conjOligoMW) || 0
          const dol = parseFloat(conjDOL) || 0
          if (pMW > 0 || pE280 > 0) {
            const cE280 = pE280 + oE280 * dol
            const cE260 = pE260 + oE260 * dol
            const cMW = pMW + oMW * dol
            return (
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Conjugate</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold text-accent">{cE280.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">ε₂₈₀</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-accent">{cE260.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">ε₂₆₀</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-primary">{cMW.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">MW (Da)</div>
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}
      </div>

      {/* Reference Table */}
      <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Reference Values</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-semibold">Molecule</th>
                <th className="pb-2 font-semibold text-right">ε₂₈₀</th>
                <th className="pb-2 font-semibold text-right">ε₂₆₀</th>
                <th className="pb-2 font-semibold text-right">ε₂₈₀(mg)</th>
                <th className="pb-2 font-semibold text-right">MW (Da)</th>
              </tr>
            </thead>
            <tbody className="text-slate-600">
              <tr className="border-b border-slate-50">
                <td className="py-2 font-medium">IgG antibody</td>
                <td className="py-2 text-right font-mono">210,000</td>
                <td className="py-2 text-right font-mono text-slate-400">120,000</td>
                <td className="py-2 text-right font-mono">1.4</td>
                <td className="py-2 text-right font-mono">150,000</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">20bp ssDNA oligo</td>
                <td className="py-2 text-right font-mono text-slate-400">~100,000</td>
                <td className="py-2 text-right font-mono">~200,000</td>
                <td className="py-2 text-right font-mono text-slate-400">~15</td>
                <td className="py-2 text-right font-mono">~6,600</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          IgG: typical values for ~150 kDa full-length antibody. ε(mg) in (mg/mL)⁻¹cm⁻¹. Oligo: average estimates — use sequence-specific values for accuracy.
        </p>
      </div>

      {/* Formula reference */}
      <div className="mt-3 text-xs text-slate-400 text-center">
        {mode === 'a280'
          ? (isMass
            ? <>c<sub>mg</sub> = A / (ε<sub>mg</sub> × l) &nbsp;·&nbsp; m = c<sub>mg</sub> × V</>
            : <>c = A / (ε × l) &nbsp;·&nbsp; n = c × V &nbsp;·&nbsp; m = n × MW</>)
          : (isMass
            ? <>m = AUC / (ε<sub>mg</sub> × l × 10³) &nbsp;·&nbsp; n = m / MW</>
            : <>n = AUC / (ε × l × 10⁶) &nbsp;·&nbsp; m = n × MW</>)
        }
      </div>
      </>)}

      {/* Dilution mode */}
      {mode === 'dilution' && (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Dilution (C₁V₁ = C₂V₂)</h2>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-400">C₁ initial (µM)</label>
            <input type="number" value={dilC1} onChange={e => setDilC1(e.target.value)} placeholder="µM"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-xs text-slate-400">C₂ target (µM)</label>
            <input type="number" value={dilC2} onChange={e => setDilC2(e.target.value)} placeholder="µM"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
          <div>
            <label className="text-xs text-slate-400">V₂ final (µL)</label>
            <input type="number" value={dilV2} onChange={e => setDilV2(e.target.value)} placeholder="µL"
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
          </div>
        </div>
        {(() => {
          const c1 = parseFloat(dilC1) || 0
          const c2 = parseFloat(dilC2) || 0
          const v2 = parseFloat(dilV2) || 0
          if (c1 > 0 && c2 > 0 && v2 > 0 && c1 >= c2) {
            const v1 = (c2 * v2) / c1
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
            return <div className="bg-red-50 rounded-xl p-3 text-center"><p className="text-sm text-red-500">C₁ must be ≥ C₂</p></div>
          }
          return null
        })()}

        {/* Dilution formula */}
        <div className="mt-3 text-xs text-slate-400 text-center">
          V₁ = (C₂ × V₂) / C₁ &nbsp;·&nbsp; Buffer = V₂ − V₁
        </div>
      </div>
      )}

      {/* Epsilon Library Modal */}
      {showLibrary && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowLibrary(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">ε Library</h2>
              <button
                onClick={() => setShowAddEpsilon(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {showAddEpsilon && (
              <div className="bg-slate-50 rounded-xl p-3 mb-3">
                <input
                  type="text"
                  value={newEpsName}
                  onChange={e => setNewEpsName(e.target.value)}
                  placeholder="Name (e.g. IgG, Her2-ADC)"
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light"
                />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-400">ε₂₈₀ (M⁻¹cm⁻¹)</label>
                    <input type="number" value={newEps280} onChange={e => setNewEps280(e.target.value)}
                      placeholder="e.g. 210000"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">ε₂₆₀ (M⁻¹cm⁻¹)</label>
                    <input type="number" value={newEps260} onChange={e => setNewEps260(e.target.value)}
                      placeholder="e.g. 120000"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-slate-400">ε (mg/mL)⁻¹cm⁻¹</label>
                    <input type="number" value={newEpsMass} onChange={e => setNewEpsMass(e.target.value)}
                      placeholder="e.g. 1.4" step="0.01"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">MW (Da)</label>
                    <input type="number" value={newEpsMW} onChange={e => setNewEpsMW(e.target.value)}
                      placeholder="e.g. 150000"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addEpsilonEntry} disabled={!newEpsName.trim()}
                    className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-40">
                    Save
                  </button>
                  <button onClick={() => { setShowAddEpsilon(false); setNewEpsName(''); setNewEps280(''); setNewEps260(''); setNewEpsMass(''); setNewEpsMW('') }}
                    className="px-3 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Reference Values</div>
              {[
                { name: 'IgG antibody', epsilon280: '210000', epsilon260: '120000', epsilonMass: '1.4', mw: '150000' },
                { name: '20bp ssDNA oligo', epsilon280: '100000', epsilon260: '200000', epsilonMass: '15', mw: '6600' },
              ].map((ref) => (
                <div
                  key={ref.name}
                  onClick={() => useEpsilonEntry(ref)}
                  className="flex items-center justify-between bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-700">{ref.name}</div>
                    <div className="text-[10px] text-slate-400">
                      ε₂₈₀={Number(ref.epsilon280).toLocaleString()} · ε(mg)={ref.epsilonMass} · MW={Number(ref.mw).toLocaleString()} Da
                    </div>
                  </div>
                  <Copy className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                </div>
              ))}

              {epsilonLibrary.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-3 mb-1">Your Library</div>
                  {epsilonLibrary.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 cursor-pointer hover:bg-blue-50 transition-colors">
                      <div onClick={() => useEpsilonEntry(entry)} className="flex-1">
                        <div className="text-sm font-medium text-slate-700">{entry.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {entry.epsilon280 && `ε₂₈₀=${Number(entry.epsilon280).toLocaleString()}`}
                          {entry.epsilonMass && ` · ε(mg)=${entry.epsilonMass}`}
                          {entry.mw && ` · MW=${Number(entry.mw).toLocaleString()} Da`}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteEpsilonEntry(entry.id) }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {epsilonLibrary.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">
                  Tap a reference value to use it, or add your own.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowLibrary(false)}
              className="mt-4 w-full py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
                  The calculation results will be added as a note to the selected project.
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
