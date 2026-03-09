import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, StickyNote, Trash2, FolderOpen, ArrowLeft } from 'lucide-react'
import type { Memo } from '../db'

export default function MemoList() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [memos, setMemos] = useState<(Memo & { entryCount?: number; doneCount?: number })[] | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'memos'),
      orderBy('updatedAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data: (Memo & { entryCount?: number; doneCount?: number })[] = []
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data()
        const entriesSnap = await getDocs(collection(firestore, 'users', user.uid, 'memos', docSnap.id, 'entries'))
        const doneCount = entriesSnap.docs.filter(e => e.data().done).length
        data.push({
          id: docSnap.id,
          name: d.name,
          description: d.description || '',
          createdAt: d.createdAt?.toDate() || new Date(),
          updatedAt: d.updatedAt?.toDate() || new Date(),
          entryCount: entriesSnap.size,
          doneCount,
        })
      }
      setMemos(data)
    }, (err) => {
      console.error('Firestore error:', err)
      setError(err.message)
      setMemos([])
    })
    return unsubscribe
  }, [user])

  async function createMemo(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user) return
    setError('')
    try {
      const now = Timestamp.now()
      const docRef = await addDoc(collection(firestore, 'users', user.uid, 'memos'), {
        name: name.trim(),
        description: description.trim(),
        createdAt: now,
        updatedAt: now,
      })
      setName('')
      setDescription('')
      setShowForm(false)
      navigate(`/memo/${docRef.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create memo'
      console.error('Create memo error:', err)
      setError(message)
    }
  }

  async function deleteMemo(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!user || !confirm('Delete this memo and all its entries?')) return
    const entriesSnap = await getDocs(collection(firestore, 'users', user.uid, 'memos', id, 'entries'))
    for (const entryDoc of entriesSnap.docs) {
      await deleteDoc(entryDoc.ref)
    }
    await deleteDoc(doc(firestore, 'users', user.uid, 'memos', id))
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
            <StickyNote className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Memos</h1>
            <p className="text-sm text-slate-500">Quick notes & reminders</p>
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

      {/* New Memo Form */}
      {showForm && (
        <form onSubmit={createMemo} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-3">New Memo</h2>
          <input
            type="text"
            placeholder="Memo title"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-base"
          />
          <textarea
            placeholder="Topic / Description (optional)"
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
              Create Memo
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

      {/* Memos List */}
      {!memos ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : memos.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-400 mb-2">No memos yet</h2>
          <p className="text-slate-400 mb-6">Create your first memo</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-accent text-white px-6 py-2.5 rounded-full font-medium hover:bg-accent-dark transition-colors"
          >
            New Memo
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map(memo => (
            <div
              key={memo.id}
              onClick={() => navigate(`/memo/${memo.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-accent hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{memo.name}</h3>
                  {memo.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{memo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{memo.doneCount ?? 0}/{memo.entryCount ?? 0} done</span>
                    <span>Updated {formatDate(memo.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={e => deleteMemo(e, memo.id)}
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
