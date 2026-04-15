import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Save } from 'lucide-react'
import type { Project } from '../db'

/* ─── Unit definitions ─── */

interface UnitDef {
  symbol: string
  category: string
  toBase: number // multiply by this to get base unit
}

const UNITS: Record<string, UnitDef> = {
  // Volume (base: L)
  'pL':  { symbol: 'pL',  category: 'volume', toBase: 1e-12 },
  'nL':  { symbol: 'nL',  category: 'volume', toBase: 1e-9 },
  'µL':  { symbol: 'µL',  category: 'volume', toBase: 1e-6 },
  'uL':  { symbol: 'µL',  category: 'volume', toBase: 1e-6 },
  'mL':  { symbol: 'mL',  category: 'volume', toBase: 1e-3 },
  'L':   { symbol: 'L',   category: 'volume', toBase: 1 },
  // Mass (base: g)
  'pg':  { symbol: 'pg',  category: 'mass', toBase: 1e-12 },
  'ng':  { symbol: 'ng',  category: 'mass', toBase: 1e-9 },
  'µg':  { symbol: 'µg',  category: 'mass', toBase: 1e-6 },
  'ug':  { symbol: 'µg',  category: 'mass', toBase: 1e-6 },
  'mg':  { symbol: 'mg',  category: 'mass', toBase: 1e-3 },
  'g':   { symbol: 'g',   category: 'mass', toBase: 1 },
  'kg':  { symbol: 'kg',  category: 'mass', toBase: 1e3 },
  // Amount (base: mol)
  'pmol':  { symbol: 'pmol',  category: 'amount', toBase: 1e-12 },
  'nmol':  { symbol: 'nmol',  category: 'amount', toBase: 1e-9 },
  'µmol':  { symbol: 'µmol',  category: 'amount', toBase: 1e-6 },
  'umol':  { symbol: 'µmol',  category: 'amount', toBase: 1e-6 },
  'mmol':  { symbol: 'mmol',  category: 'amount', toBase: 1e-3 },
  'mol':   { symbol: 'mol',   category: 'amount', toBase: 1 },
  // Concentration (base: M)
  'pM':  { symbol: 'pM',  category: 'concentration', toBase: 1e-12 },
  'nM':  { symbol: 'nM',  category: 'concentration', toBase: 1e-9 },
  'µM':  { symbol: 'µM',  category: 'concentration', toBase: 1e-6 },
  'uM':  { symbol: 'µM',  category: 'concentration', toBase: 1e-6 },
  'mM':  { symbol: 'mM',  category: 'concentration', toBase: 1e-3 },
  'M':   { symbol: 'M',   category: 'concentration', toBase: 1 },
  // Molecular weight (base: Da)
  'Da':  { symbol: 'Da',  category: 'mw', toBase: 1 },
  'kDa': { symbol: 'kDa', category: 'mw', toBase: 1e3 },
  'MDa': { symbol: 'MDa', category: 'mw', toBase: 1e6 },
}

// Sorted by length descending so longer unit names match first (e.g. "nmol" before "mol")
const UNIT_KEYS = Object.keys(UNITS).sort((a, b) => b.length - a.length)

/* ─── Parsing & evaluation ─── */

interface ParsedValue {
  number: number
  unit: string | null // null = unitless
}

/** Pick the best display unit for a category and value (in base units) */
function bestUnit(category: string, baseValue: number): { symbol: string; toBase: number } {
  const absVal = Math.abs(baseValue)
  const candidates = Object.values(UNITS)
    .filter(u => u.category === category)
    // remove aliases (uL, ug, uM, umol)
    .filter(u => !['uL', 'ug', 'uM', 'umol'].includes(u.symbol))
    .sort((a, b) => a.toBase - b.toBase)

  // Pick the largest unit where the display value is >= 0.001
  let best = candidates[0]
  for (const c of candidates) {
    if (absVal / c.toBase >= 0.001) best = c
  }
  return best
}

/** Parse a token like "500" or "2.5µL" or "100mM" into number + optional unit */
function parseToken(token: string): ParsedValue | null {
  const t = token.trim()
  if (!t) return null

  // Try to find a unit suffix
  for (const key of UNIT_KEYS) {
    if (t.endsWith(key)) {
      const numPart = t.slice(0, -key.length).trim()
      const num = parseFloat(numPart)
      if (isNaN(num)) return null
      return { number: num, unit: key }
    }
  }

  // No unit — plain number
  const num = parseFloat(t)
  if (isNaN(num)) return null
  return { number: num, unit: null }
}

