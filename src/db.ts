import Dexie, { type EntityTable } from 'dexie'

export interface Project {
  id: string
  name: string
  description: string
  createdAt: Date
  updatedAt: Date
}

export interface Note {
  id: string
  projectId: string
  content: string
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
