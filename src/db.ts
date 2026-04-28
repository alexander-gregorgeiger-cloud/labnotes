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

export interface Idea {
  id: string
  experimentId: string
  content: string
  imageData?: string
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
