import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function ProteinCalculator() {
  const navigate = useNavigate()

  const [abs, setAbs] = useState('')
  const [epsilon, setEpsilon] = useState('')
  const [mw, setMw] = useState('')       // Da
  const [path, setPath] = useState('1')  // cm
  const [vol, setVol] = useState('')     // mL

  const absVal = parseFloat(abs) || 0
  const epsVal = parseFloat(epsilon) || 0
  const pathVal = parseFloat(path) || 1
  const mwVal = parseFloat(mw) || 0
  const volVal = parseFloat(vol) || 0

  const hasResult = absVal > 0 && epsVal > 0
  const hasVol = volVal > 0
  const hasMW = mwVal > 0
  const hasAll = hasVol && hasMW

  const cM = hasResult ? absVal / (epsVal * pathVal) : 0
  const cUM = cM * 1e6
  const nMol = hasVol ? cM * volVal * 1e-3 : 0
  const nNmol = nMol * 1e9
  const mG = hasAll ? nMol * mwVal : 0
  const mUg = mG * 1e6

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
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Protein Calculator</h1>
      <p className="text-sm text-slate-500 mb-6">A280 → Concentration, Amount & Mass</p>

      {/* Inputs */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-4">
        <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Parameters</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">Absorbance (A)</label>
            <input
              type="number"
              value={abs}
              onChange={e => setAbs(e.target.value)}
              placeholder="A280"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.001"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">ε (M⁻¹cm⁻¹)</label>
            <input
              type="number"
              value={epsilon}
              onChange={e => setEpsilon(e.target.value)}
              placeholder="Extinction coeff."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500 font-medium">MW (Da)</label>
            <input
              type="number"
              value={mw}
              onChange={e => setMw(e.target.value)}
              placeholder="Da"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Path (cm)</label>
            <input
              type="number"
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.1"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">Volume (mL)</label>
            <input
              type="number"
              value={vol}
              onChange={e => setVol(e.target.value)}
              placeholder="mL"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-primary-light"
              step="0.1"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {hasResult && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <h2 className="text-xs font-bold text-primary uppercase tracking-wide mb-3">Results</h2>

          {/* Concentration */}
          <div className="bg-slate-50 rounded-xl p-4 mb-3">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Concentration</div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-accent">{cM.toExponential(3)}</div>
                <div className="text-xs text-slate-400">M</div>
              </div>
              <div>
                <div className="text-lg font-bold text-accent">{cUM.toFixed(2)}</div>
                <div className="text-xs text-slate-400">µM</div>
              </div>
            </div>
          </div>

          {/* Amount */}
          {hasVol && (
            <div className="bg-slate-50 rounded-xl p-4 mb-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Amount</div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{nMol.toExponential(3)}</div>
                  <div className="text-xs text-slate-400">mol</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{nNmol.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">nmol</div>
                </div>
              </div>
            </div>
          )}

          {/* Mass */}
          {hasAll && (
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Mass</div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">{mG.toExponential(3)}</div>
                  <div className="text-xs text-slate-400">g</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-primary">{mUg.toFixed(1)}</div>
                  <div className="text-xs text-slate-400">µg</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formula reference */}
      <div className="mt-4 text-xs text-slate-400 text-center">
        c = A / (ε × l) &nbsp;·&nbsp; n = c × V &nbsp;·&nbsp; m = n × MW
      </div>
    </div>
  )
}
