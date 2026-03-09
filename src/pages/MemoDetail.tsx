import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Edit3, Check, X, Camera, Image } from 'lucide-react'
import type { Memo, MemoEntry } from '../db'

function resizeImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function MemoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [memo, setMemo] = useState<Memo | null>(null)
  const [entries, setEntries] = useState<MemoEntry[]>([])
  const [entryText, setEntryText] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user || !id) return
    const memoRef = doc(firestore, 'users', user.uid, 'memos', id)
    const unsubMemo = onSnapshot(memoRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setMemo({
          id: snap.id,
          name: data.name,
          description: data.description || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        })
      }
      setLoading(false)
    })

    const entriesQuery = query(
      collection(firestore, 'users', user.uid, 'memos', id, 'entries'),
      orderBy('createdAt', 'desc')
    )
    const unsubEntries = onSnapshot(entriesQuery, (snap) => {
      const entriesData: MemoEntry[] = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          memoId: id,
          content: data.content,
          imageData: data.imageData || undefined,
          done: data.done || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      })
      setEntries(entriesData)
    })

    return () => { unsubMemo(); unsubEntries() }
  }, [user, id])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [entryText])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (!memo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/memos')} className="flex items-center gap-2 text-primary mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <p className="text-slate-400 text-center py-12">Memo not found</p>
      </div>
    )
  }

  async function handleImageSelected(file: File) {
    try {
      setUploading(true)
      const base64 = await resizeImage(file)
      setPendingImage(base64)
    } catch {
      alert('Could not process image')
    } finally {
      setUploading(false)
    }
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if ((!entryText.trim() && !pendingImage) || !id || !user) return
    const now = Timestamp.now()
    const entryData: Record<string, unknown> = {
      content: entryText.trim(),
      createdAt: now,
      updatedAt: now,
    }
    if (pendingImage) {
      entryData.imageData = pendingImage
    }
    await addDoc(collection(firestore, 'users', user.uid, 'memos', id, 'entries'), entryData)
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', id), { updatedAt: now })
    setEntryText('')
    setPendingImage(null)
  }

  async function deleteEntry(entryId: string) {
    if (!user || !id || !confirm('Delete this entry?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'memos', id, 'entries', entryId))
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', id), { updatedAt: Timestamp.now() })
  }

  async function toggleDone(entry: MemoEntry) {
    if (!user || !id) return
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', id, 'entries', entry.id), {
      done: !entry.done,
    })
  }

  async function saveEdit(entryId: string) {
    if (!editText.trim() || !user || !id) return
    const now = Timestamp.now()
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', id, 'entries', entryId), {
      content: editText.trim(),
      updatedAt: now,
    })
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', id), { updatedAt: now })
    setEditingId(null)
    setEditText('')
  }

  function startEdit(entry: MemoEntry) {
    setEditingId(entry.id)
    setEditText(entry.content)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/memos')}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Memos</span>
        </button>
      </div>

      {/* Memo Info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{memo.name}</h1>
        {memo.description && (
          <p className="text-slate-500 mt-1">{memo.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Created {new Date(memo.createdAt).toLocaleDateString()} &middot; {entries.filter(e => e.done).length}/{entries.length} done
        </p>
      </div>

      {/* Add Entry Form */}
      <form onSubmit={addEntry} className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-transparent">
          <textarea
            ref={textareaRef}
            value={entryText}
            onChange={e => setEntryText(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-base resize-none focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addEntry(e)
              }
            }}
          />

          {/* Pending image preview */}
          {pendingImage && (
            <div className="px-4 pb-2 relative inline-block">
              <img src={pendingImage} alt="Preview" className="max-h-40 rounded-lg border border-slate-200" />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                className="absolute top-1 right-5 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                title="Take photo"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                title="Choose photo"
              >
                <Image className="w-5 h-5" />
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleImageSelected(file)
                  e.target.value = ''
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleImageSelected(file)
                  e.target.value = ''
                }}
              />
            </div>

            {(entryText.trim() || pendingImage) && (
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-1.5 bg-teal-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-teal-600 active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {uploading ? 'Processing...' : 'Add'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Entries List */}
      {entries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No entries yet. Start writing!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200 transition-opacity ${entry.done ? 'opacity-50' : ''}`}>
              {editingId === entry.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-teal-400 text-base resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(entry.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-500 text-white rounded-lg text-sm hover:bg-teal-600 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 text-slate-600 bg-slate-100 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(entry)}
                    className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      entry.done
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : 'border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {entry.done && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {entry.imageData && (
                      <div
                        className="w-full mb-3 rounded-lg overflow-hidden border border-slate-100 relative"
                        role="button"
                        tabIndex={0}
                        onPointerUp={() => setLightboxImage(entry.imageData!)}
                      >
                        <img
                          src={entry.imageData}
                          alt="Memo photo"
                          className="w-full rounded-lg"
                          draggable={false}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                          Tap to zoom
                        </div>
                      </div>
                    )}
                    {entry.content && (
                      <p className={`whitespace-pre-wrap ${entry.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{entry.content}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-400">
                        {formatTimestamp(entry.createdAt)}
                        {entry.updatedAt > entry.createdAt && ' (edited)'}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 12, flexShrink: 0 }}>
            <button
              type="button"
              onPointerUp={() => setLightboxImage(null)}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: 'none',
                fontSize: 24,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <img
              src={lightboxImage}
              alt="Full size"
              style={{ maxWidth: '100%', touchAction: 'pinch-zoom' }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function formatTimestamp(date: Date): string {
  const d = new Date(date)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
