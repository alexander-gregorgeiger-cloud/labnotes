import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Download, Trash2, Edit3, Check, X, Camera, Image } from 'lucide-react'
import { exportExperiment } from '../export'
import type { Experiment, Idea } from '../db'

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

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [experiment, setExperiment] = useState<Experiment | null>(null)
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [ideaText, setIdeaText] = useState('')
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
    const expRef = doc(firestore, 'users', user.uid, 'experiments', id)
    const unsubExp = onSnapshot(expRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setExperiment({
          id: snap.id,
          name: data.name,
          description: data.description || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        })
      }
      setLoading(false)
    })

    const ideasQuery = query(
      collection(firestore, 'users', user.uid, 'experiments', id, 'ideas'),
      orderBy('createdAt', 'desc')
    )
    const unsubIdeas = onSnapshot(ideasQuery, (snap) => {
      const ideasData: Idea[] = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          experimentId: id,
          content: data.content,
          imageData: data.imageData || undefined,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      })
      setIdeas(ideasData)
    })

    return () => { unsubExp(); unsubIdeas() }
  }, [user, id])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [ideaText])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (!experiment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/experiments')} className="flex items-center gap-2 text-primary mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <p className="text-slate-400 text-center py-12">Experiment not found</p>
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

  async function addIdea(e: React.FormEvent) {
    e.preventDefault()
    if ((!ideaText.trim() && !pendingImage) || !id || !user) return
    const now = Timestamp.now()
    const ideaData: Record<string, unknown> = {
      content: ideaText.trim(),
      createdAt: now,
      updatedAt: now,
    }
    if (pendingImage) {
      ideaData.imageData = pendingImage
    }
    await addDoc(collection(firestore, 'users', user.uid, 'experiments', id, 'ideas'), ideaData)
    await updateDoc(doc(firestore, 'users', user.uid, 'experiments', id), { updatedAt: now })
    setIdeaText('')
    setPendingImage(null)
  }

  async function deleteIdea(ideaId: string) {
    if (!user || !id || !confirm('Delete this idea?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'experiments', id, 'ideas', ideaId))
    await updateDoc(doc(firestore, 'users', user.uid, 'experiments', id), { updatedAt: Timestamp.now() })
  }

  async function saveEdit(ideaId: string) {
    if (!editText.trim() || !user || !id) return
    const now = Timestamp.now()
    await updateDoc(doc(firestore, 'users', user.uid, 'experiments', id, 'ideas', ideaId), {
      content: editText.trim(),
      updatedAt: now,
    })
    await updateDoc(doc(firestore, 'users', user.uid, 'experiments', id), { updatedAt: now })
    setEditingId(null)
    setEditText('')
  }

  function startEdit(idea: Idea) {
    setEditingId(idea.id)
    setEditText(idea.content)
  }

  async function handleExport() {
    if (!experiment) return
    await exportExperiment(experiment, ideas)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/experiments')}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Experiments</span>
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Experiment Info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{experiment.name}</h1>
        {experiment.description && (
          <p className="text-slate-500 mt-1">{experiment.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Created {new Date(experiment.createdAt).toLocaleDateString()} &middot; {ideas.length} ideas
        </p>
      </div>

      {/* Add Idea Form */}
      <form onSubmit={addIdea} className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-accent focus-within:border-transparent">
          <textarea
            ref={textareaRef}
            value={ideaText}
            onChange={e => setIdeaText(e.target.value)}
            placeholder="Add an idea..."
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-base resize-none focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addIdea(e)
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

            {(ideaText.trim() || pendingImage) && (
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark active:scale-95 transition-all disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {uploading ? 'Processing...' : 'Add Idea'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Ideas List */}
      {ideas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No ideas yet. Start brainstorming!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map(idea => (
            <div key={idea.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              {editingId === idea.id ? (
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
                      onClick={() => saveEdit(idea.id)}
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
                <>
                  {idea.imageData && (
                    <div
                      className="w-full mb-3 rounded-lg overflow-hidden border border-slate-100 relative"
                      role="button"
                      tabIndex={0}
                      onPointerUp={() => setLightboxImage(idea.imageData!)}
                    >
                      <img
                        src={idea.imageData}
                        alt="Idea photo"
                        className="w-full rounded-lg"
                        draggable={false}
                      />
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                        Tap to zoom
                      </div>
                    </div>
                  )}
                  {idea.content && (
                    <p className="text-slate-800 whitespace-pre-wrap">{idea.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(idea.createdAt)}
                      {idea.updatedAt > idea.createdAt && ' (edited)'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(idea)}
                        className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Image Lightbox - rendered via portal to document.body */}
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
