import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, Timestamp } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { firestore, auth } from '../firebase'
import { useAuth } from '../AuthContext'
import { Plus, FlaskConical, Trash2, FolderOpen, LogOut, Calculator, ExternalLink } from 'lucide-react'
import type { Project } from '../db'

export default function ProjectList() {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<(Project & { noteCount?: number })[] | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'projects'),
      orderBy('updatedAt', 'desc')
    )
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const projectsData: (Project & { noteCount?: number })[] = []
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data()
        const notesSnap = await getDocs(collection(firestore, 'users', user.uid, 'projects', docSnap.id, 'notes'))
        projectsData.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          noteCount: notesSnap.size,
        })
      }
      setProjects(projectsData)
    }, (err) => {
      console.error('Firestore error:', err)
      setError(err.message)
      setProjects([])
    })
    return unsubscribe
  }, [user])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user) return
    setError('')
    try {
      const now = Timestamp.now()
      const docRef = await addDoc(collection(firestore, 'users', user.uid, 'projects'), {
        name: name.trim(),
        description: description.trim(),
        createdAt: now,
        updatedAt: now,
      })
      setName('')
      setDescription('')
      setShowForm(false)
      navigate(`/project/${docRef.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project'
      console.error('Create project error:', err)
      setError(message)
    }
  }

  async function deleteProject(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!user || !confirm('Delete this project and all its notes?')) return
    const notesSnap = await getDocs(collection(firestore, 'users', user.uid, 'projects', id, 'notes'))
    for (const noteDoc of notesSnap.docs) {
      await deleteDoc(noteDoc.ref)
    }
    await deleteDoc(doc(firestore, 'users', user.uid, 'projects', id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">LabNotes</h1>
            <p className="text-sm text-slate-500">Your digital lab notebook</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark active:scale-95 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={() => signOut(auth)}
            className="w-10 h-10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full flex items-center justify-center transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tools */}
      <div className="mb-4">
        <a
          href="https://alexander-gregorgeiger-cloud.github.io/Conjugation-calculator/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all"
        >
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Calculator className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <span className="font-medium text-slate-900 text-sm">Conjugation Calculator</span>
            <p className="text-xs text-slate-400">Open lab tool</p>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-300" />
        </a>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl mb-4 border border-red-200">
          {error}
        </div>
      )}

      {/* New Project Form */}
      {showForm && (
        <form onSubmit={createProject} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-3">New Project</h2>
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent text-base"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent text-base resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-primary text-white py-2 rounded-lg font-medium hover:bg-primary-dark active:scale-[0.98] transition-all"
            >
              Create Project
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

      {/* Projects List */}
      {!projects ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-400 mb-2">No projects yet</h2>
          <p className="text-slate-400 mb-6">Create your first experiment project</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-white px-6 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors"
          >
            New Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span>{project.noteCount ?? 0} notes</span>
                    <span>Updated {formatDate(project.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={e => deleteProject(e, project.id)}
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
