import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Save } from 'lucide-react'
import type { Project } from '../db'

export default function ProteinCalculator() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [abs, setAbs] = useState('')
  const [epsilon, setEpsilon] = useState('')
  const [mw, setMw] = useState('')       // Da
  const [path, setPath] = useState('1')  // cm
  const [vol, setVol] = useState('')     // µL

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saved, setSaved] = useState(false)

  const absVal = parseFloat(abs) || 0
  const epsVal = parseFloat(epsilon) || 0
  const pathVal = parseFloat(path) || 1
  const mwVal = parseFloat(mw) || 0
  const volVal = parseFloat(vol) || 0

  const hasResult = absVal > 0 && epsVal > 0
  const hasVol = volVal > 0
  const hasMW = mwVal > 0
  const hasAll = hasVol && hasMW

  const cM = hasResult ? absVal / (epsVal * pathVal) : 0
  const cUM = cM * 1e6
  const nMol = hasVol ? cM * volVal * 1e-6 : 0
  const nNmol = nMol * 1e9
  const mG = hasAll ? nMol * mwVal : 0
  const mUg = mG * 1e6

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

  function buildText(): string {
    let text = `Protein Calculator Results\n`
    text += `Date: ${new Date().toLocaleDateString()}\n\n`
    text += `── Parameters ──\n`
    text += `A280 = ${absVal}\n`
    text += `ε = ${epsVal} M⁻¹cm⁻¹\n`
    if (hasMW) text += `MW = ${mwVal} Da\n`
    text += `Path = ${pathVal} cm\n`
    if (hasVol) text += `Volume = ${volVal} µL\n`
    text += `\n── Results ──\n`
    text += `c = ${cM.toExponential(3)} M (${cUM.toFixed(2)} µM)\n`
    if (hasVol) text += `n = ${nMol.toExponential(3)} mol (${nNmol.toFixed(2)} nmol)\n`
    if (hasAll) text += `m = ${mG.toExponential(3)} g (${mUg.toFixed(1)} µg)\n`
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
      <p className="text-sm text-slate-500 mb-6">A280 → Concentration, Amount & Mass</p>

      {/* Inputs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Parameters</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Absorbance (A)</label>
            <input
              type="number"
              value={abs}
              onChange={e => setAbs(e.target.value)}
              placeholder="A280"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.001"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">ε (M⁻¹cm⁻¹)</label>
            <input
              type="number"
              value={epsilon}
              onChange={e => setEpsilon(e.target.value)}
              placeholder="Extinction coeff."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">MW (Da)</label>
            <input
              type="number"
              value={mw}
              onChange={e => setMw(e.target.value)}
              placeholder="Da"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Path (cm)</label>
            <input
              type="number"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Volume (µL)</label>
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
      </div>

      {/* Results */}
      {hasResult && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Results</h2>

          {/* Concentration */}
          <div className="bg-slate-50 rounded-xl p-4 mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concentration</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-accent">{cM.toExponential(3)}</div>
                <div className="text-xs text-slate-400">M</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">{cUM.toFixed(2)}</div>
                <div className="text-xs text-slate-400">µM</div>
              </div>
            </div>
          </div>

          {/* Amount */}
          {hasVol && (
            <div className="bg-slate-50 rounded-xl p-4 mb-3">
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
          {hasAll && (
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
        </div>
      )}

      {/* Formula reference */}
      <div className="mt-4 text-xs text-slate-400 text-center">
        c = A / (ε × l) &nbsp;·&nbsp; n = c × V &nbsp;·&nbsp; m = n × MW
      </div>

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
