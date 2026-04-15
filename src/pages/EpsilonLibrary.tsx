import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Plus, Trash2, Copy, Calculator, Save, ChevronDown, ChevronUp } from 'lucide-react'

// --- Amino acid average residue masses (same as ProtParam/ExPASy) ---
const AA_MW: Record<string, number> = {
  A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388,
  E: 129.1155, Q: 128.1307, G: 57.0519, H: 137.1411, I: 113.1594,
  L: 113.1594, K: 128.1741, M: 131.1926, F: 147.1766, P: 97.1167,
  S: 87.0782, T: 101.1051, W: 186.2132, Y: 163.1760, V: 99.1326,
}
const WATER_MASS = 18.0153

// Extinction coefficient at 280nm (Pace et al. 1995)
function calcEpsilon280(seq: string): { reduced: number; oxidized: number } {
  const nW = (seq.match(/W/g) || []).length
  const nY = (seq.match(/Y/g) || []).length
  const nC = (seq.match(/C/g) || []).length
  const reduced = nW * 5500 + nY * 1490
  const oxidized = reduced + Math.floor(nC / 2) * 125
  return { reduced, oxidized }
}

function calcMW(seq: string): number {
  let mw = WATER_MASS
  for (const aa of seq) {
    mw += AA_MW[aa] || 0
  }
  return mw
}

// pI calculation using bisection (Bjellqvist et al. 1993/1994, same as ExPASy ProtParam)
// N-terminal pKa depends on which amino acid is at the N-terminus
const PK_NTERM: Record<string, number> = {
  A: 7.59, R: 7.50, N: 7.50, D: 7.50, C: 8.00, E: 7.70, Q: 7.50, G: 7.50,
  H: 7.50, I: 7.50, L: 7.50, K: 7.50, M: 7.00, F: 7.50, P: 8.36, S: 6.93,
  T: 6.82, W: 7.50, Y: 7.50, V: 7.44,
}
// C-terminal pKa depends on which amino acid is at the C-terminus
const PK_CTERM: Record<string, number> = {
  D: 4.55, E: 4.75, // acidic C-termini have higher pKa
}
const PK_CTERM_DEFAULT = 3.55
const PK_SIDE: Record<string, number> = {
  D: 4.05, E: 4.45, C: 9.00, Y: 10.00, H: 5.98, K: 10.00, R: 12.00,
}

function chargeAtPH(seq: string, pH: number): number {
  const nTermAA = seq[0]
  const cTermAA = seq[seq.length - 1]
  const pkNterm = PK_NTERM[nTermAA] ?? 7.50
  const pkCterm = PK_CTERM[cTermAA] ?? PK_CTERM_DEFAULT
  // N-terminus (positive)
  let charge = 1 / (1 + Math.pow(10, pH - pkNterm))
  // C-terminus (negative)
  charge -= 1 / (1 + Math.pow(10, pkCterm - pH))
  // Side chains
  for (const aa of seq) {
    const pk = PK_SIDE[aa]
    if (pk === undefined) continue
    if (aa === 'D' || aa === 'E' || aa === 'C' || aa === 'Y') {
      // Acidic: negative at high pH
      charge -= 1 / (1 + Math.pow(10, pk - pH))
    } else {
      // Basic: positive at low pH
      charge += 1 / (1 + Math.pow(10, pH - pk))
    }
  }
  return charge
}

function calcPI(seq: string): number {
  let lo = 0, hi = 14
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2
    const c = chargeAtPH(seq, mid)
    if (c > 0) lo = mid
    else hi = mid
    if (Math.abs(c) < 0.001) break
  }
  return (lo + hi) / 2
}

