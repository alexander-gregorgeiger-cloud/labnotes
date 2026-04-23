import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  CHECKLIST_ITEMS,
  OLIGO_MW_KDA,
  median3,
  calcTotalMassUg,
  calcAmountNmol,
  calcYieldPercent,
  calcDilutionVolume,
  calcOligoConcentrationUm,
  getAllVariants,
  calcVariantVolumes,
  type ConjugationRecord,
  type AdapterVariant,
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

export function exportConjugationRecordPDF(r: ConjugationRecord) {
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

  function addCritical(text: string) {
    checkPageBreak(8)
    pdf.setFillColor('#fef2f2')
    pdf.setDrawColor('#f87171')
    pdf.roundedRect(margin, y - 3, contentWidth, 7, 1, 1, 'FD')
    pdf.setFontSize(7.5)
    pdf.setTextColor('#991b1b')
    pdf.setFont('helvetica', 'bold')
    pdf.text('CRITICAL: ' + text, margin + 3, y + 1)
    pdf.setFont('helvetica', 'normal')
    y += 7
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
  const inputMg = r.inputMassPerTube ?? 1
  const allVariants = getAllVariants(r)

  addSectionHeader(2, 'ADAPTER SPECIFICATIONS')
  addText(`Standard Input: ${inputMg} mg protein per tube. Mixing Ratio (Protein : Linker : Oligo): 1 : ${lr} : ${or_}`, { size: 8, color: GRAY })
  y += 2

  addSubsection('2.1 Protein & Adapter Properties')
  addTable(
    [['Adapter Variant', 'MW Protein (kDa)', 'MW Adapter (kDa)', 'ε₂₈₀ Protein', 'ε₂₈₀ Adapter']],
    allVariants.map(v => [v.name, String(v.mwProtein), String(v.mwAdapter), v.e280Protein.toLocaleString(), v.e280Adapter.toLocaleString()])
  )

  addSubsection('2.2 Pre-Calculated Volumes per Tube (1 mg Input)')
  addTable(
    [['Variant', 'Protein (nmol)', 'Linker (nmol)', 'Linker Vol (µL)', 'Oligo (nmol)', 'Oligo Vol (µL)']],
    allVariants.map(v => {
      const vols = calcVariantVolumes(v.mwProtein, lr, or_, inputMg)
      return [v.name, vols.proteinAmount.toFixed(1), vols.linkerAmount.toFixed(1), vols.linkerVolume.toFixed(1), vols.oligoAmount.toFixed(1), vols.oligoVolume.toFixed(0)]
    })
  )

  addSubsection('2.3 Acceptance Criteria')
  addTable(
    [['Variant', 'Min Yield (%)', 'Activity (%)', 'k_off (s⁻¹)']],
    allVariants.map(v => {
      const ac = r.acceptanceCriteria?.[v.name]
      return [v.name, ac?.minYield != null ? String(ac.minYield) : '—', ac?.activity != null ? String(ac.activity) : '—', ac?.koff != null ? String(ac.koff) : '—']
    })
  )

  // ── Section 3 ──
  addSectionHeader(3, 'MATERIALS TRACEABILITY')
  addSubsection('3.1 Common Reagents & Consumables')
  addTable(
    [['Material Name', 'Internal ID', 'Vendor / Lot #', 'Verified']],
    (r.commonMaterials || []).map(m => [m.materialName, m.internalId, m.vendorLot || '—', check(m.verified)])
  )

  addSubsection('3.2 Variable Input Materials')
  addTable(
    [['Tube', 'Protein Lot #', 'Oligo Lot #']],
    tubeNums.map(i => [String(i + 1), r.tubes[i].proteinLot || '—', r.tubes[i].oligoLot || '—'])
  )

  // ── Section 4 ──
  addSectionHeader(4, 'BUFFER EXCHANGE')
  addSubsection('4.1 Protein Input Parameters')
  addTable(
    [['Tube', 'Conc (mg/mL)', 'Volume (mL)', 'Input Mass (mg)', '0.9–1.1 mg?']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const mass = t.inputConc !== null && t.inputVolume !== null ? t.inputConc * t.inputVolume : null
      const ok = mass !== null ? (mass >= 0.9 && mass <= 1.1 ? 'Yes' : 'No') : '—'
      return [String(i + 1), fmt(t.inputConc), fmt(t.inputVolume, 3), fmt(mass, 3), ok]
    })
  )

  addSubsection('4.2 Procedure')
  addWarning('Align all filters with Membrane Panel facing OUTWARDS')
  addChecklist(['bufex_prewash', 'bufex_load', 'bufex_wash1', 'bufex_wash2', 'bufex_wash3', 'bufex_recovery'])

  addSubsection('4.3 Recovery Parameters')
  addTable(
    [['Tube', 'Recovered Volume (µL)', 'Visual Check']],
    tubeNums.map(i => [String(i + 1), fmt(r.tubes[i].recoveredVolume, 0), r.tubes[i].recoveryVisualCheck || '—'])
  )

  // ── Section 5 ──
  addSectionHeader(5, 'POST-EXCHANGE QUANTIFICATION')
  addText('Method: NanoDrop, Protein A280, Blank with PBS-T.', { size: 8, color: GRAY })
  y += 2
  addTable(
    [['Tube', 'M1', 'M2', 'M3', 'Median (mg/mL)', 'Vol (µL)', 'Mass (µg)', 'Amount (nmol)', '≥ 900 µg?']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const med = median3(t.postExM1, t.postExM2, t.postExM3)
      const vol = t.postExVolume ?? t.recoveredVolume
      const mass = calcTotalMassUg(med, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwProtein) : null
      const ok = mass !== null ? (mass >= 900 ? 'Yes' : 'No') : '—'
      return [String(i + 1), fmt(t.postExM1), fmt(t.postExM2), fmt(t.postExM3), fmt(med), fmt(vol, 0), fmt(mass, 1), fmt(amount, 2), ok]
    })
  )

  // ── Section 6 ──
  addSectionHeader(6, 'REAGENT PREPARATION')
  addSubsection('6.1 Oligo Reconstitution')
  if ((r.oligoReconstitutions || []).length > 0) {
    addTable(
      [['Oligo ID', '# Tubes', 'Measured (ng/µL)', 'Calculated (µM)', '≥ 95 µM?']],
      (r.oligoReconstitutions || []).map(o => {
        const um = calcOligoConcentrationUm(o.measuredNgUl, OLIGO_MW_KDA)
        const ok = um !== null ? (um >= 95 ? 'Yes' : 'No') : '—'
        return [o.oligoId || '—', o.tubeCount != null ? String(o.tubeCount) : '—', fmt(o.measuredNgUl, 1), fmt(um, 1), ok]
      })
    )
  }

  addSubsection('6.2 Linker Working Solution')
  addChecklist(['linker_dilution', 'linker_mixing'])
  addCritical('Proceed to 7.1 Protein Activation immediately (within 2 min)')

  // ── Section 7 ──
  addSectionHeader(7, 'PROCESS EXECUTION')
  addSubsection('7.1 Protein Activation')
  addField('Start Time', r.activationStartTime)
  addChecklist(['activation_addition', 'activation_mixing', 'activation_incubation'])

  addSubsection('7.2 Oligo Conjugation')
  addField('Start Time', r.conjugationStartTime)
  addChecklist(['conjugation_addition', 'conjugation_mixing', 'conjugation_incubation'])
  addField('End Time', r.conjugationEndTime)

  // ── Section 8 ──
  addSectionHeader(8, 'AKTA PURIFICATION')
  addSubsection('8.1 System Setup & Verification')
  addChecklist(['akta_column', 'akta_buffer_inspect', 'akta_degas', 'akta_wash'])
  addFieldPair('Column Position', r.aktaColumnPosition, 'Method Name', r.aktaMethodName)
  y += 2

  addSubsection('8.2 Purification Runs')
  addTable(
    [['Tube', 'Top-up', 'Run Time', 'Result File', 'Fractions', 'Collected Vol (µL)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), check(t.aktaTopUp), t.aktaRunTime || '—', t.aktaResultFile || '—', t.aktaFractionsCollected || '—', fmt(t.aktaCollectedVolume, 0)]
    })
  )

  // ── Section 9 ──
  addSectionHeader(9, 'FINAL BUFFER EXCHANGE')
  addText('Filter: 10K Amicon, 2.0 mL format. Centrifugation: 7k rcf.', { size: 8, color: GRAY })
  y += 2
  addSubsection('9.1 Procedure')
  addWarning('Align 2.0 mL filters with Membrane Panel facing OUTWARDS')
  addChecklist(['finbufex_prewash', 'finbufex_load', 'finbufex_wash1', 'finbufex_wash2', 'finbufex_recovery'])

  addSubsection('9.2 Recovery Parameters')
  addTable(
    [['Tube', 'Recovered Volume (µL)', 'Visual Check']],
    tubeNums.map(i => [String(i + 1), fmt(r.tubes[i].finalRecoveredVolume, 0), r.tubes[i].finalVisualCheck || '—'])
  )

  // ── Section 10 ──
  addSectionHeader(10, 'FINAL QUANTIFICATION')
  addText('Method: NanoDrop, Protein A280, Blank with PBS-T. Use ε₂₈₀ Adapter (not Protein).', { size: 8, color: GRAY })
  y += 2
  addTable(
    [['Tube', 'M1', 'M2', 'M3', 'Median (mg/mL)', 'Vol (µL)', 'Mass (µg)', 'MW Adapt (kDa)', 'Amount (nmol)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const med = median3(t.finalM1, t.finalM2, t.finalM3)
      const vol = t.finalVolume ?? t.finalRecoveredVolume
      const mass = calcTotalMassUg(med, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwAdapter) : null
      return [String(i + 1), fmt(t.finalM1), fmt(t.finalM2), fmt(t.finalM3), fmt(med), fmt(vol, 0), fmt(mass, 1), variant ? String(variant.mwAdapter) : '—', fmt(amount, 2)]
    })
  )

  // ── Section 11 ──
  addSectionHeader(11, 'ALIQUOTING & STORAGE')
  addSubsection('11.1 Dilution to Target Concentration (2.6 µM)')
  addTable(
    [['Tube', 'Amount (nmol)', 'Target Volume (µL)', 'Current Volume (µL)', 'Buffer to Add (µL)']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const med = median3(t.finalM1, t.finalM2, t.finalM3)
      const vol = t.finalVolume ?? t.finalRecoveredVolume
      const mass = calcTotalMassUg(med, vol)
      const amount = variant ? calcAmountNmol(mass, variant.mwAdapter) : null
      const { targetVolumeUl } = calcDilutionVolume(amount, 2.6)
      const bufferToAdd = targetVolumeUl !== null && vol !== null ? Math.max(0, targetVolumeUl - vol) : null
      return [String(i + 1), fmt(amount, 2), fmt(targetVolumeUl, 1), fmt(vol, 0), fmt(bufferToAdd, 1)]
    })
  )

  addSubsection('11.2–11.3 Aliquoting & Inventory')
  addChecklist(['aliquot_adjustment', 'aliquot_mixing', 'aliquot_dispensing', 'aliquot_inventory', 'aliquot_labeling'])
  addTable(
    [['Tube', 'Adapter Variant', 'Total Aliquots', 'Lot Number (eLabNext)', 'Labels ✓']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', t.aliquotCount != null ? String(t.aliquotCount) : '—', t.aliquotLotNumber || '—', check(t.aliquotLabelsVerified)]
    })
  )

  addSubsection('11.4 Storage')
  addChecklist(['aliquot_storage'])
  addFieldPair('Storage Location', r.storageLocation, 'Calculated Expiry', r.calculatedExpiry)

  // ── Section 12 ──
  addSectionHeader(12, 'QUALITY CONTROL')
  addSubsection('12.1 Yield Assessment')
  addTable(
    [['Tube', 'Adapter', 'Start (nmol)', 'Final (nmol)', 'Yield %', 'Spec', 'Status']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      const variant = getVariant(t.adapterVariant, r)
      const postMed = median3(t.postExM1, t.postExM2, t.postExM3)
      const postVol = t.postExVolume ?? t.recoveredVolume
      const postMass = calcTotalMassUg(postMed, postVol)
      const startAmt = variant ? calcAmountNmol(postMass, variant.mwProtein) : null
      const finalMed = median3(t.finalM1, t.finalM2, t.finalM3)
      const finalVol = t.finalVolume ?? t.finalRecoveredVolume
      const finalMass = calcTotalMassUg(finalMed, finalVol)
      const finalAmt = variant ? calcAmountNmol(finalMass, variant.mwAdapter) : null
      const yieldPct = calcYieldPercent(startAmt, finalAmt)
      const spec = r.acceptanceCriteria?.[t.adapterVariant]?.minYield
      return [
        String(i + 1), t.adapterVariant || '—', fmt(startAmt, 2), fmt(finalAmt, 2),
        yieldPct !== null ? `${yieldPct.toFixed(1)}%` : '—',
        spec != null ? `≥ ${spec}%` : '—',
        t.yieldStatus ? t.yieldStatus.toUpperCase() : '—',
      ]
    })
  )

  addSubsection('12.2 Purity & Identity (SDS-PAGE)')
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

  addSubsection('12.3 Functional QC (Focal Molography)')
  addField('Experiment Ref', r.qcExperimentRef)
  y += 2
  addTable(
    [['Tube', 'Adapter', 'Immob. Ratio', 'Activity Ratio', 'k_off (s⁻¹)', 'Status']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', fmt(t.qcImmobRatio, 3), fmt(t.qcActivityRatio, 3), fmt(t.qcKoff, 6), t.qcStatus ? t.qcStatus.toUpperCase() : '—']
    })
  )

  // ── Section 13 ──
  addSectionHeader(13, 'FINAL DISPOSITION')
  addSubsection('13.1 Batch Review')
  addChecklist(['review_coa', 'review_documentation'])
  addField('Deviations', r.hasDeviations ? `Yes (NCR #${r.deviationNcrNumber})` : 'None')
  y += 2

  addSubsection('13.2 Final Decision')
  addTable(
    [['Tube', 'Adapter Variant', 'CoA Reference', 'Disposition']],
    tubeNums.map(i => {
      const t = r.tubes[i]
      return [String(i + 1), t.adapterVariant || '—', t.coaReference || '—', t.disposition ? t.disposition.toUpperCase() : '—']
    })
  )

  addSubsection('13.3 Release Authorization')
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
    s3: '3. Materials Traceability',
    s4: '4. Buffer Exchange',
    s5: '5. Post-Exchange Quantification',
    s6: '6. Reagent Preparation',
    s7: '7. Process Execution',
    s8: '8. AKTA Purification',
    s9: '9. Final Buffer Exchange',
    s10: '10. Final Quantification',
    s11: '11. Aliquoting & Storage',
    s12: '12. Quality Control',
    s13: '13. Final Disposition',
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