/** Format a number nicely */
function fmt(n: number): string {
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9 || (abs < 0.001 && abs > 0)) return n.toExponential(4)
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
  // up to 6 significant digits
  const s = n.toPrecision(6)
  // remove trailing zeros after decimal
  if (s.includes('.')) return s.replace(/\.?0+$/, '')
  return s
}

interface CalcResult {
  display: string      // e.g. "250 µL" or "42"
  baseValue: number    // value in base unit (or unitless)
  category: string | null
}

/** Evaluate an expression string. Supports +, -, *, /, parentheses, and units. */
function evaluate(expr: string): CalcResult {
  // Normalize: replace × with *, ÷ with /, comma decimal with dot
  let e = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.')
  // Normalize unicode µ (both U+00B5 and U+03BC)
  e = e.replace(/\u00B5/g, 'µ').replace(/\u03BC/g, 'µ')

  // Tokenize: split into numbers (with optional unit), operators, parens
  const tokens: string[] = []
  let i = 0
  while (i < e.length) {
    if (e[i] === ' ') { i++; continue }
    if ('+-*/()'.includes(e[i])) {
      tokens.push(e[i])
      i++
    } else {
      // Read number + optional unit
      let j = i
      // Read number part (digits, dot, minus for negative)
      while (j < e.length && (e[j] >= '0' && e[j] <= '9' || e[j] === '.' || e[j] === 'e' || e[j] === 'E' || (e[j] === '-' && j > i && (e[j-1] === 'e' || e[j-1] === 'E')))) j++
      // Read unit part (letters + µ)
      while (j < e.length && /[a-zA-Zµ]/.test(e[j])) j++
      if (j === i) throw new Error(`Unexpected character: ${e[i]}`)
      tokens.push(e.slice(i, j))
      i = j
    }
  }

  // Shunting-yard for operator precedence
  const output: (ParsedValue | string)[] = []
  const ops: string[] = []
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

  // Handle unary minus at start or after ( or operator
  let prevWasOp = true // treat start as "after operator"

  for (const tok of tokens) {
    if (tok === '(') {
      ops.push(tok)
      prevWasOp = true
    } else if (tok === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop()!)
      if (ops.length && ops[ops.length - 1] === '(') ops.pop()
      prevWasOp = false
    } else if (tok in prec) {
      // Handle unary minus: convert "- X" to "0 - X"
      if (tok === '-' && prevWasOp) {
        output.push({ number: 0, unit: null })
      } else {
        while (ops.length && ops[ops.length - 1] !== '(' && (prec[ops[ops.length - 1]] || 0) >= prec[tok]) {
          output.push(ops.pop()!)
        }
      }
      ops.push(tok)
      prevWasOp = true
    } else {
      const parsed = parseToken(tok)
      if (!parsed) throw new Error(`Cannot parse: ${tok}`)
      output.push(parsed)
      prevWasOp = false
    }
  }
  while (ops.length) output.push(ops.pop()!)

  // Evaluate RPN
  const stack: { value: number; unit: string | null; category: string | null }[] = []

  for (const item of output) {
    if (typeof item === 'string') {
      // operator
      if (stack.length < 2) throw new Error('Invalid expression')
      const b = stack.pop()!
      const a = stack.pop()!

      if (item === '+' || item === '-') {
        // Addition/subtraction: units must be compatible
        if (a.category && b.category && a.category !== b.category) {
          throw new Error(`Cannot ${item === '+' ? 'add' : 'subtract'} ${a.category} and ${b.category}`)
        }
        const cat = a.category || b.category
        const result = item === '+' ? a.value + b.value : a.value - b.value
        stack.push({ value: result, unit: a.unit || b.unit, category: cat })
      } else if (item === '*') {
        // Multiplication: one side should be unitless, or both unitless
        if (a.category && b.category) {
          throw new Error(`Cannot multiply ${a.category} × ${b.category}`)
        }
        stack.push({ value: a.value * b.value, unit: a.unit || b.unit, category: a.category || b.category })
      } else if (item === '/') {
        if (b.value === 0) throw new Error('Division by zero')
        if (a.category && b.category && a.category === b.category) {
          // Same category: result is unitless ratio
          stack.push({ value: a.value / b.value, unit: null, category: null })
        } else if (b.category && !a.category) {
          throw new Error(`Cannot divide unitless by ${b.category}`)
        } else {
          stack.push({ value: a.value / b.value, unit: a.unit, category: a.category })
        }
      }
    } else {
      // parsed value
      const unitDef = item.unit ? UNITS[item.unit] : null
      const baseValue = unitDef ? item.number * unitDef.toBase : item.number
      stack.push({
        value: baseValue,
        unit: item.unit,
        category: unitDef?.category || null,
      })
    }
  }

  if (stack.length !== 1) throw new Error('Invalid expression')
  const result = stack[0]

  if (result.category) {
    const best = bestUnit(result.category, result.value)
    const displayVal = result.value / best.toBase
    return { display: `${fmt(displayVal)} ${best.symbol}`, baseValue: result.value, category: result.category }
  }

  return { display: fmt(result.value), baseValue: result.value, category: null }
}

