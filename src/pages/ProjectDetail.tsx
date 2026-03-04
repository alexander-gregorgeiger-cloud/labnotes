import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { firestore, storage } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Download, Trash2, Edit3, Check, X, Camera, Image, Loader2 } from 'lucide-react'
import { exportProject } from '../export'
import type { Project, Note } from '../db'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteText, setNoteText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user || !id) return
    const projectRef = doc(firestore, 'users', user.uid, 'projects', id)
    const unsubProject = onSnapshot(projectRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setProject({
          id: snap.id,
          name: data.name,
          description: data.description || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        })
      }
      setLoading(false)
    })

    const notesQuery = query(
      collection(firestore, 'users', user.uid, 'projects', id, 'notes'),
      orderBy('createdAt', 'desc')
    )
    const unsubNotes = onSnapshot(notesQuery, (snap) => {
      const notesData: Note[] = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          projectId: id,
          content: data.content,
          imageUrl: data.imageUrl || undefined,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      })
      setNotes(notesData)
    })

    return () => { unsubProject(); unsubNotes() }
  }, [user, id])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [noteText])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 text-center text-slate-400">
        Loading...
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-primary mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <p className="text-slate-400 text-center py-12">Project not found</p>
      </div>
    )
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  function removeImagePreview() {
    setImageFile(null)
    setImagePreview(null)
  }

  async function uploadImage(file: File): Promise<string> {
    if (!user || !id) throw new Error('Not authenticated')
    const filename = `${Date.now()}_${file.name}`
    const storageRef = ref(storage, `users/${user.uid}/projects/${id}/${filename}`)
    await uploadBytes(storageRef, file)
    return getDownloadURL(storageRef)
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if ((!noteText.trim() && !imageFile) || !id || !user) return
    setUploading(true)
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        imageUrl = await uploadImage(imageFile)
      }
      const now = Timestamp.now()
      const noteData: Record<string, unknown> = {
        content: noteText.trim(),
        createdAt: now,
        updatedAt: now,
      }
      if (imageUrl) noteData.imageUrl = imageUrl
      await addDoc(collection(firestore, 'users', user.uid, 'projects', id, 'notes'), noteData)
      await updateDoc(doc(firestore, 'users', user.uid, 'projects', id), { updatedAt: now })
      setNoteText('')
      setImageFile(null)
      setImagePreview(null)
    } finally {
      setUploading(false)
    }
  }

  async function deleteNote(noteId: string, imageUrl?: string) {
    if (!user || !id || !confirm('Delete this note?')) return
    // Try to delete the image from storage
    if (imageUrl) {
      try {
        const imageRef = ref(storage, imageUrl)
        await deleteObject(imageRef)
      } catch { /* image may already be deleted */ }
    }
    await deleteDoc(doc(firestore, 'users', user.uid, 'projects', id, 'notes', noteId))
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', id), { updatedAt: Timestamp.now() })
  }

  async function saveEdit(noteId: string) {
    if (!editText.trim() || !user || !id) return
    const now = Timestamp.now()
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', id, 'notes', noteId), {
      content: editText.trim(),
      updatedAt: now,
    })
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', id), { updatedAt: now })
    setEditingId(null)
    setEditText('')
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditText(note.content)
  }

  async function handleExport() {
    if (!project) return
    await exportProject(project, notes)
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
          <span>Projects</span>
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>

      {/* Project Info */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
        {project.description && (
          <p className="text-slate-500 mt-1">{project.description}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Created {new Date(project.createdAt).toLocaleDateString()} &middot; {notes.length} notes
        </p>
      </div>

      {/* Add Note Form */}
      <form onSubmit={addNote} className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary-light focus-within:border-transparent">
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-base resize-none focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                addNote(e)
              }
            }}
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="px-4 pb-2">
              <div className="relative inline-block">
                <img src={imagePreview} alt="Preview" className="h-24 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={removeImagePreview}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between px-4 pb-3">
            <div className="flex items-center gap-1">
              {/* Camera button - opens camera on mobile */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-accent hover:bg-orange-50 rounded-lg transition-colors"
                title="Take photo"
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* Gallery button - opens photo picker */}
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-accent hover:bg-orange-50 rounded-lg transition-colors"
                title="Choose from gallery"
              >
                <Image className="w-5 h-5" />
              </button>
            </div>

            {(noteText.trim() || imageFile) && (
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-1.5 bg-accent text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark active:scale-95 transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Add Note</>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No notes yet. Start documenting your experiment!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    autoFocus
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light text-base resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(note.id)}
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
                  {/* Note Image */}
                  {note.imageUrl && (
                    <div className="mb-3">
                      <img
                        src={note.imageUrl}
                        alt="Note attachment"
                        className="w-full max-h-64 object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => setExpandedImage(note.imageUrl!)}
                      />
                    </div>
                  )}
                  {note.content && (
                    <p className="text-slate-800 whitespace-pre-wrap">{note.content}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(note.createdAt)}
                      {note.updatedAt > note.createdAt && ' (edited)'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteNote(note.id, note.imageUrl)}
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

      {/* Fullscreen Image Viewer */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            onClick={() => setExpandedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={expandedImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
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
