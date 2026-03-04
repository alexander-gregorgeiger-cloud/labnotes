import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Note } from '../db'
import { ArrowLeft, Plus, Download, Trash2, Edit3, Check, X } from 'lucide-react'
import { exportProject } from '../export'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [noteText, setNoteText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const project = useLiveQuery(() =>
    id ? db.projects.get(id) : undefined
  , [id])

  const notes = useLiveQuery(() =>
    id ? db.notes.where('projectId').equals(id).reverse().sortBy('createdAt') : []
  , [id])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [noteText])

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

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim() || !id) return
    const now = new Date()
    const note: Note = {
      id: crypto.randomUUID(),
      projectId: id,
      content: noteText.trim(),
      createdAt: now,
      updatedAt: now,
    }
    await db.notes.add(note)
    await db.projects.update(id, { updatedAt: now })
    setNoteText('')
  }

  async function deleteNote(noteId: string) {
    if (!confirm('Delete this note?')) return
    await db.notes.delete(noteId)
    if (id) await db.projects.update(id, { updatedAt: new Date() })
  }

  async function saveEdit(noteId: string) {
    if (!editText.trim()) return
    await db.notes.update(noteId, { content: editText.trim(), updatedAt: new Date() })
    if (id) await db.projects.update(id, { updatedAt: new Date() })
    setEditingId(null)
    setEditText('')
  }

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditText(note.content)
  }

  async function handleExport() {
    if (!project || !notes) return
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
          Created {new Date(project.createdAt).toLocaleDateString()} &middot; {notes?.length ?? 0} notes
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
          {noteText.trim() && (
            <div className="flex items-center justify-between px-4 pb-3">
              <span className="text-xs text-slate-400">Cmd+Enter to save</span>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-dark active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Note
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Notes List */}
      {!notes || notes.length === 0 ? (
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
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
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
                  <p className="text-slate-800 whitespace-pre-wrap">{note.content}</p>
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
                        onClick={() => deleteNote(note.id)}
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
