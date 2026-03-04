import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { Project, Note } from './db'

export async function exportProject(project: Project, notes: Note[]) {
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const zip = new JSZip()
  let photoCount = 0

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

    if (note.imageData) {
      photoCount++
      const photoFilename = `photo_${photoCount}.jpg`
      // Extract base64 data after the data URL prefix
      const base64Data = note.imageData.split(',')[1]
      zip.file(photoFilename, base64Data, { base64: true })
      text += `[See: ${photoFilename}]\n`
    }

    if (note.content) {
      text += `${note.content}\n`
    }
    text += `\n`
  }

  text += `${line}\nExported from LabNotes\n`

  zip.file('notes.txt', text)

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_labnotes.zip`
  saveAs(blob, filename)
}
