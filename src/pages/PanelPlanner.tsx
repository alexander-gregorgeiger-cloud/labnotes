import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Save } from 'lucide-react'
import type { Project } from '../db'

const PLEX_OPTIONS = [1, 4, 8, 32]

const DEFAULT_COLORS = [
  '#E6194B', '#3CB44B', '#4363D8', '#F58231', '#911EB4', '#42D4F4', '#F032E6', '#BFEF45',
  '#FABED4', '#469990', '#DCBEFF', '#9A6324', '#FFFAC8', '#800000', '#AAFFC3', '#808000',
  '#FFD8B1', '#000075', '#A9A9A9', '#E6BEFF', '#FF4500', '#228B22', '#1E90FF', '#FFD700',
  '#8B008B', '#00CED1', '#FF69B4', '#32CD32', '#BA55D3', '#CD853F', '#708090', '#DC143C',
]

const EMPTY_COLOR = '#E2E8F0'

function getProteinIndex(plex: number, row: number, col: number): number {
  switch (plex) {
    case 1: return 0
    case 4: return Math.floor(col / 2)
    case 8: return col
    case 32: return col * 4 + Math.floor(row / 2)
    default: return 0
  }
}

function getSpotDescription(plex: number, index: number): string {
  switch (plex) {
    case 1: return 'All spots'
    case 4: return `Col ${index * 2 + 1}–${index * 2 + 2}`
    case 8: return `Col ${index + 1}`
    case 32: {
      const c = Math.floor(index / 4)
      const sub = ['a', 'b', 'c', 'd'][index % 4]
      return `C${c + 1}${sub}`
    }
    default: return ''
  }
}

function getProteinCount(plex: number): number {
  switch (plex) {
    case 1: return 1
    case 4: return 4
    case 8: return 8
    case 32: return 32
    default: return 1
  }
}

