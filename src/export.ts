import { saveAs } from 'file-saver'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from 'docx'
import type { Project, Note } from './db'

function base64ToUint8Array(base64: string): Uint8Array {
  const data = base64.split(',')[1]
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getImageDimensions(base64: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.width, height: img.height })
    img.onerror = () => resolve({ width: 600, height: 400 })
    img.src = base64
  })
}

export async function exportProject(project: Project, notes: Note[]) {
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const children: Paragraph[] = []

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: project.name, bold: true, size: 36, color: '312783' })],
    })
  )

  // Description
  if (project.description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: project.description, italics: true, size: 24, color: '64748b' })],
        spacing: { after: 100 },
      })
    )
  }

  // Meta info
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Created: ${new Date(project.createdAt).toLocaleDateString()}   |   `, size: 20, color: '94a3b8' }),
        new TextRun({ text: `Exported: ${new Date().toLocaleDateString()}   |   `, size: 20, color: '94a3b8' }),
        new TextRun({ text: `${notes.length} notes`, size: 20, color: '94a3b8' }),
      ],
      spacing: { after: 200 },
    })
  )

  // Divider
  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '312783' } },
      spacing: { after: 300 },
    })
  )

  // Notes
  for (const note of sortedNotes) {
    const date = new Date(note.createdAt)
    const timestamp = date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    // Timestamp header
    children.push(
      new Paragraph({
        children: [new TextRun({ text: timestamp, size: 18, color: 'F39200', bold: true })],
        spacing: { before: 200 },
      })
    )

    // Photo
    if (note.imageData) {
      const imageBytes = base64ToUint8Array(note.imageData)
      const dims = await getImageDimensions(note.imageData)
      const maxWidth = 500
      const scale = dims.width > maxWidth ? maxWidth / dims.width : 1
      const width = Math.round(dims.width * scale)
      const height = Math.round(dims.height * scale)

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: { width, height },
              type: 'jpg',
            }),
          ],
          spacing: { after: 100 },
        })
      )
    }

    // Text content
    if (note.content) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: note.content, size: 22 })],
          spacing: { after: 100 },
        })
      )
    }

    // Spacer between notes
    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' } },
        spacing: { after: 200 },
      })
    )
  }

  // Footer
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Exported from LabNotes', size: 18, color: '94a3b8', italics: true })],
      spacing: { before: 300 },
    })
  )

  const doc = new Document({
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_labnotes.docx`
  saveAs(blob, filename)
}
