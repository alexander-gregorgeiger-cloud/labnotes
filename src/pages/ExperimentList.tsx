import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, Lightbulb, Trash2, FolderOpen, ArrowLeft } from 'lucide-react'
import type { Experiment } from '../db'

export default function ExperimentList() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [experiments, setExperiments] = useState<(Experiment & { ideaCount?: number })[] | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'experiments'),
      orderBy('updatedAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data: (Experiment & { ideaCount?: number })[] = []
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data()
        const ideasSnap = await getDocs(collection(firestore, 'users', user.uid, 'experiments', docSnap.id, 'ideas'))
        data.push({
          id: docSnap.id,
          name: d.name,
          description: d.description || '',
          createdAt: d.createdAt?.toDate() || new Date(),
          updatedAt: d.updatedAt?.toDate() || new Date(),
          ideaCount: ideasSnap.size,
        })
      }
      setExperiments(data)
    }, (err) => {
      console.error('Firestore error:', err)
      setError(err.message)
      setExperiments([])
    })
    return unsubscribe
  }, [user])

  async function createExperiment(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user) return
    setError('')
    try {
      const now = Timestamp.now()
      const docRef = await addDoc(collection(firestore, 'users', user.uid, 'experiments'), {
        name: name.trim(),
        description: description.trim(),
        createdAt: now,
        updatedAt: now,
      })
      setName('')
      setDescription('')
      setShowForm(false)
      navigate(`/experiment/${docRef.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create experiment'
      console.error('Create experiment error:', err)
      setError(message)
    }
  }

  async function deleteExperiment(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!user || !confirm('Delete this experiment and all its ideas?')) return
    const ideasSnap = await getDocs(collection(firestore, 'users', user.uid, 'experiments', id, 'ideas'))
    for (const ideaDoc of ideasSnap.docs) {
      await deleteDoc(ideaDoc.ref)
    }
    await deleteDoc(doc(firestore, 'users', user.uid, 'experiments', id))
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
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <Lightbulb className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Experimental Planning</h1>
            <p className="text-sm text-slate-500">Plan experiments & collect ideas</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center hover:bg-accent-dark active:scale-95 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 border border-red-200">
          {error}
        </div>
      )}

      {/* New Experiment Form */}
      {showForm && (
        <form onSubmit={createExperiment} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-3">New Experiment</h2>
          <input
            type="text"
            placeholder="Experiment name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base"
          />
          <textarea
            placeholder="Goal / Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-accent text-white py-2 rounded-lg font-medium hover:bg-accent-dark active:scale-[0.98] transition-all"
            >
              Create Experiment
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(''); setDescription('') }}
              className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Experiments List */}
      {!experiments ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : experiments.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-400 mb-2">No experiments yet</h2>
          <p className="text-slate-400 mb-6">Start planning your next experiment</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent text-white px-6 py-2.5 rounded-full font-medium hover:bg-accent-dark transition-colors"
          >
            New Experiment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map(exp => (
            <div
              key={exp.id}
              onClick={() => navigate(`/experiment/${exp.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-accent hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{exp.name}</h3>
                  {exp.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{exp.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{exp.ideaCount ?? 0} ideas</span>
                    <span>Updated {formatDate(exp.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={e => deleteExperiment(e, exp.id)}
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
