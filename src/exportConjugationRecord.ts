import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  CHECKLIST_ITEMS,
  AKTA_GRADIENT_MODES,
  AKTA_DEFAULT_PATH_LENGTH_CM,
  calcTotalMassUg,
  calcAmountNmol,
  calcYieldPercent,
  calcDilutionVolume,
  calcAktaAuc,
  getAllVariants,
  calcVariantVolumes,
  getPostExMedianMgPerMl,
  getFinalMedianMgPerMl,
  calcMolarityUm,
  calcTheoreticalA280,
  ATTACHMENT_LABELS,
  type ConjugationRecord,
  type AdapterVariant,
  type AttachmentKind,
  type RecordAttachment,
} from './conjugationRecord'

function getVariant(name: string, record: ConjugationRecord): AdapterVariant | undefined {
  return getAllVariants(record).find(v => v.name === name)
}

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return '—'
  return v.toFixed(decimals)
}

function check(v: boolean | null | undefined): string {
  return v ? '☑' : '☐'
}

const PRIMARY = '#312783'
const GRAY = '#64748b'
const LIGHT_GRAY = '#94a3b8'

export function exportConjugationRecordPDF(r: ConjugationRecord, attachments: RecordAttachment[] = []) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ── Helper functions ─────────────────────────────────────────────

  function addTitle(text: string) {
    pdf.setFontSize(18)
    pdf.setTextColor(PRIMARY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(text, margin, y)
    y += 8
  }

  function addSubtitle(text: string) {
    pdf.setFontSize(10)
    pdf.setTextColor(GRAY)
    pdf.setFont('helvetica', 'normal')
    pdf.text(text, margin, y)
    y += 6
  }

  function addSectionHeader(num: number, title: string) {
    checkPageBreak(15)
    y += 4
    // Colored bar
    pdf.setFillColor(PRIMARY)
    pdf.rect(margin, y - 4, 3, 8, 'F')
    pdf.setFontSize(13)
    pdf.setTextColor(PRIMARY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${num}. ${title}`, margin + 6, y + 2)
    y += 10
  }

  function addSubsection(title: string) {
    checkPageBreak(10)
    pdf.setFontSize(10)
    pdf.setTextColor('#1e293b')
    pdf.setFont('helvetica', 'bold')
    pdf.text(title, margin, y)
    y += 5
  }

  function addText(text: string, options?: { bold?: boolean; color?: string; size?: number }) {
    pdf.setFontSize(options?.size || 9)
    pdf.setTextColor(options?.color || '#334155')
    pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal')
    const lines = pdf.splitTextToSize(text, contentWidth)
    pdf.text(lines, margin, y)
    y += lines.length * 4
  }

  function addField(label: string, value: string) {
    pdf.setFontSize(8)
    pdf.setTextColor(GRAY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(label + ':', margin, y)
    const labelWidth = pdf.getTextWidth(label + ':') + 3
    pdf.setFontSize(9)
    pdf.setTextColor('#1e293b')
    pdf.setFont('helvetica', 'normal')
    pdf.text(value || '________________', margin + labelWidth, y)
    y += 6
  }

  function addFieldPair(label1: string, value1: string, label2: string, value2: string) {
    const halfWidth = contentWidth / 2
    pdf.setFontSize(8)
    pdf.setTextColor(GRAY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(label1 + ':', margin, y)
    const lw1 = pdf.getTextWidth(label1 + ':') + 3
    pdf.setFontSize(9)
    pdf.setTextColor('#1e293b')
    pdf.setFont('helvetica', 'normal')
    pdf.text(value1 || '________________', margin + lw1, y)

    pdf.setFontSize(8)
    pdf.setTextColor(GRAY)
    pdf.setFont('helvetica', 'bold')
    pdf.text(label2 + ':', margin + halfWidth, y)
    const lw2 = pdf.getTextWidth(label2 + ':') + 3
    pdf.setFontSize(9)
    pdf.setTextColor('#1e293b')
    pdf.setFont('helvetica', 'normal')
    pdf.text(value2 || '________________', margin + halfWidth + lw2, y)
    y += 6
  }

  function addTable(head: string[][], body: string[][]) {
    checkPageBreak(10 + body.length * 6)
    autoTable(pdf, {
      startY: y,
      head,
      body,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, right: 2, bottom: 2, left: 3 },
        lineColor: '#e2e8f0',
        lineWidth: 0.2,
        halign: 'left',
        valign: 'middle',
      },
      headStyles: { fillColor: PRIMARY, textColor: '#ffffff', fontStyle: 'bold', fontSize: 7.5, halign: 'left' },
      alternateRowStyles: { fillColor: '#f8fafc' },
      theme: 'grid',
    })
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5
  }

  function addChecklist(keys: string[]) {
    for (const key of keys) {
      checkPageBreak(6)
      const checked = r.checklists?.[key] || false
      pdf.setFontSize(9)
      pdf.setTextColor(checked ? '#16a34a' : '#334155')
      pdf.setFont('helvetica', 'normal')
      pdf.text(check(checked), margin + 3, y)
      pdf.setTextColor('#334155')
      const lines = pdf.splitTextToSize(CHECKLIST_ITEMS[key], contentWidth - 12)
      pdf.text(lines, margin + 10, y)
      y += lines.length * 4 + 1
    }
    y += 2
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pdf.internal.pageSize.getHeight() - 15) {
      pdf.addPage()
      y = margin
    }
  }

  function addWarning(text: string) {
    checkPageBreak(8)
    pdf.setFillColor('#fffbeb')
    pdf.setDrawColor('#fbbf24')
    pdf.roundedRect(margin, y - 3, contentWidth, 7, 1, 1, 'FD')
    pdf.setFontSize(7.5)
    pdf.setTextColor('#92400e')
    pdf.setFont('helvetica', 'bold')
    pdf.text('⚠ ' + text, margin + 3, y + 1)
    pdf.setFont('helvetica', 'normal')
    y += 7
  }

  /**
   * Render every attached photo of a given kind, two per row, each labelled
   * with its tube number. Images keep their aspect ratio.
   */
  function addPhotos(kind: AttachmentKind) {
    const photos = attachments
      .filter(a => a.kind === kind && a.tubeIndex < r.tubeCount)
      .sort((a, b) => a.tubeIndex - b.tubeIndex || a.createdAt.getTime() - b.createdAt.getTime())
    if (photos.length === 0) return

    addSubsection(ATTACHMENT_LABELS[kind] + 's')

    const gap = 5
    const colWidth = (contentWidth - gap) / 2
    let col = 0
    let rowHeight = 0

    for (const photo of photos) {
      let imgHeight = colWidth * 0.66
      try {
        const props = pdf.getImageProperties(photo.dataUrl)
        imgHeight = (props.height / props.width) * colWidth
      } catch (err) {
        console.error('Could not read image for PDF:', err)
        continue
      }

      // Start a new row (and page, if needed) before placing a left-column image
      if (col === 0) {
        checkPageBreak(imgHeight + 8)
        rowHeight = 0
      }

      const x = margin + col * (colWidth + gap)
      pdf.setFontSize(7)
      pdf.setTextColor(GRAY)
      pdf.setFont('helvetica', 'bold')
      pdf.text(`Tube ${photo.tubeIndex + 1}`, x, y)
      pdf.addImage(photo.dataUrl, 'JPEG', x, y + 1.5, colWidth, imgHeight)

      rowHeight = Math.max(rowHeight, imgHeight + 5)
      col++
      if (col === 2) {
        col = 0
        y += rowHeight + 4
      }
    }
    // Flush a trailing half-row
    if (col === 1) y += rowHeight + 4
    pdf.setFont('helvetica', 'normal')
  }

  const tubeNums = Array.from({ length: r.tubeCount }, (_, i) => i)

  // ══════════════════════════════════════════════════════════════════
  // DOCUMENT
  // ══════════════════════════════════════════════════════════════════

  // Title block
  addTitle('FOCAL MOLOGRAPHY ADAPTERS')
  y -= 2
  addTitle('ADAPTER CONJUGATION RECORD')
  y -= 2
  addSubtitle('AMINE-REACTIVE CHEMISTRY')
  y += 2
  addFieldPair('Document ID', 'AP-REC-01', 'Version', '1.0')
  addFieldPair('SOP Reference', 'AP-DOC-01', 'Batch', r.name)
  y += 2
  pdf.setDrawColor(PRIMARY)
  pdf.setLineWidth(0.5)
  pdf.line(margin, y, pageWidth - margin, y)
  y += 6

  // ── Section 1 ──
  addSectionHeader(1, 'BATCH IDENTITY')
  addFieldPair('Date Started', r.dateStarted, 'Date Finished', r.dateFinished)
  addField('Prepared By', r.preparedBy)
  y += 2

  // Tube assignment table
  addTable(
    [['Tube', 'Adapter Variant', 'Oligo ID', 'Lot Number']],
    tubeNums.map(i => [
      String(i + 1),
      r.tubes[i].adapterVariant || '—',
      r.tubes[i].oligoId || '—',
      r.tubes[i].lotNumber || '—',
    ])
  )

  // ── Section 2 ──
  const lr = r.mixingRatioLinker ?? 2
  const or_ = r.mixingRatioOligo ?? 2.5
  const allVariants = getAllVariants(r)

  addSectionHeader(2, 'ADAPTER SPECIFICATIONS')
  addText(`Mixing Ratio (Protein : Linker : Oligo): 1 : ${lr} : ${or_}`, { size: 8, color: GRAY })
  y += 2

  addSubsection('2.1 Protein & Adapter Properties')
  addTable(
    [['Adapter Variant', 'MW Protein (kDa)', 'MW Adapter (kDa)', 'ε₂₈₀ Protein', 'ε₂₈₀ Adapter']],
    allVariants.map(v => [v.name, String(v.mwProtein), String(v.mwAdapter), v.e280Protein.toLocaleString(), v.e280Adapter.toLocaleString()])
  )

  // ── Section 3 ──
  addSectionHeader(3, 'BUFFER EXCHANGE')
  addField('Buffer exchange performed', r.bufferExchangeDone ? 'Yes' : 'No')

  // ── Section 4 ──
  addSectionHeader(4, 'INPUT QUANTIFICATION')
  addText('Method: NanoDrop, Protein A280, Blank with PBS-T.', { size: 8, color: GRAY })
  y += 2
  addSubsection('4.1 Measurements')
  addTable(
    [['Tube', 'Input', 'M1', 'M2', 'M3', 'Conc (mg/mL)', 'Molarity (µM)', 'Theo. A₂₈₀', 'Vol (µL)', 'Mass (µg)', 'Amount (nmol)', '≥ 900 µg?']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const mode = t.postExInputMode ?? 'a280'
      const modeLabel = mode === 'a280' ? 'A₂₈₀' : mode === 'manual' ? 'Manual (µM)' : mode === 'mass' ? 'Mass (µg)' : 'mg/mL'
      const medConc = getPostExMedianMgPerMl(t, variant)
      const vol = t.postExVolume
      const mass = mode === 'mass' ? (t.postExTotalMass ?? null) : calcTotalMassUg(medConc, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwProtein) : null
      const concUm = calcMolarityUm(medConc, variant?.mwProtein ?? null)
      const theoA280 = calcTheoreticalA280(medConc, variant?.mwProtein ?? null, variant?.e280Protein ?? null)
      const ok = mass !== null ? (mass >= 900 ? 'Yes' : 'No') : '—'
      const readings = mode === 'a280' || mode === 'conc'
      const m1 = readings ? fmt(t.postExM1) : '—'
      const m2 = readings ? fmt(t.postExM2) : '—'
      const m3 = readings ? fmt(t.postExM3) : '—'
      return [String(i + 1), modeLabel, m1, m2, m3, fmt(medConc), fmt(concUm, 2), fmt(theoA280, 3), fmt(vol, 0), fmt(mass, 1), fmt(amount, 2), ok]
    })
  )

  addSubsection('4.2 Linker & Oligo Volumes (per tube)')
  addText('Input mass derived from measured post-exchange mass. Ratio (Protein : Linker : Oligo) = 1 : ' + lr + ' : ' + or_, { size: 8, color: GRAY })
  y += 2
  addTable(
    [['Tube', 'Variant', 'Input Mass (mg)', 'Linker (nmol)', 'Linker (µL)', 'Oligo (nmol)', 'Oligo (µL)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const medConc = getPostExMedianMgPerMl(t, variant)
      const vol = t.postExVolume
      const mass = calcTotalMassUg(medConc, vol)
      const inputMg = mass !== null ? mass / 1000 : null
      if (!variant || inputMg === null) {
        return [String(i + 1), t.adapterVariant || '—', '—', '—', '—', '—', '—']
      }
      const vols = calcVariantVolumes(variant.mwProtein, lr, or_, inputMg)
      return [String(i + 1), variant.name, fmt(inputMg, 3), fmt(vols.linkerAmount, 2), fmt(vols.linkerVolume, 1), fmt(vols.oligoAmount, 2), fmt(vols.oligoVolume, 0)]
    })
  )

  // ── Section 5 ──
  addSectionHeader(5, 'PROCESS EXECUTION')
  addSubsection('5.1 Protein Activation')
  addField('Start Time', r.activationStartTime)
  addChecklist(['activation_addition', 'activation_mixing', 'activation_incubation'])

  addSubsection('5.2 Oligo Conjugation')
  addField('Start Time', r.conjugationStartTime)
  addChecklist(['conjugation_addition', 'conjugation_mixing', 'conjugation_incubation'])
  addField('End Time', r.conjugationEndTime)

  // ── Section 6 ──
  addSectionHeader(6, 'AKTA PURIFICATION')
  addSubsection('6.1 Purification Runs')
  addTable(
    [['Tube', 'Gradient', 'Top-up', 'Collected Fractions', 'Collected Vol (µL)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const gradient = AKTA_GRADIENT_MODES.find(m => m.value === t.aktaGradientMode)?.label || '—'
      return [String(i + 1), gradient, check(t.aktaTopUp), t.aktaFractionsCollected || '—', fmt(t.aktaCollectedVolume, 0)]
    })
  )

  // Custom gradients carry free-text notes that do not fit the table.
  const customGradients = tubeNums.filter(i => r.tubes[i].aktaGradientMode === 'custom' && (r.tubes[i].aktaGradientNotes || '').trim())
  if (customGradients.length > 0) {
    addSubsection('6.2 Custom Gradient Notes')
    for (const i of customGradients) {
      addField(`Tube ${i + 1}`, r.tubes[i].aktaGradientNotes)
    }
    y += 2
  }

  addSubsection(`${customGradients.length > 0 ? '6.3' : '6.2'} AUC Quantification`)
  addText('n = AUC / (ε₂₈₀ Adapter × l × 10⁶); mass = n × MW Adapter; conc = n / collected volume.', { size: 8, color: GRAY })
  y += 2
  addTable(
    [['Tube', 'Variant', 'AUC (mAU·mL)', 'Path (cm)', 'Collected Vol (µL)', 'Amount (nmol)', 'Mass (µg)', 'Conc (µM)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const res = calcAktaAuc(
        t.aktaAuc ?? null,
        variant?.e280Adapter ?? null,
        t.aktaAucPathLength ?? AKTA_DEFAULT_PATH_LENGTH_CM,
        variant?.mwAdapter ?? null,
        t.aktaCollectedVolume
      )
      return [
        String(i + 1), t.adapterVariant || '—', fmt(t.aktaAuc ?? null, 1),
        fmt(t.aktaAucPathLength ?? AKTA_DEFAULT_PATH_LENGTH_CM, 2), fmt(t.aktaCollectedVolume, 0),
        fmt(res.amountNmol, 2), fmt(res.massUg, 1), fmt(res.concUm, 2),
      ]
    })
  )
  addPhotos('akta')

  // ── Section 7 ──
  addSectionHeader(7, 'FINAL BUFFER EXCHANGE')
  addText('Filter: 10K Amicon, 2.0 mL format. Centrifugation: 7k rcf.', { size: 8, color: GRAY })
  y += 2
  addWarning('Align 2.0 mL filters with Membrane Panel facing OUTWARDS')
  addField('Concentration cycles', r.finalBufferExchangeCycles !== null && r.finalBufferExchangeCycles !== undefined ? `${r.finalBufferExchangeCycles}×` : '—')

  // ── Section 8 ──
  addSectionHeader(8, 'FINAL QUANTIFICATION')
  addText('Method: NanoDrop, Protein A280, Blank with PBS-T. Use ε₂₈₀ Adapter (not Protein).', { size: 8, color: GRAY })
  y += 2
  addTable(
    [['Tube', 'Input', 'M1', 'M2', 'M3', 'Median (mg/mL)', 'Vol (µL)', 'Mass (µg)', 'MW Adapt (kDa)', 'Amount (nmol)', 'Conc (µM)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const mode = t.finalInputMode ?? 'conc'
      const modeLabel = mode === 'a280' ? 'A₂₈₀' : 'mg/mL'
      const medConc = getFinalMedianMgPerMl(t, variant)
      const vol = t.finalVolume
      const mass = calcTotalMassUg(medConc, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwAdapter) : null
      const concUm = amount !== null && vol !== null && vol > 0 ? (amount / vol) * 1000 : null
      return [String(i + 1), modeLabel, fmt(t.finalM1), fmt(t.finalM2), fmt(t.finalM3), fmt(medConc), fmt(vol, 0), fmt(mass, 1), variant ? String(variant.mwAdapter) : '—', fmt(amount, 2), fmt(concUm, 2)]
    })
  )

  // ── Section 9 ──
  addSectionHeader(9, 'ALIQUOTING & STORAGE')
  addSubsection('9.1 Dilution to Target Concentration (2.6 µM)')
  addTable(
    [['Tube', 'Amount (nmol)', 'Conc (µM)', 'Target Volume (µL)', 'Current Volume (µL)', 'Buffer to Add (µL)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const med = getFinalMedianMgPerMl(t, variant)
      const vol = t.finalVolume
      const mass = calcTotalMassUg(med, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwAdapter) : null
      const concUm = amount !== null && vol !== null && vol > 0 ? (amount / vol) * 1000 : null
      const { targetVolumeUl } = calcDilutionVolume(amount, 2.6)
      const bufferToAdd = targetVolumeUl !== null && vol !== null ? Math.max(0, targetVolumeUl - vol) : null
      return [String(i + 1), fmt(amount, 2), fmt(concUm, 2), fmt(targetVolumeUl, 1), fmt(vol, 0), fmt(bufferToAdd, 1)]
    })
  )

  addSubsection('9.2–9.3 Aliquoting & Inventory')
  addChecklist(['aliquot_adjustment', 'aliquot_mixing', 'aliquot_dispensing', 'aliquot_inventory', 'aliquot_labeling'])
  addTable(
    [['Tube', 'Adapter Variant', 'Total Aliquots', 'Lot Number (eLabNext)', 'Labels ✓']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', t.aliquotCount != null ? String(t.aliquotCount) : '—', t.aliquotLotNumber || '—', check(t.aliquotLabelsVerified)]
    })
  )

  addSubsection('9.4 Storage')
  addChecklist(['aliquot_storage'])
  addFieldPair('Storage Location', r.storageLocation, 'Calculated Expiry', r.calculatedExpiry)

  // ── Section 10 ──
  addSectionHeader(10, 'QUALITY CONTROL')
  addSubsection('10.1 Yield Assessment')
  addTable(
    [['Tube', 'Adapter', 'Start (nmol)', 'Final (nmol)', 'Yield %', 'Status']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const postMed = getPostExMedianMgPerMl(t, variant)
      const postVol = t.postExVolume
      const postMass = calcTotalMassUg(postMed, postVol)
      const startAmt = variant ? calcAmountNmol(postMass, variant.mwProtein) : null
      const finalMed = getFinalMedianMgPerMl(t, variant)
      const finalVol = t.finalVolume
      const finalMass = calcTotalMassUg(finalMed, finalVol)
      const finalAmt = variant ? calcAmountNmol(finalMass, variant.mwAdapter) : null
      const yieldPct = calcYieldPercent(startAmt, finalAmt)
      return [
        String(i + 1), t.adapterVariant || '—', fmt(startAmt, 2), fmt(finalAmt, 2),
        yieldPct !== null ? `${yieldPct.toFixed(1)}%` : '—',
        t.yieldStatus ? t.yieldStatus.toUpperCase() : '—',
      ]
    })
  )

  addSubsection('10.2 Purity & Identity (SDS-PAGE)')
  addFieldPair('Experiment Ref', r.sdsExperimentRef, 'Load Amount', r.sdsLoadAmount)
  addFieldPair('Staining Start', r.sdsStainStart, 'Staining End', r.sdsStainEnd)
  y += 2
  addTable(
    [['Tube', 'Adapter', 'MW Shift?', 'Free < 10%?', 'Purity Status']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', t.sdsMwShift ? 'Yes' : t.sdsMwShift === false ? 'No' : '—', t.sdsFreeProteinUnder10 ? 'Yes' : t.sdsFreeProteinUnder10 === false ? 'No' : '—', t.sdsPurityStatus ? t.sdsPurityStatus.toUpperCase() : '—']
    })
  )

  addSubsection('10.3 Functional QC (Focal Molography)')
  addField('Experiment Ref', r.qcExperimentRef)
  y += 2
  addTable(
    [['Tube', 'Adapter', 'Immob. Ratio', 'Activity Ratio', 'k_off (s⁻¹)', 'Status']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', fmt(t.qcImmobRatio, 3), fmt(t.qcActivityRatio, 3), fmt(t.qcKoff, 6), t.qcStatus ? t.qcStatus.toUpperCase() : '—']
    })
  )
  addPhotos('fm')

  // ── Section 11 ──
  addSectionHeader(11, 'FINAL DISPOSITION')
  addSubsection('11.1 Batch Review')
  addChecklist(['review_coa', 'review_documentation'])
  addField('Deviations', r.hasDeviations ? `Yes (NCR #${r.deviationNcrNumber})` : 'None')
  y += 2

  addSubsection('11.2 Final Decision')
  addTable(
    [['Tube', 'Adapter Variant', 'CoA Reference', 'Disposition']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', t.coaReference || '—', t.disposition ? t.disposition.toUpperCase() : '—']
    })
  )

  addSubsection('11.3 Release Authorization')
  y += 2
  addTable(
    [['Role', 'Name', 'Date']],
    [
      ['Operator', r.releaseOperatorName || '________________', r.releaseOperatorDate || '________________'],
      ['QC / QM', r.releaseQcName || '________________', r.releaseQcDate || '________________'],
    ]
  )

  // ── Comments Appendix ─────────────────────────────────────────────
  const sectionNames: Record<string, string> = {
    s1: '1. Batch Identity',
    s2: '2. Adapter Specifications',
    s3: '3. Buffer Exchange',
    s4: '4. Input Quantification',
    s5: '5. Process Execution',
    s6: '6. AKTA Purification',
    s7: '7. Final Buffer Exchange',
    s8: '8. Final Quantification',
    s9: '9. Aliquoting & Storage',
    s10: '10. Quality Control',
    s11: '11. Final Disposition',
  }

  const comments = Object.entries(r.sectionComments || {})
    .filter(([, v]) => v && v.trim().length > 0)
    .sort(([a], [b]) => {
      const na = parseInt(a.replace('s', ''))
      const nb = parseInt(b.replace('s', ''))
      return na - nb
    })

  if (comments.length > 0) {
    pdf.addPage()
    y = margin

    // Appendix title
    pdf.setFontSize(16)
    pdf.setTextColor(PRIMARY)
    pdf.setFont('helvetica', 'bold')
    pdf.text('APPENDIX — COMMENTS & IMPROVEMENT NOTES', margin, y)
    y += 8

    pdf.setDrawColor(PRIMARY)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, pageWidth - margin, y)
    y += 8

    for (const [key, value] of comments) {
      checkPageBreak(20)

      // Section label
      pdf.setFontSize(10)
      pdf.setTextColor(PRIMARY)
      pdf.setFont('helvetica', 'bold')
      pdf.text(sectionNames[key] || key, margin, y)
      y += 5

      // Comment text
      pdf.setFontSize(9)
      pdf.setTextColor('#334155')
      pdf.setFont('helvetica', 'normal')
      const lines = pdf.splitTextToSize(value, contentWidth - 5)

      // Light background box
      const boxHeight = lines.length * 4 + 4
      pdf.setFillColor('#fffbeb')
      pdf.setDrawColor('#fcd34d')
      pdf.roundedRect(margin, y - 2, contentWidth, boxHeight, 1, 1, 'FD')

      pdf.text(lines, margin + 3, y + 2)
      y += boxHeight + 4
    }
  }

  // ── Footer on every page ─────────────────────────────────────────
  const pageCount = pdf.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p)
    const pageH = pdf.internal.pageSize.getHeight()
    pdf.setFontSize(7)
    pdf.setTextColor(LIGHT_GRAY)
    pdf.text(`Lino Biotech · Focal Molography · AP-REC-01 v1.0`, margin, pageH - 8)
    pdf.text(`${r.name} · Generated from LabNotes`, margin, pageH - 5)
    pdf.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageH - 5, { align: 'right' })
  }

  // Save
  const filename = `${r.name.replace(/[^a-zA-Z0-9]/g, '_')}_AP-REC-01.pdf`
  pdf.save(filename)
}
