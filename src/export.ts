import { saveAs } from 'file-saver'
import type { Project, Note } from './db'

export async function exportProject(project: Project, notes: Note[]) {
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  let markdown = `# ${project.name}\n\n`

  if (project.description) {
    markdown += `> ${project.description}\n\n`
  }

  markdown += `**Created:** ${new Date(project.createdAt).toLocaleDateString()}\n`
  markdown += `**Exported:** ${new Date().toLocaleDateString()}\n`
  markdown += `**Total Notes:** ${notes.length}\n\n`
  markdown += `---\n\n`

  for (const note of sortedNotes) {
    const date = new Date(note.createdAt)
    const timestamp = date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    markdown += `### ${timestamp}\n\n`
    markdown += `${note.content}\n\n`
  }

  markdown += `---\n*Exported from LabNotes*\n`

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_labnotes.md`
  saveAs(blob, filename)
}
