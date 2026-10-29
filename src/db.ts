import Dexie, { type EntityTable } from 'dexie'
import type { AnalysisData } from './thiolinkCalc'

export interface Project {
  id: string
  name: string
  description: string
  colorLegend?: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

export interface ThioLinkSnapshot {
  title: string
  analysisData: AnalysisData
  yields: {
    conjugationYield: number
    recoveryYield: number
    oligoRemovalYield: number
    productYield: number
  }
  capturedAt: Date
}

export interface Note {
  id: string
  projectId: string
  content: string
  imageData?: string
  color?: string
  // Optional discriminator for special note types. Absent on plain notes.
  type?: 'thiolink'
  // Snapshot data for type === 'thiolink' notes.
  thiolinkData?: ThioLinkSnapshot
  createdAt: Date
  updatedAt: Date
}

export interface Experiment {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Idea {
  id: string
  experimentId: string
  content: string
  imageData?: string
  // Absent on plain ideas; 'checklist' ideas carry `items` instead of free text.
  type?: 'checklist'
  items?: ChecklistItem[]
  // Id of the To-Do list this checklist was imported into.
  migratedTo?: string
  createdAt: Date
  updatedAt: Date
}

export type TodoPriority = 'none' | 'low' | 'medium' | 'high'

export interface TodoComment {
  id: string
  text: string
  createdAt: number
}

export interface TodoList {
  id: string
  name: string
  order: number
  source?: string
  createdAt: Date
  updatedAt: Date
}

export interface Todo {
  id: string
  listId: string
  text: string
  done: boolean
  priority: TodoPriority
  // YYYY-MM-DD, empty string when unset.
  dueDate: string
  order: number
  comments: TodoComment[]
  createdAt: Date
  updatedAt: Date
}

export interface ConjugationRecordMeta {
  id: string
  name: string
  preparedBy: string
  dateStarted: string
  tubeCount: number
  createdAt: Date
  updatedAt: Date
}

export interface Memo {
  id: string
  content: string
  imageData?: string
  done?: boolean
  createdAt: Date
  updatedAt: Date
}

const db = new Dexie('LabNotesDB') as Dexie & {
  projects: EntityTable<Project, 'id'>
  notes: EntityTable<Note, 'id'>
}

db.version(1).stores({
  projects: 'id, name, createdAt, updatedAt',
  notes: 'id, projectId, createdAt, updatedAt',
})

export { db }
