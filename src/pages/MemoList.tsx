import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, StickyNote, Trash2, Edit3, Check, X, Camera, Image, ArrowLeft } from 'lucide-react'
import type { Memo } from '../db'

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

export default function MemoList() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [memoText, setMemoText] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'memos'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setMemos(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          content: data.content || '',
          imageData: data.imageData || undefined,
          done: data.done || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      }))
      setLoading(false)
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [memoText])

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

  async function addMemo(e: React.FormEvent) {
    e.preventDefault()
    if ((!memoText.trim() && !pendingImage) || !user) return
    const now = Timestamp.now()
    const memoData: Record<string, unknown> = {
      content: memoText.trim(),
      done: false,
      createdAt: now,
      updatedAt: now,
    }
    if (pendingImage) {
      memoData.imageData = pendingImage
    }
    await addDoc(collection(firestore, 'users', user.uid, 'memos'), memoData)
    setMemoText('')
    setPendingImage(null)
  }

  async function toggleDone(memo: Memo) {
    if (!user) return
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', memo.id), {
      done: !memo.done,
    })
  }

  async function deleteMemo(memoId: string) {
    if (!user || !confirm('Delete this memo?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'memos', memoId))
  }

  async function saveEdit(memoId: string) {
    if (!editText.trim() || !user) return
    const now = Timestamp.now()
    await updateDoc(doc(firestore, 'users', user.uid, 'memos', memoId), {
      content: editText.trim(),
      updatedAt: now,
    })
    setEditingId(null)
    setEditText('')
  }

  function startEdit(memo: Memo) {
    setEditingId(memo.id)
    setEditText(memo.content)
  }

  const doneCount = memos.filter(m => m.done).length

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
            <p className="text-sm text-slate-500">
              {memos.length > 0 ? `${doneCount}/${memos.length} done` : 'Quick notes & reminders'}
            </p>
          </div>
        </div>
      </div>

      {/* Add Memo Form */}
      <form onSubmit={addMemo} className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent">
          <textarea
            ref={textareaRef}
            value={memoText}
            onChange={e => setMemoText(e.target.value)}
            placeholder="Add a memo..."
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-base resize-none focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addMemo(e)
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
                className="p-2 text-slate-400 hover:text-accent hover:bg-orange-50 rounded-lg transition-colors"
                title="Take photo"
              >
                <Camera className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-accent hover:bg-orange-50 rounded-lg transition-colors"
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

            {(memoText.trim() || pendingImage) && (
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {uploading ? 'Processing...' : 'Add'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Memos List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : memos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No memos yet. Add one above!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map(memo => (
            <div key={memo.id} className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200 transition-opacity ${memo.done ? 'opacity-50' : ''}`}>
              {editingId === memo.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-accent text-base resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(memo.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent text-white rounded-lg text-sm hover:bg-accent-dark transition-colors"
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
                    onClick={() => toggleDone(memo)}
                    className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      memo.done
                        ? 'bg-accent border-accent text-white'
                        : 'border-slate-300 hover:border-accent'
                    }`}
                  >
                    {memo.done && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {memo.imageData && (
                      <div
                        className="w-full mb-3 rounded-lg overflow-hidden border border-slate-100 relative"
                        role="button"
                        tabIndex={0}
                        onPointerUp={() => setLightboxImage(memo.imageData!)}
                      >
                        <img
                          src={memo.imageData}
                          alt="Memo photo"
                          className="w-full rounded-lg"
                          draggable={false}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                          Tap to zoom
                        </div>
                      </div>
                    )}
                    {memo.content && (
                      <p className={`whitespace-pre-wrap ${memo.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{memo.content}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-slate-400">
                        {formatTimestamp(memo.createdAt)}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(memo)}
                          className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMemo(memo.id)}
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
