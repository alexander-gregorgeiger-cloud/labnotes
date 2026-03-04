import { saveAs } from 'file-saver'
import type { Project, Note } from './db'

export async function exportProject(project: Project, notes: Note[]) {
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const line = '════════════════════════════════════════'
  let text = `${project.name}\n${line}\n\n`

  if (project.description) {
    text += `${project.description}\n\n`
  }

  text += `Created:     ${new Date(project.createdAt).toLocaleDateString()}\n`
  text += `Exported:    ${new Date().toLocaleDateString()}\n`
  text += `Total Notes: ${notes.length}\n\n`
  text += `${line}\n\n`

  for (const note of sortedNotes) {
    const date = new Date(note.createdAt)
    const timestamp = date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    text += `[${timestamp}]\n`
    text += `${note.content}\n\n`
  }

  text += `${line}\nExported from LabNotes\n`

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_labnotes.txt`
  saveAs(blob, filename)
}
