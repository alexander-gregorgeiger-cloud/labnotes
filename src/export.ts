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
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx'
import type { Project, Note, Experiment, Idea } from './db'
import {
  type AnalysisData,
  type Component as ThioComponent,
  calcComponent as utilCalcComponent,
  calcEpsilon as utilCalcEpsilon,
  calcMW as utilCalcMW,
} from './thiolinkCalc'

function base64ToUint8Array(base64: string): Uint8Array {
  const data = base64.split(',')[1]
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Helpers for rendering ThioLink snapshots inside project DOCX exports.

const PCT = (v: number) => `${(v * 100).toFixed(1)}%`
const NUM = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'

function inputDescription(c: ThioComponent): string {
  const mode = c.inputMode || 'av'
  if (mode === 'cv') return `${c.conc || '—'} mg/mL × ${c.vol || '—'} µL`
  if (mode === 'mv') return `${c.molarConc || '—'} µM × ${c.vol || '—'} µL`
  return `A·V ${c.av || '—'} mA·mL`
}

function inputModeLabel(c: ThioComponent): string {
  const mode = c.inputMode || 'av'
  if (mode === 'cv') return 'C+V'
  if (mode === 'mv') return 'M+V'
  return 'A×V'
}

function headerCell(text: string): TableCell {
  return new TableCell({
    width: { size: 1, type: WidthType.AUTO },
    shading: { fill: 'F1F5F9' },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 16, bold: true, color: '475569' })],
    })],
  })
}

function bodyCell(text: string, opts: { bold?: boolean; color?: string } = {}): TableCell {
  return new TableCell({
    width: { size: 1, type: WidthType.AUTO },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, bold: opts.bold, color: opts.color || '334155' })],
    })],
  })
}

function componentTable(
  title: string,
  components: ThioComponent[],
  data: AnalysisData,
): Paragraph | Table | null {
  if (!components || components.length === 0) return null
  const rows: TableRow[] = []
  rows.push(new TableRow({
    tableHeader: true,
    children: [
      headerCell('Component'),
      headerCell('Ratio'),
      headerCell('Mode'),
      headerCell('Input'),
      headerCell('ε (1/M·cm)'),
      headerCell('MW (Da)'),
      headerCell('n (nmol)'),
      headerCell('m (µg)'),
    ],
  }))
  for (const c of components) {
    const r = utilCalcComponent(data, c)
    const eps = utilCalcEpsilon(data, c.oligoRatio)
    const mw = utilCalcMW(data, c.oligoRatio)
    rows.push(new TableRow({
      children: [
        bodyCell(c.name || '—', { bold: true }),
        bodyCell(c.oligoRatio === '0' ? 'protein' : c.oligoRatio === 'NA' ? 'oligo' : `1:${c.oligoRatio}`),
        bodyCell(inputModeLabel(c)),
        bodyCell(inputDescription(c)),
        bodyCell(eps > 0 ? eps.toFixed(0) : '—'),
        bodyCell(mw > 0 ? mw.toFixed(0) : '—'),
        bodyCell(r.valid ? NUM(r.n, 3) : '—', { color: '312783', bold: true }),
        bodyCell(r.valid ? NUM(r.m, 1) : '—', { color: 'F39200', bold: true }),
      ],
    }))
  }
  // Wrap in a labelled paragraph above + table
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  })
  // Title is rendered separately by caller for layout flexibility
  // (return null path also handled by caller)
  void title
}

