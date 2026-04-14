import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Copy } from 'lucide-react'

interface EpsilonEntry {
  id: string
  name: string
  epsilon280: string
  epsilon260: string
  epsilonMass: string
  mw: string
  createdAt: Date
}

const REFERENCE_VALUES = [
  { name: 'IgG antibody', epsilon280: '210000', epsilon260: '120000', epsilonMass: '1.4', mw: '150000' },
  { name: '20bp ssDNA oligo', epsilon280: '100000', epsilon260: '200000', epsilonMass: '15', mw: '6600' },
]

export default function EpsilonLibrary() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [entries, setEntries] = useState<EpsilonEntry[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newE280, setNewE280] = useState('')
  const [newE260, setNewE260] = useState('')
  const [newEMass, setNewEMass] = useState('')
  const [newMW, setNewMW] = useState('')

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'epsilonLibrary'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => {
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

  async function addEntry() {
    if (!newName.trim() || !user) return
    await addDoc(collection(firestore, 'users', user.uid, 'epsilonLibrary'), {
      name: newName.trim(),
      epsilon280: newE280.trim(),
      epsilon260: newE260.trim(),
      epsilonMass: newEMass.trim(),
      mw: newMW.trim(),
      createdAt: Timestamp.now(),
    })
    setNewName(''); setNewE280(''); setNewE260(''); setNewEMass(''); setNewMW('')
    setShowAdd(false)
  }

  async function deleteEntry(entryId: string) {
    if (!user || !confirm('Delete this entry?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'epsilonLibrary', entryId))
  }

  function useInCalculator(entry: { epsilon280: string; mw: string }) {
    const params = new URLSearchParams()
    if (entry.epsilon280) params.set('epsilon', entry.epsilon280)
    if (entry.mw) params.set('mw', entry.mw)
    navigate(`/protein?${params.toString()}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Home</span>
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">ε Library</h1>
      <p className="text-sm text-slate-500 mb-4">Extinction coefficients & molecular weights</p>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">New Entry</h2>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name (e.g. IgG, Her2-ADC, Trastuzumab)"
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-light"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400">ε₂₈₀ (M⁻¹cm⁻¹)</label>
              <input type="number" value={newE280} onChange={e => setNewE280(e.target.value)} placeholder="e.g. 210000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">ε₂₆₀ (M⁻¹cm⁻¹)</label>
              <input type="number" value={newE260} onChange={e => setNewE260(e.target.value)} placeholder="e.g. 120000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400">ε (mg/mL)⁻¹cm⁻¹</label>
              <input type="number" value={newEMass} onChange={e => setNewEMass(e.target.value)} placeholder="e.g. 1.4" step="0.01"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">MW (Da)</label>
              <input type="number" value={newMW} onChange={e => setNewMW(e.target.value)} placeholder="e.g. 150000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={!newName.trim()}
              className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-40">
              Save
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewE280(''); setNewE260(''); setNewEMass(''); setNewMW('') }}
              className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reference values */}
      <div className="mb-2">
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Reference Values</h2>
        <div className="space-y-2">
          {REFERENCE_VALUES.map(ref => (
            <div
              key={ref.name}
              onClick={() => useInCalculator(ref)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 text-sm">{ref.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    ε₂₈₀ = {Number(ref.epsilon280).toLocaleString()} M⁻¹cm⁻¹
                    {ref.epsilon260 && <> · ε₂₆₀ = {Number(ref.epsilon260).toLocaleString()}</>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ε(mg) = {ref.epsilonMass} · MW = {Number(ref.mw).toLocaleString()} Da
                  </div>
                </div>
                <Copy className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User entries */}
      {entries.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Library</h2>
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div onClick={() => useInCalculator(entry)} className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{entry.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {entry.epsilon280 && <>ε₂₈₀ = {Number(entry.epsilon280).toLocaleString()} M⁻¹cm⁻¹</>}
                      {entry.epsilon260 && <> · ε₂₆₀ = {Number(entry.epsilon260).toLocaleString()}</>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {entry.epsilonMass && <>ε(mg) = {entry.epsilonMass}</>}
                      {entry.mw && <> · MW = {Number(entry.mw).toLocaleString()} Da</>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id) }}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No custom entries yet. Tap "Add" to save your first one.</p>
          <p className="text-slate-400 text-xs mt-1">Tap a reference value to use it in the Protein Calculator.</p>
        </div>
      )}
    </div>
  )
}
