import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, ClipboardList, Trash2, FolderOpen, ArrowLeft } from 'lucide-react'
import type { ConjugationRecordMeta } from '../db'
import { ADAPTER_VARIANTS, createDefaultTube, DEFAULT_COMMON_MATERIALS, CHECKLIST_ITEMS } from '../conjugationRecord'

export default function ConjugationRecordList() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [tubeCount, setTubeCount] = useState(4)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<ConjugationRecordMeta[] | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'conjugationRecords'),
      orderBy('updatedAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: ConjugationRecordMeta[] = snapshot.docs.map(docSnap => {
        const d = docSnap.data()
        return {
          id: docSnap.id,
          name: d.name,
          preparedBy: d.preparedBy || '',
          dateStarted: d.dateStarted || '',
          tubeCount: d.tubeCount || 0,
          createdAt: d.createdAt?.toDate() || new Date(),
          updatedAt: d.updatedAt?.toDate() || new Date(),
        }
      })
      setRecords(data)
    }, (err) => {
      console.error('Firestore error:', err)
      setError(err.message)
      setRecords([])
    })
    return unsubscribe
  }, [user])

  async function createRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user) return
    setError('')
    try {
      const now = Timestamp.now()
      const tubes = Array.from({ length: tubeCount }, () => createDefaultTube())
      const checklists: Record<string, boolean> = {}
      for (const key of Object.keys(CHECKLIST_ITEMS)) {
        checklists[key] = false
      }
      const acceptanceCriteria: Record<string, { minYield: number | null; activity: number | null; koff: number | null }> = {}
      for (const v of ADAPTER_VARIANTS) {
        acceptanceCriteria[v.name] = { minYield: null, activity: null, koff: null }
      }
      const commonMaterials = DEFAULT_COMMON_MATERIALS.map(m => ({ ...m }))
      const docRef = await addDoc(collection(firestore, 'users', user.uid, 'conjugationRecords'), {
        name: name.trim(),
        customAdapters: [],
        mixingRatioLinker: 2,
        mixingRatioOligo: 2.5,
        dateStarted: '',
        dateFinished: '',
        preparedBy: '',
        acceptanceCriteria,
        commonMaterials,
        oligoReconstitutions: [],
        activationStartTime: '',
        conjugationStartTime: '',
        conjugationEndTime: '',
        aktaColumnPosition: '',
        aktaMethodName: '',
        sdsExperimentRef: '',
        sdsLoadAmount: '',
        sdsStainStart: '',
        sdsStainEnd: '',
        qcExperimentRef: '',
        hasDeviations: false,
        deviationNcrNumber: '',
        releaseOperatorName: '',
        releaseOperatorDate: '',
        releaseQcName: '',
        releaseQcDate: '',
        storageLocation: '',
        calculatedExpiry: '',
        tubeCount,
        tubes,
        checklists,
        sectionComments: {},
        createdAt: now,
        updatedAt: now,
      })
      setName('')
      setTubeCount(4)
      setShowForm(false)
      navigate(`/record/${docRef.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create record'
      console.error('Create record error:', err)
      setError(message)
    }
  }

  async function deleteRecord(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!user || !confirm('Delete this conjugation record?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'conjugationRecords', id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 text-primary hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Conjugation Records</h1>
            <p className="text-sm text-slate-500">Adapter conjugation batch records</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 border border-red-200">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={createRecord} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-3">New Conjugation Record</h2>
          <input
            type="text"
            placeholder="Batch name (e.g. Batch 2026-04-15)"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent text-base"
          />
          <div className="mb-3">
            <label className="text-sm font-medium text-slate-700 mb-1 block">Number of tubes</label>
            <div className="flex gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTubeCount(n)}
                  className={`w-10 h-10 rounded-lg font-medium transition-all ${
                    tubeCount === n
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
              Create Record
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(''); setTubeCount(4) }}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!records ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-400 mb-2">No records yet</h2>
          <p className="text-slate-400 mb-6">Create your first conjugation batch record</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-white px-6 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors"
          >
            New Record
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(rec => (
            <div
              key={rec.id}
              onClick={() => navigate(`/record/${rec.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{rec.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    {rec.preparedBy && <span>By {rec.preparedBy}</span>}
                    <span>{rec.tubeCount} tube{rec.tubeCount !== 1 ? 's' : ''}</span>
                    {rec.dateStarted && <span>Started {rec.dateStarted}</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Updated {formatDate(rec.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={e => deleteRecord(e, rec.id)}
                  className="ml-3 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}