async function renderThioLinkSnapshot(
  note: Note,
  out: (Paragraph | Table)[],
): Promise<void> {
  if (note.type !== 'thiolink' || !note.thiolinkData) return
  const t = note.thiolinkData
  const data = t.analysisData

  // Title
  out.push(new Paragraph({
    children: [new TextRun({ text: t.title, size: 24, bold: true, color: '312783' })],
    spacing: { after: 80 },
  }))

  // Global settings
  if (data) {
    out.push(new Paragraph({
      children: [
        new TextRun({ text: 'Global: ', size: 18, color: '64748b' }),
        new TextRun({ text: `A280/A260 corr. ${data.correctionFactor || '1.55'}`, size: 18, color: '334155' }),
        new TextRun({ text: '   ·   ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `Path length ${data.pathLength || '0.2'} cm`, size: 18, color: '334155' }),
      ],
      spacing: { after: 60 },
    }))
    out.push(new Paragraph({
      children: [
        new TextRun({ text: 'Protein: ', size: 18, color: '64748b', bold: true }),
        new TextRun({ text: `${data.proteinName || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'ε₂₈₀ ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.proteinE280 || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'ε₂₆₀ ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.proteinE260 || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'MW ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.proteinMW || '—'} Da`, size: 18, color: '334155' }),
      ],
      spacing: { after: 40 },
    }))
    out.push(new Paragraph({
      children: [
        new TextRun({ text: 'Oligo: ', size: 18, color: '64748b', bold: true }),
        new TextRun({ text: `${data.oligoName || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'ε₂₈₀ ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.oligoE280 || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'ε₂₆₀ ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.oligoE260 || '—'}  `, size: 18, color: '334155' }),
        new TextRun({ text: 'MW ', size: 18, color: '94a3b8' }),
        new TextRun({ text: `${data.oligoMW || '—'} Da`, size: 18, color: '334155' }),
      ],
      spacing: { after: 120 },
    }))

    // Control table
    out.push(new Paragraph({
      children: [new TextRun({ text: 'Control (Pre-conjugation)', size: 18, bold: true, color: '475569' })],
      spacing: { after: 40 },
    }))
    const ctrl = componentTable('Control', data.controlComponents || [], data)
    if (ctrl) out.push(ctrl)
    out.push(new Paragraph({ spacing: { after: 100 } }))

    // Test table
    out.push(new Paragraph({
      children: [new TextRun({ text: 'Test (Post-conjugation)', size: 18, bold: true, color: '475569' })],
      spacing: { after: 40 },
    }))
    const test = componentTable('Test', data.testComponents || [], data)
    if (test) out.push(test)
    out.push(new Paragraph({ spacing: { after: 120 } }))
  }

  // Yields summary
  out.push(new Paragraph({
    children: [new TextRun({ text: 'Results Summary', size: 18, bold: true, color: '475569' })],
    spacing: { after: 40 },
  }))
  out.push(new Paragraph({
    children: [
      new TextRun({ text: 'Conjugation: ', size: 20, color: '64748b' }),
      new TextRun({ text: PCT(t.yields.conjugationYield), size: 20, bold: true, color: '312783' }),
      new TextRun({ text: '   |   Recovery: ', size: 20, color: '64748b' }),
      new TextRun({ text: PCT(t.yields.recoveryYield), size: 20, bold: true, color: 'F39200' }),
      new TextRun({ text: '   |   Oligo Removal: ', size: 20, color: '64748b' }),
      new TextRun({ text: PCT(t.yields.oligoRemovalYield), size: 20, bold: true, color: '059669' }),
      new TextRun({ text: '   |   Product (1:1): ', size: 20, color: '64748b' }),
      new TextRun({ text: PCT(t.yields.productYield), size: 20, bold: true, color: '7e22ce' }),
    ],
    spacing: { after: 100 },
  }))

  // Per-conjugate breakdown (recompute from snapshot)
  if (data) {
    const conjugates = (data.testComponents || []).filter(c => c.oligoRatio !== '0' && c.oligoRatio !== 'NA')
    if (conjugates.length > 0) {
      const testProtein = (data.testComponents || []).find(c => c.oligoRatio === '0')
      const controlProtein = (data.controlComponents || []).find(c => c.oligoRatio === '0')
      const nTestProtein = testProtein ? utilCalcComponent(data, testProtein).n : 0
      const mControlProtein = controlProtein ? utilCalcComponent(data, controlProtein).m : 0
      const totalConjN = conjugates.reduce((s, c) => s + utilCalcComponent(data, c).n, 0)
      const totalTestN = nTestProtein + totalConjN
      const pMW = parseFloat(data.proteinMW) || 0

      out.push(new Paragraph({
        children: [new TextRun({ text: 'Per-conjugate breakdown', size: 16, bold: true, color: '94a3b8' })],
        spacing: { after: 40 },
      }))
      for (const c of conjugates) {
        const r = utilCalcComponent(data, c)
        const conjY = totalTestN > 0 ? r.n / totalTestN : 0
        const recY = mControlProtein > 0 ? (r.n * pMW / 1e3) / mControlProtein : 0
        out.push(new Paragraph({
          children: [
            new TextRun({ text: `${c.name}  `, size: 18, color: '334155' }),
            new TextRun({ text: `${PCT(conjY)} conj.`, size: 18, bold: true, color: '312783' }),
            new TextRun({ text: '   ', size: 18 }),
            new TextRun({ text: `${PCT(recY)} rec.`, size: 18, bold: true, color: 'F39200' }),
          ],
          spacing: { after: 30 },
        }))
      }
    }
  }
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

  const children: (Paragraph | Table)[] = []

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

  // Color Legend
  if (project.colorLegend) {
    const legendOrder = [
      '#E53935', '#D4A574', '#FFEE58', '#42A5F5',
      '#EC407A', '#FFA726', '#AB47BC', '#9CCC65',
      '#FFFFFF',
    ]
    const entries = legendOrder
      .filter(hex => project.colorLegend?.[hex])
      .map(hex => ({ hex, label: project.colorLegend![hex] }))

    if (entries.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Color Legend', size: 20, bold: true, color: '312783' })],
          spacing: { before: 80 },
        })
      )
      for (let i = 0; i < entries.length; i += 2) {
        const runs: TextRun[] = []
        runs.push(new TextRun({ text: '● ', size: 22, color: entries[i].hex.replace('#', ''), bold: true }))
        runs.push(new TextRun({ text: entries[i].label, size: 20, color: '334155' }))
        if (entries[i + 1]) {
          runs.push(new TextRun({ text: '          ', size: 20 }))
          runs.push(new TextRun({ text: '● ', size: 22, color: entries[i + 1].hex.replace('#', ''), bold: true }))
          runs.push(new TextRun({ text: entries[i + 1].label, size: 20, color: '334155' }))
        }
        children.push(new Paragraph({ children: runs }))
      }
      children.push(new Paragraph({ spacing: { after: 80 } }))
    }
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

    // Timestamp header (with color dot if tagged)
    const timestampRuns: TextRun[] = []
    if (note.color) {
      timestampRuns.push(new TextRun({ text: '● ', size: 22, color: note.color.replace('#', ''), bold: true }))
    }
    timestampRuns.push(new TextRun({ text: timestamp, size: 18, color: 'F39200', bold: true }))
    children.push(
      new Paragraph({
        children: timestampRuns,
        spacing: { before: 200 },
      })
    )

    // ThioLink snapshot — render full setup + results
    if (note.type === 'thiolink' && note.thiolinkData) {
      await renderThioLinkSnapshot(note, children)
    } else if (note.imageData) {
      // Photo
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

    // Text content (caption — applies to all note types)
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

export async function exportExperiment(experiment: Experiment, ideas: Idea[]) {
  const sortedIdeas = [...ideas].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: experiment.name, bold: true, size: 36, color: 'F39200' })],
    })
  )

  if (experiment.description) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: experiment.description, italics: true, size: 24, color: '64748b' })],
        spacing: { after: 100 },
      })
    )
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Created: ${new Date(experiment.createdAt).toLocaleDateString()}   |   `, size: 20, color: '94a3b8' }),
        new TextRun({ text: `Exported: ${new Date().toLocaleDateString()}   |   `, size: 20, color: '94a3b8' }),
        new TextRun({ text: `${ideas.length} ideas`, size: 20, color: '94a3b8' }),
      ],
      spacing: { after: 200 },
    })
  )

  children.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'F39200' } },
      spacing: { after: 300 },
    })
  )

  for (const idea of sortedIdeas) {
    const date = new Date(idea.createdAt)
    const timestamp = date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    children.push(
      new Paragraph({
        children: [new TextRun({ text: timestamp, size: 18, color: '312783', bold: true })],
        spacing: { before: 200 },
      })
    )

    if (idea.imageData) {
      const imageBytes = base64ToUint8Array(idea.imageData)
      const dims = await getImageDimensions(idea.imageData)
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

    if (idea.content) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: idea.content, size: 22 })],
          spacing: { after: 100 },
        })
      )
    }

    children.push(
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' } },
        spacing: { after: 200 },
      })
    )
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Exported from LabNotes — Experimental Planning', size: 18, color: '94a3b8', italics: true })],
      spacing: { before: 300 },
    })
  )

  const doc = new Document({
    sections: [{ children }],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${experiment.name.replace(/[^a-zA-Z0-9]/g, '_')}_experiment.docx`
  saveAs(blob, filename)
}