/* ─── Component ─── */

interface HistoryEntry {
  id: number
  expression: string
  result: string
  selected: boolean
}

let historyId = 0

export default function PocketCalculator() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [expr, setExpr] = useState('')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [error, setError] = useState('')

  // Save to project
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(searchParams.get('projectId') || '')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saved, setSaved] = useState(false)

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

  function handleCalculate() {
    if (!expr.trim()) return
    setError('')
    try {
      const result = evaluate(expr)
      setHistory(prev => [{
        id: ++historyId,
        expression: expr,
        result: result.display,
        selected: false,
      }, ...prev])
      setExpr('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid expression')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCalculate()
    }
  }

  function toggleSelect(id: number) {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, selected: !h.selected } : h))
  }

  function selectAll() {
    const allSelected = history.every(h => h.selected)
    setHistory(prev => prev.map(h => ({ ...h, selected: !allSelected })))
  }

  function deleteSelected() {
    setHistory(prev => prev.filter(h => !h.selected))
  }

  function clearHistory() {
    setHistory([])
  }

  const selectedCount = history.filter(h => h.selected).length

  // Build text for saving
  function buildText(): string {
    const selected = history.filter(h => h.selected)
    const items = selected.length > 0 ? selected : history
    let text = `Pocket Calculator Results\n`
    text += `Date: ${new Date().toLocaleDateString()}\n\n`
    for (const h of items) {
      text += `${h.expression} = ${h.result}\n`
    }
    return text
  }

  async function saveToProject() {
    if (!user || !selectedProjectId) return
    const now = Timestamp.now()
    await addDoc(
      collection(firestore, 'users', user.uid, 'projects', selectedProjectId, 'notes'),
      { content: buildText(), createdAt: now, updatedAt: now }
    )
    await updateDoc(doc(firestore, 'users', user.uid, 'projects', selectedProjectId), { updatedAt: now })
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowSaveModal(false) }, 1500)
  }

  // Quick-insert unit buttons
  const quickUnits = ['µL', 'mL', 'µg', 'mg', 'µM', 'mM', 'nmol', 'kDa']

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
          disabled={history.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Pocket Calculator</h1>
      <p className="text-sm text-slate-500 mb-4">Math with lab units — type expressions like <code className="bg-slate-100 px-1 rounded text-xs">500µL + 1.5mL</code></p>

      {/* Input */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <div className="flex gap-2 mb-2">
          <input
            ref={inputRef}
            type="text"
            value={expr}
            onChange={e => { setExpr(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 500µL + 1.5mL or 3 * 42nmol"
            className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-light font-mono"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            onClick={handleCalculate}
            disabled={!expr.trim()}
            className="px-4 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-dark transition-colors disabled:opacity-40"
          >
            =
          </button>
        </div>

        {/* Quick unit buttons */}
        <div className="flex flex-wrap gap-1">
          {quickUnits.map(u => (
            <button
              key={u}
              onClick={() => {
                setExpr(prev => prev + u)
                inputRef.current?.focus()
              }}
              className="px-2 py-0.5 text-[11px] bg-slate-100 text-slate-500 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {u}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-2 text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-4 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h2 className="text-xs font-bold text-primary uppercase tracking-wide">History</h2>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <button
                  onClick={deleteSelected}
                  className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
                >
                  Delete ({selectedCount})
                </button>
              )}
              <button
                onClick={selectAll}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {history.every(h => h.selected) ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={clearHistory}
                className="text-[11px] text-slate-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {history.map(h => (
              <div
                key={h.id}
                onClick={() => toggleSelect(h.id)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  h.selected ? 'bg-primary/5' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  h.selected ? 'border-primary bg-primary' : 'border-slate-300'
                }`}>
                  {h.selected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-500 font-mono truncate block">{h.expression}</span>
                </div>
                <div className="text-sm font-semibold text-primary font-mono flex-shrink-0">
                  = {h.result}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  {selectedCount > 0
                    ? `Save ${selectedCount} selected calculation${selectedCount > 1 ? 's' : ''} as a note.`
                    : 'Save all calculations as a note to the selected project.'}
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