function getAAComposition(seq: string): { aa: string; count: number; pct: number }[] {
  const counts: Record<string, number> = {}
  for (const aa of seq) {
    counts[aa] = (counts[aa] || 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([aa, count]) => ({ aa, count, pct: (count / seq.length) * 100 }))
}

interface EpsilonEntry {
  id: string
  name: string
  epsilon280: string
  epsilon260: string
  epsilonMass: string
  mw: string
  createdAt: Date
}

const REFERENCE_VALUES = [
  { name: 'IgG antibody', epsilon280: '210000', epsilon260: '120000', epsilonMass: '1.4', mw: '150000' },
  { name: '20bp ssDNA oligo', epsilon280: '100000', epsilon260: '200000', epsilonMass: '15', mw: '6600' },
]

export default function EpsilonLibrary() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [entries, setEntries] = useState<EpsilonEntry[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [seqInput, setSeqInput] = useState('')
  const [seqName, setSeqName] = useState('')
  const [numSS, setNumSS] = useState('') // number of disulfide bonds (override)
  const [newName, setNewName] = useState('')
  const [newE280, setNewE280] = useState('')
  const [newE260, setNewE260] = useState('')
  const [newEMass, setNewEMass] = useState('')
  const [newMW, setNewMW] = useState('')

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(firestore, 'users', user.uid, 'epsilonLibrary'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          name: data.name,
          epsilon280: data.epsilon280 || '',
          epsilon260: data.epsilon260 || '',
          epsilonMass: data.epsilonMass || '',
          mw: data.mw || '',
          createdAt: data.createdAt?.toDate() || new Date(),
        }
      }))
    })
    return unsub
  }, [user])

  async function addEntry() {
    if (!newName.trim() || !user) return
    await addDoc(collection(firestore, 'users', user.uid, 'epsilonLibrary'), {
      name: newName.trim(),
      epsilon280: newE280.trim(),
      epsilon260: newE260.trim(),
      epsilonMass: newEMass.trim(),
      mw: newMW.trim(),
      createdAt: Timestamp.now(),
    })
    setNewName(''); setNewE280(''); setNewE260(''); setNewEMass(''); setNewMW('')
    setShowAdd(false)
  }

  async function deleteEntry(entryId: string) {
    if (!user || !confirm('Delete this entry?')) return
    await deleteDoc(doc(firestore, 'users', user.uid, 'epsilonLibrary', entryId))
  }

  function useInCalculator(entry: { epsilon280: string; mw: string }) {
    const params = new URLSearchParams()
    if (entry.epsilon280) params.set('epsilon', entry.epsilon280)
    if (entry.mw) params.set('mw', entry.mw)
    navigate(`/protein?${params.toString()}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-primary font-medium hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Home</span>
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">ε Library</h1>
      <p className="text-sm text-slate-500 mb-4">Extinction coefficients & molecular weights</p>

      {/* Sequence Calculator */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
        <button
          onClick={() => setShowCalc(!showCalc)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left">
              <span className="font-medium text-slate-900 text-sm">Sequence → Properties</span>
              <p className="text-xs text-slate-400">Compute MW, ε₂₈₀, pI from amino acid sequence</p>
            </div>
          </div>
          {showCalc ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showCalc && (
          <div className="px-4 pb-4 border-t border-slate-100 pt-3">
            <input
              type="text"
              value={seqName}
              onChange={e => setSeqName(e.target.value)}
              placeholder="Protein name (e.g. Trastuzumab HC)"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
            <textarea
              value={seqInput}
              onChange={e => setSeqInput(e.target.value)}
              placeholder="Paste amino acid sequence (one-letter code)&#10;e.g. MVLSPADKTNVKAAW..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-light font-mono resize-none"
            />
            <div className="flex items-center gap-2 mb-3">
              <label className="text-xs text-slate-400">Disulfide bonds (optional)</label>
              <input
                type="number"
                value={numSS}
                onChange={e => setNumSS(e.target.value)}
                placeholder="auto"
                min="0"
                className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>

            {/* Results */}
            {(() => {
              const cleaned = seqInput.toUpperCase().replace(/[^ARNDCEQGHILKMFPSTWYV]/g, '')
              if (cleaned.length < 2) return <p className="text-xs text-slate-400 text-center py-2">Enter at least 2 amino acids to compute properties.</p>

              const mw = calcMW(cleaned)
              const eps = calcEpsilon280(cleaned)
              const nC = (cleaned.match(/C/g) || []).length
              const ssOverride = numSS !== '' ? parseInt(numSS) || 0 : null
              const nSS = ssOverride !== null ? ssOverride : Math.floor(nC / 2)
              const eps280 = eps.reduced + nSS * 125
              const abs01pct = mw > 0 ? eps280 / mw : 0  // Abs 0.1% (=1 g/L)
              const pi = calcPI(cleaned)
              const nW = (cleaned.match(/W/g) || []).length
              const nY = (cleaned.match(/Y/g) || []).length
              const composition = getAAComposition(cleaned)

              return (
                <>
                  {/* Summary results */}
                  <div className="bg-slate-50 rounded-xl p-4 mb-3">
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{mw.toFixed(1)}</div>
                        <div className="text-[10px] text-slate-400">MW (Da)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">{(mw / 1000).toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">MW (kDa)</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-accent">{eps280.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">ε₂₈₀ (M⁻¹cm⁻¹)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-accent">{abs01pct.toFixed(3)}</div>
                        <div className="text-[10px] text-slate-400">Abs 0.1% (1 g/L)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-accent">{pi.toFixed(2)}</div>
                        <div className="text-[10px] text-slate-400">pI</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 text-center">
                      {cleaned.length} residues · {nW} Trp · {nY} Tyr · {nC} Cys ({nSS} S-S)
                    </div>
                  </div>

                  {/* Composition */}
                  <details className="mb-3">
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">Amino acid composition</summary>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-[10px]">
                      {composition.map(({ aa, count, pct }) => (
                        <div key={aa} className="flex items-center gap-1 bg-slate-50 rounded px-1.5 py-0.5">
                          <span className="font-mono font-bold text-primary">{aa}</span>
                          <span className="text-slate-500">{count}</span>
                          <span className="text-slate-400">({pct.toFixed(1)}%)</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Save to library */}
                  <button
                    onClick={async () => {
                      if (!user || !seqName.trim()) {
                        alert('Please enter a protein name')
                        return
                      }
                      await addDoc(collection(firestore, 'users', user.uid, 'epsilonLibrary'), {
                        name: seqName.trim(),
                        epsilon280: String(eps280),
                        epsilon260: '',
                        epsilonMass: abs01pct.toFixed(3),
                        mw: String(Math.round(mw)),
                        pI: pi.toFixed(2),
                        createdAt: Timestamp.now(),
                      })
                      setSeqInput('')
                      setSeqName('')
                      setNumSS('')
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save to Library
                  </button>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">New Entry</h2>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Name (e.g. IgG, Her2-ADC, Trastuzumab)"
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary-light"
          />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400">ε₂₈₀ (M⁻¹cm⁻¹)</label>
              <input type="number" value={newE280} onChange={e => setNewE280(e.target.value)} placeholder="e.g. 210000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">ε₂₆₀ (M⁻¹cm⁻¹)</label>
              <input type="number" value={newE260} onChange={e => setNewE260(e.target.value)} placeholder="e.g. 120000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-slate-400">ε (mg/mL)⁻¹cm⁻¹</label>
              <input type="number" value={newEMass} onChange={e => setNewEMass(e.target.value)} placeholder="e.g. 1.4" step="0.01"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">MW (Da)</label>
              <input type="number" value={newMW} onChange={e => setNewMW(e.target.value)} placeholder="e.g. 150000"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary-light" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={!newName.trim()}
              className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-40">
              Save
            </button>
            <button onClick={() => { setShowAdd(false); setNewName(''); setNewE280(''); setNewE260(''); setNewEMass(''); setNewMW('') }}
              className="px-4 py-2.5 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reference values */}
      <div className="mb-2">
        <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Reference Values</h2>
        <div className="space-y-2">
          {REFERENCE_VALUES.map(ref => (
            <div
              key={ref.name}
              onClick={() => useInCalculator(ref)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 text-sm">{ref.name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    ε₂₈₀ = {Number(ref.epsilon280).toLocaleString()} M⁻¹cm⁻¹
                    {ref.epsilon260 && <> · ε₂₆₀ = {Number(ref.epsilon260).toLocaleString()}</>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    ε(mg) = {ref.epsilonMass} · MW = {Number(ref.mw).toLocaleString()} Da
                  </div>
                </div>
                <Copy className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User entries */}
      {entries.length > 0 && (
        <div className="mt-4">
          <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Your Library</h2>
          <div className="space-y-2">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-primary-light hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div onClick={() => useInCalculator(entry)} className="flex-1">
                    <div className="font-medium text-slate-900 text-sm">{entry.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {entry.epsilon280 && <>ε₂₈₀ = {Number(entry.epsilon280).toLocaleString()} M⁻¹cm⁻¹</>}
                      {entry.epsilon260 && <> · ε₂₆₀ = {Number(entry.epsilon260).toLocaleString()}</>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {entry.epsilonMass && <>ε(mg) = {entry.epsilonMass}</>}
                      {entry.mw && <> · MW = {Number(entry.mw).toLocaleString()} Da</>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id) }}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">No custom entries yet. Tap "Add" to save your first one.</p>
          <p className="text-slate-400 text-xs mt-1">Tap a reference value to use it in the Protein Calculator.</p>
        </div>
      )}
    </div>
  )
}