export default function PanelPlanner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [plex, setPlex] = useState(8)
  const [labels, setLabels] = useState<string[]>(Array(32).fill(''))
  const [colors, setColors] = useState<string[]>(DEFAULT_COLORS.map(c => c))
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saved, setSaved] = useState(false)

  const proteinCount = getProteinCount(plex)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'projects'),
      orderBy('updatedAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setProjects(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        description: d.data().description || '',
        createdAt: d.data().createdAt?.toDate() || new Date(),
        updatedAt: d.data().updatedAt?.toDate() || new Date(),
      })))
    })
    return unsub
  }, [user])

  function updateLabel(index: number, value: string) {
    const newLabels = [...labels]
    newLabels[index] = value
    setLabels(newLabels)
  }

  function generateImage(): string {
    const canvas = document.createElement('canvas')
    const cellSize = 48
    const gap = 2
    const labelW = 28
    const headerH = 48
    const legendH = 16 + proteinCount * 20
    const gridW = labelW + 8 * (cellSize + gap)
    const gridH = headerH + 8 * (cellSize + gap)
    const w = Math.max(gridW, 200) + 32
    const h = gridH + legendH + 40

    canvas.width = w * 2
    canvas.height = h * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    // Background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    // Title
    ctx.fillStyle = '#1E293B'
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`Panel Planner — ${plex}-plex`, 16, 32)

    // Column headers
    const gridStartY = headerH
    const gridStartX = 16 + labelW
    ctx.fillStyle = '#94A3B8'
    ctx.font = 'bold 10px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    for (let c = 0; c < 8; c++) {
      ctx.fillText(`C${c + 1}`, gridStartX + c * (cellSize + gap) + cellSize / 2, gridStartY - 6)
    }

    // Grid
    for (let r = 0; r < 8; r++) {
      // Row label
      ctx.fillStyle = '#94A3B8'
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`R${r + 1}`, 16 + labelW - 4, gridStartY + r * (cellSize + gap) + cellSize / 2 + 4)

      for (let c = 0; c < 8; c++) {
        const idx = getProteinIndex(plex, r, c)
        const label = labels[idx]?.trim()
        const color = label ? (colors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]) : EMPTY_COLOR
        const x = gridStartX + c * (cellSize + gap)
        const y = gridStartY + r * (cellSize + gap)

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x, y, cellSize, cellSize, 3)
        ctx.fill()
      }
    }

    // Legend
    const legendY = gridStartY + 8 * (cellSize + gap) + 16
    const legendItems: { color: string; label: string; desc: string }[] = []
    for (let i = 0; i < proteinCount; i++) {
      const label = labels[i]?.trim()
      if (label) {
        legendItems.push({
          color: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
          label,
          desc: getSpotDescription(plex, i),
        })
      }
    }

    ctx.font = '10px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    legendItems.forEach((item, i) => {
      const y = legendY + i * 18
      ctx.fillStyle = item.color
      ctx.beginPath()
      ctx.arc(24, y + 5, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#334155'
      ctx.fillText(`${item.desc}: ${item.label}`, 34, y + 9)
    })

    return canvas.toDataURL('image/png')
  }

  async function saveToProject() {
    if (!user || !selectedProjectId) return
    const imageData = generateImage()
    const now = Timestamp.now()
    await addDoc(
      collection(firestore, 'users', user.uid, 'projects', selectedProjectId, 'notes'),
      {
        content: `Panel Planner (${plex}-plex) — ${new Date().toLocaleDateString()}`,
        imageData,
        createdAt: now,
        updatedAt: now,
      }
    )
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', selectedProjectId), { updatedAt: now })
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSaveModal(false) }, 1500)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Panel Planner</h1>
      <p className="text-sm text-slate-500 mb-4">CIP Chip Layout (8×8)</p>

      {/* Plex selector */}
      <div className="flex mb-4 bg-slate-100 rounded-xl p-1">
        {PLEX_OPTIONS.map(p => (
          <button
            key={p}
            onClick={() => setPlex(p)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              plex === p ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {p}-plex
          </button>
        ))}
      </div>

      {/* Protein assignment */}
      {plex === 32 ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Assign Proteins (32-plex)</h2>
          <p className="text-[10px] text-slate-400 mb-3">8 columns × 4 row-groups (R1-2, R3-4, R5-6, R7-8)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="pb-1 text-left w-12"></th>
                  {Array.from({ length: 8 }, (_, c) => (
                    <th key={c} className="pb-1 text-center font-semibold">C{c + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['R1-2', 'R3-4', 'R5-6', 'R7-8'].map((rowLabel, rg) => (
                  <tr key={rowLabel}>
                    <td className="py-1 text-slate-400 font-semibold text-right pr-1.5">{rowLabel}</td>
                    {Array.from({ length: 8 }, (_, c) => {
                      const idx = c * 4 + rg
                      return (
                        <td key={c} className="py-1 px-0.5">
                          <input
                            type="text"
                            value={labels[idx]}
                            onChange={e => updateLabel(idx, e.target.value)}
                            placeholder={`${idx + 1}`}
                            className="w-full px-1 py-0.5 border border-slate-200 rounded text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-primary-light"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">
            Assign Proteins ({plex}-plex)
          </h2>
          <div className="space-y-2">
            {Array.from({ length: proteinCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                  className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-white shadow-sm hover:scale-110 transition-transform"
                  style={{ backgroundColor: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }}
                  title="Change color"
                />
                {editingIndex === i && (
                  <div className="absolute left-0 top-7 z-50 bg-white rounded-xl shadow-lg border border-slate-200 p-2 flex gap-1 flex-wrap w-[160px]">
                    {DEFAULT_COLORS.slice(0, 16).map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          const newColors = [...colors]
                          newColors[i] = c
                          setColors(newColors)
                          setEditingIndex(null)
                        }}
                        className="w-5 h-5 rounded-full border transition-transform hover:scale-125 active:scale-90"
                        style={{
                          backgroundColor: c,
                          borderColor: colors[i] === c ? '#1e293b' : 'rgba(0,0,0,0.12)',
                          borderWidth: colors[i] === c ? 2 : 1,
                        }}
                      />
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={labels[i]}
                  onChange={e => updateLabel(i, e.target.value)}
                  placeholder={`Protein ${i + 1}`}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light"
                />
                <span className="text-[10px] text-slate-400 flex-shrink-0 w-16 text-right">
                  {getSpotDescription(plex, i)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid preview */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Chip Layout</h2>
        <div className="overflow-x-auto">
          {/* Column headers */}
          <div className="flex gap-1.5 mb-1.5">
            <div className="w-7 flex-shrink-0" />
            {Array.from({ length: 8 }, (_, c) => (
              <div key={c} className="w-10 h-4 text-center text-[10px] font-semibold text-slate-400">
                C{c + 1}
              </div>
            ))}
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }, (_, r) => (
            <div key={r} className="flex gap-1.5 mb-1.5 items-center">
              <div className="w-7 text-[10px] font-semibold text-slate-400 text-right pr-1.5 flex-shrink-0">
                R{r + 1}
              </div>
              {Array.from({ length: 8 }, (_, c) => {
                const idx = getProteinIndex(plex, r, c)
                const label = labels[idx]?.trim()
                const color = label ? (colors[idx] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]) : EMPTY_COLOR
                return (
                  <div
                    key={c}
                    className="w-10 h-10 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: color }}
                    title={label || `Spot R${r + 1}C${c + 1}`}
                  >
                    {plex >= 8 && label && (
                      <span className="text-[8px] text-white font-bold drop-shadow-sm truncate px-0.5">
                        {label.slice(0, 4)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        {(() => {
          const items: { color: string; label: string; desc: string }[] = []
          for (let i = 0; i < proteinCount; i++) {
            const label = labels[i]?.trim()
            if (label) {
              items.push({
                color: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
                label,
                desc: getSpotDescription(plex, i),
              })
            }
          }
          if (items.length === 0) return null
          return (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-slate-600">{item.desc}: {item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Save to Project Modal */}
      {showSaveModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {saved ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">✓</div>
                <p className="text-lg font-semibold text-primary">Saved to project!</p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Save to Project</h2>
                <p className="text-sm text-slate-500 mb-4">
                  The chip layout will be saved as an image note.
                </p>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-light"
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={saveToProject}
                    disabled={!selectedProjectId}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
