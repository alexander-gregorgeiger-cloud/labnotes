import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch, Timestamp,
} from 'firebase/firestore'
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCorners, useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft, ListTodo, Plus, Check, X, Trash2, Edit3, GripVertical, Flag, CalendarDays, MessageSquare,
  ArrowDownWideNarrow, Eye, EyeOff, Download,
} from 'lucide-react'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import type { Todo, TodoList, TodoPriority, TodoComment, ChecklistItem } from '../db'

const PRIORITIES: { value: TodoPriority; label: string; rank: number; text: string; bg: string }[] = [
  { value: 'none', label: 'None', rank: 0, text: 'text-slate-300', bg: 'bg-slate-100 text-slate-500' },
  { value: 'low', label: 'Low', rank: 1, text: 'text-blue-500', bg: 'bg-blue-100 text-blue-700' },
  { value: 'medium', label: 'Medium', rank: 2, text: 'text-amber-500', bg: 'bg-amber-100 text-amber-700' },
  { value: 'high', label: 'High', rank: 3, text: 'text-red-500', bg: 'bg-red-100 text-red-700' },
]
const priorityOf = (p: TodoPriority) => PRIORITIES.find(x => x.value === p) ?? PRIORITIES[0]

const LIST_PREFIX = 'list:'
type Columns = Record<string, string[]>

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueInfo(dueDate: string, done: boolean): { label: string; className: string } | null {
  if (!dueDate) return null
  const today = todayStr()
  const pretty = new Date(dueDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (done) return { label: pretty, className: 'bg-slate-100 text-slate-400' }
  if (dueDate < today) return { label: `Overdue · ${pretty}`, className: 'bg-red-100 text-red-700' }
  if (dueDate === today) return { label: 'Today', className: 'bg-orange-100 text-accent' }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const t = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  if (dueDate === t) return { label: 'Tomorrow', className: 'bg-blue-100 text-blue-700' }
  return { label: pretty, className: 'bg-slate-100 text-slate-600' }
}

function findContainer(cols: Columns, id: string): string | undefined {
  if (id.startsWith(LIST_PREFIX)) return id.slice(LIST_PREFIX.length)
  return Object.keys(cols).find(k => cols[k].includes(id))
}

interface LegacyChecklist {
  experimentId: string
  experimentName: string
  ideaId: string
  title: string
  items: ChecklistItem[]
}

export default function Todos() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [lists, setLists] = useState<TodoList[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [newListName, setNewListName] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragColumns, setDragColumns] = useState<Columns | null>(null)
  const [legacy, setLegacy] = useState<LegacyChecklist[]>([])
  const [importing, setImporting] = useState(false)
  const draggingRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!user) return
    const base = ['users', user.uid] as const
    const unsubLists = onSnapshot(query(collection(firestore, ...base, 'todoLists'), orderBy('createdAt', 'desc')), snap => {
      setLists(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name || '',
          order: data.order ?? 0,
          source: data.source || undefined,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      }))
      setLoading(false)
    })
    const unsubTodos = onSnapshot(collection(firestore, ...base, 'todos'), snap => {
      setTodos(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          listId: data.listId,
          text: data.text || '',
          done: !!data.done,
          priority: (data.priority as TodoPriority) || 'none',
          dueDate: data.dueDate || '',
          order: data.order ?? 0,
          comments: Array.isArray(data.comments) ? (data.comments as TodoComment[]) : [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        }
      }))
      if (!draggingRef.current) setDragColumns(null)
    })
    return () => { unsubLists(); unsubTodos() }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const found: LegacyChecklist[] = []
      const exps = await getDocs(collection(firestore, 'users', user.uid, 'experiments'))
      for (const exp of exps.docs) {
        const ideas = await getDocs(collection(firestore, 'users', user.uid, 'experiments', exp.id, 'ideas'))
        for (const idea of ideas.docs) {
          const data = idea.data()
          if (data.type === 'checklist' && !data.migratedTo) {
            found.push({
              experimentId: exp.id,
              experimentName: exp.data().name || 'Experiment',
              ideaId: idea.id,
              title: data.content || '',
              items: Array.isArray(data.items) ? (data.items as ChecklistItem[]) : [],
            })
          }
        }
      }
      if (!cancelled) setLegacy(found)
    })().catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const todosById = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos])

  const grouped = useMemo(() => {
    const cols: Columns = {}
    for (const l of lists) cols[l.id] = []
    const sorted = [...todos].sort((a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime())
    for (const t of sorted) cols[t.listId]?.push(t.id)
    return cols
  }, [lists, todos])

  const columns = dragColumns ?? grouped

  const today = todayStr()
  const openCount = todos.filter(t => !t.done).length
  const overdueCount = todos.filter(t => !t.done && t.dueDate && t.dueDate < today).length
  const dueTodayCount = todos.filter(t => !t.done && t.dueDate === today).length

  const todoCol = (uid: string) => collection(firestore, 'users', uid, 'todos')

  async function persistColumns(cols: Columns) {
    if (!user) return false
    const batch = writeBatch(firestore)
    let changes = 0
    for (const [listId, ids] of Object.entries(cols)) {
      ids.forEach((id, index) => {
        const t = todosById.get(id)
        if (t && (t.listId !== listId || t.order !== index)) {
          batch.update(doc(firestore, 'users', user.uid, 'todos', id), { listId, order: index, updatedAt: Timestamp.now() })
          changes++
        }
      })
    }
    if (changes) await batch.commit()
    return changes > 0
  }

  function handleDragStart(e: DragStartEvent) {
    draggingRef.current = true
    setActiveId(String(e.active.id))
    setDragColumns(columns)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const a = String(active.id)
    const o = String(over.id)
    setDragColumns(prev => {
      const cols = prev ?? columns
      const from = findContainer(cols, a)
      const to = findContainer(cols, o)
      if (!from || !to || from === to) return cols
      const toItems = [...cols[to]]
      let index = o.startsWith(LIST_PREFIX) ? toItems.length : toItems.indexOf(o)
      const translated = active.rect.current.translated
      if (!o.startsWith(LIST_PREFIX) && translated && translated.top > over.rect.top + over.rect.height / 2) index += 1
      toItems.splice(index, 0, a)
      return { ...cols, [from]: cols[from].filter(i => i !== a), [to]: toItems }
    })
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    let cols = dragColumns ?? columns
    if (over) {
      const a = String(active.id)
      const o = String(over.id)
      const from = findContainer(cols, a)
      const to = findContainer(cols, o)
      if (from && to && from === to && a !== o && !o.startsWith(LIST_PREFIX)) {
        cols = { ...cols, [from]: arrayMove(cols[from], cols[from].indexOf(a), cols[to].indexOf(o)) }
        setDragColumns(cols)
      }
    }
    draggingRef.current = false
    setActiveId(null)
    const changed = await persistColumns(cols).catch(() => false)
    if (!changed) setDragColumns(null)
  }

  function handleDragCancel() {
    draggingRef.current = false
    setActiveId(null)
    setDragColumns(null)
  }

  async function addList(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !newListName.trim()) return
    const now = Timestamp.now()
    await addDoc(collection(firestore, 'users', user.uid, 'todoLists'), {
      name: newListName.trim(),
      order: lists.reduce((m, l) => Math.max(m, l.order), -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    setNewListName('')
  }

  async function renameList(listId: string, name: string) {
    if (!user || !name.trim()) return
    await updateDoc(doc(firestore, 'users', user.uid, 'todoLists', listId), { name: name.trim(), updatedAt: Timestamp.now() })
  }

  async function deleteList(list: TodoList) {
    if (!user) return
    const count = (columns[list.id] ?? []).length
    if (!confirm(count ? `Delete "${list.name}" and its ${count} task${count === 1 ? '' : 's'}?` : `Delete "${list.name}"?`)) return
    const batch = writeBatch(firestore)
    for (const id of columns[list.id] ?? []) batch.delete(doc(firestore, 'users', user.uid, 'todos', id))
    batch.delete(doc(firestore, 'users', user.uid, 'todoLists', list.id))
    await batch.commit()
  }

  async function addTodo(listId: string, text: string) {
    if (!user || !text.trim()) return
    const now = Timestamp.now()
    const order = (columns[listId] ?? []).reduce((m, id) => Math.max(m, (todosById.get(id)?.order ?? -1)), -1) + 1
    await addDoc(todoCol(user.uid), {
      listId, text: text.trim(), done: false, priority: 'none', dueDate: '', order, comments: [],
      createdAt: now, updatedAt: now,
    })
  }

  async function updateTodo(id: string, patch: Record<string, unknown>) {
    if (!user) return
    await updateDoc(doc(firestore, 'users', user.uid, 'todos', id), { ...patch, updatedAt: Timestamp.now() })
  }

  async function deleteTodo(id: string) {
    if (!user || !confirm('Delete this task?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'todos', id))
    if (expandedId === id) setExpandedId(null)
  }

  async function sortListByPriority(listId: string) {
    const ids = columns[listId] ?? []
    const sorted = ids
      .map((id, index) => ({ t: todosById.get(id)!, index }))
      .filter(x => x.t)
      .sort((a, b) =>
        Number(a.t.done) - Number(b.t.done) ||
        priorityOf(b.t.priority).rank - priorityOf(a.t.priority).rank ||
        (a.t.dueDate || '9999').localeCompare(b.t.dueDate || '9999') ||
        a.index - b.index
      )
      .map(x => x.t.id)
    await persistColumns({ ...columns, [listId]: sorted })
  }

  async function importChecklists() {
    if (!user || legacy.length === 0) return
    setImporting(true)
    try {
      let order = lists.reduce((m, l) => Math.max(m, l.order), -1) + 1
      for (const c of legacy) {
        const now = Timestamp.now()
        const listRef = doc(collection(firestore, 'users', user.uid, 'todoLists'))
        const batch = writeBatch(firestore)
        batch.set(listRef, {
          name: c.title || c.experimentName,
          source: c.title ? c.experimentName : '',
          order: order++,
          createdAt: now,
          updatedAt: now,
        })
        c.items.forEach((item, index) => {
          batch.set(doc(todoCol(user.uid)), {
            listId: listRef.id, text: item.text, done: !!item.done, priority: 'none', dueDate: '', order: index, comments: [],
            createdAt: now, updatedAt: now,
          })
        })
        batch.update(doc(firestore, 'users', user.uid, 'experiments', c.experimentId, 'ideas', c.ideaId), { migratedTo: listRef.id })
        await batch.commit()
      }
      setLegacy([])
    } catch {
      alert('Import failed. Nothing was lost — you can try again.')
    } finally {
      setImporting(false)
    }
  }

  const activeTodo = activeId ? todosById.get(activeId) : undefined

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 text-primary hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
            <ListTodo className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">To-Do</h1>
            <p className="text-sm text-slate-500">
              {todos.length === 0
                ? 'Lists, priorities & due dates'
                : [`${openCount} open`, overdueCount ? `${overdueCount} overdue` : '', dueTodayCount ? `${dueTodayCount} due today` : '']
                    .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setHideDone(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          title={hideDone ? 'Show completed' : 'Hide completed'}
        >
          {hideDone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden sm:inline">{hideDone ? 'Completed hidden' : 'Completed shown'}</span>
        </button>
      </div>

      {legacy.length > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-3">
          <Download className="w-5 h-5 text-accent shrink-0" />
          <p className="flex-1 text-sm text-slate-700">
            {legacy.length} checklist{legacy.length === 1 ? '' : 's'} in Experimental Planning can be moved here as lists.
          </p>
          <button
            onClick={importChecklists}
            disabled={importing}
            className="px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-dark disabled:opacity-50 transition-colors"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-slate-400 py-12">Loading...</p>
          ) : lists.length === 0 ? (
            <p className="text-center text-slate-400 py-12">No lists yet. Create your first one below.</p>
          ) : (
            lists.map(list => (
              <ListSection
                key={list.id}
                list={list}
                ids={(columns[list.id] ?? []).filter(id => !(hideDone && todosById.get(id)?.done))}
                todosById={todosById}
                expandedId={expandedId}
                onExpand={id => setExpandedId(prev => (prev === id ? null : id))}
                onRename={name => renameList(list.id, name)}
                onDelete={() => deleteList(list)}
                onSort={() => sortListByPriority(list.id)}
                onAdd={text => addTodo(list.id, text)}
                onUpdate={updateTodo}
                onDeleteTodo={deleteTodo}
              />
            ))
          )}
        </div>
        <DragOverlay>
          {activeTodo && (
            <div className="flex items-center gap-2 bg-white rounded-xl border border-accent shadow-lg px-3 py-2.5">
              <GripVertical className="w-4 h-4 text-slate-400" />
              <span className="text-slate-800 truncate">{activeTodo.text}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <form onSubmit={addList} className="mt-6 flex gap-2">
        <input
          value={newListName}
          onChange={e => setNewListName(e.target.value)}
          placeholder="New list..."
          className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!newListName.trim()}
          className="flex items-center gap-1.5 bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-accent-dark active:scale-95 transition-all disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Add list
        </button>
      </form>
    </div>
  )
}

interface ListSectionProps {
  list: TodoList
  ids: string[]
  todosById: Map<string, Todo>
  expandedId: string | null
  onExpand: (id: string) => void
  onRename: (name: string) => void
  onDelete: () => void
  onSort: () => void
  onAdd: (text: string) => void
  onUpdate: (id: string, patch: Record<string, unknown>) => void
  onDeleteTodo: (id: string) => void
}

function ListSection({ list, ids, todosById, expandedId, onExpand, onRename, onDelete, onSort, onAdd, onUpdate, onDeleteTodo }: ListSectionProps) {
  const { setNodeRef, isOver } = useDroppable({ id: LIST_PREFIX + list.id })
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(list.name)
  const [text, setText] = useState('')
  const all = ids.map(id => todosById.get(id)).filter((t): t is Todo => !!t)
  const doneCount = all.filter(t => t.done).length

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-2xl border shadow-sm p-3 transition-colors ${isOver ? 'border-accent' : 'border-slate-200'}`}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        {editing ? (
          <form
            className="flex-1 flex items-center gap-1"
            onSubmit={e => { e.preventDefault(); onRename(name); setEditing(false) }}
          >
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-base font-semibold focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" className="p-1.5 text-accent hover:bg-orange-50 rounded-lg" aria-label="Save name">
              <Check className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setName(list.name); setEditing(false) }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900 truncate">{list.name}</h2>
              {list.source && <p className="text-xs text-slate-400 truncate">from {list.source}</p>}
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">{doneCount}/{all.length}</span>
            <button onClick={onSort} className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors" title="Sort by priority, then due date" aria-label="Sort by priority">
              <ArrowDownWideNarrow className="w-4 h-4" />
            </button>
            <button onClick={() => { setName(list.name); setEditing(true) }} className="p-1.5 text-slate-300 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors" aria-label="Rename list">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label="Delete list">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="min-h-[2.5rem] space-y-1">
          {all.map(todo => (
            <TaskRow
              key={todo.id}
              todo={todo}
              expanded={expandedId === todo.id}
              onExpand={() => onExpand(todo.id)}
              onUpdate={patch => onUpdate(todo.id, patch)}
              onDelete={() => onDeleteTodo(todo.id)}
            />
          ))}
          {all.length === 0 && <p className="text-sm text-slate-300 text-center py-2">Drop tasks here</p>}
        </div>
      </SortableContext>

      <form
        className="flex items-center gap-2 mt-2 px-1"
        onSubmit={e => { e.preventDefault(); onAdd(text); setText('') }}
      >
        <Plus className="w-4 h-4 text-slate-300 shrink-0" />
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add task..."
          className="flex-1 text-base py-1.5 border-b border-transparent focus:border-accent focus:outline-none placeholder:text-slate-300"
        />
      </form>
    </div>
  )
}

interface TaskRowProps {
  todo: Todo
  expanded: boolean
  onExpand: () => void
  onUpdate: (patch: Record<string, unknown>) => void
  onDelete: () => void
}

function TaskRow({ todo, expanded, onExpand, onUpdate, onDelete }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })
  const due = dueInfo(todo.dueDate, todo.done)
  const prio = priorityOf(todo.priority)
  const [commentText, setCommentText] = useState('')
  const [text, setText] = useState(todo.text)

  function addComment() {
    if (!commentText.trim()) return
    const comment: TodoComment = { id: newId(), text: commentText.trim(), createdAt: Date.now() }
    onUpdate({ comments: [...todo.comments, comment] })
    setCommentText('')
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border ${expanded ? 'border-slate-200 bg-slate-50' : 'border-transparent'} ${isDragging ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="p-1 text-slate-300 hover:text-slate-500 cursor-grab touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdate({ done: !todo.done })}
          className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
            todo.done ? 'bg-accent border-accent text-white' : 'border-slate-300 hover:border-accent'
          }`}
          aria-label={todo.done ? 'Mark as not done' : 'Mark as done'}
        >
          {todo.done && <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onExpand} className="flex-1 min-w-0 text-left">
          <span className={`block ${todo.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{todo.text}</span>
          {(due || todo.comments.length > 0) && (
            <span className="flex items-center gap-2 mt-0.5">
              {due && (
                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${due.className}`}>
                  <CalendarDays className="w-3 h-3" /> {due.label}
                </span>
              )}
              {todo.comments.length > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <MessageSquare className="w-3 h-3" /> {todo.comments.length}
                </span>
              )}
            </span>
          )}
        </button>
        {todo.priority !== 'none' && <Flag className={`w-4 h-4 shrink-0 fill-current ${prio.text}`} aria-label={`${prio.label} priority`} />}
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={() => { if (text.trim() && text.trim() !== todo.text) onUpdate({ text: text.trim() }); else setText(todo.text) }}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Priority</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  onClick={() => onUpdate({ priority: p.value })}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    todo.priority === p.value ? `${p.bg} font-medium ring-1 ring-current` : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Due date</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={todo.dueDate}
                onChange={e => onUpdate({ dueDate: e.target.value })}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {todo.dueDate && (
                <button onClick={() => onUpdate({ dueDate: '' })} className="text-sm text-slate-400 hover:text-red-500">Clear</button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Comments</p>
            <div className="space-y-1.5">
              {todo.comments.map(c => (
                <div key={c.id} className="group flex items-start gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{c.text}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(c.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button
                    onClick={() => onUpdate({ comments: todo.comments.filter(x => x.id !== c.id) })}
                    className="p-1 text-slate-300 hover:text-red-500"
                    aria-label="Delete comment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment() } }}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-accent"
                />
                {commentText.trim() && (
                  <button onClick={addComment} className="p-1.5 text-accent hover:bg-orange-50 rounded-lg" aria-label="Add comment">
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={onDelete} className="flex items-center gap-1 text-sm text-slate-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
