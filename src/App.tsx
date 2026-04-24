import { Routes, Route } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { Ban } from 'lucide-react'
import { useAuth } from './AuthContext'
import { auth } from './firebase'
import Login from './pages/Login'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import ExperimentList from './pages/ExperimentList'
import ExperimentDetail from './pages/ExperimentDetail'
import ConjugationCalculator from './pages/ConjugationCalculator'
import ProteinCalculator from './pages/ProteinCalculator'
import MemoList from './pages/MemoList'
import PanelPlanner from './pages/PanelPlanner'
import EpsilonLibrary from './pages/EpsilonLibrary'
import ConjugationRecordList from './pages/ConjugationRecordList'
import ConjugationRecordDetail from './pages/ConjugationRecordDetail'
import ThioLinkAnalysis from './pages/ThioLinkAnalysis'
import Admin from './pages/Admin'

function BlockedScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Ban className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-1">Account disabled</h1>
        <p className="text-sm text-slate-500 mb-5">
          Your account has been blocked. Please contact the administrator if you believe this is a mistake.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="w-full bg-slate-800 text-white py-2.5 rounded-lg font-medium hover:bg-slate-900 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (profile?.status === 'blocked') {
    return <BlockedScreen />
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="/project/:id" element={<ProjectDetail />} />
      <Route path="/experiments" element={<ExperimentList />} />
      <Route path="/experiment/:id" element={<ExperimentDetail />} />
      <Route path="/conjugation" element={<ConjugationCalculator />} />
      <Route path="/protein" element={<ProteinCalculator />} />
      <Route path="/memos" element={<MemoList />} />
      <Route path="/panel-planner" element={<PanelPlanner />} />
      <Route path="/epsilon-library" element={<EpsilonLibrary />} />
      <Route path="/thiolink" element={<ThioLinkAnalysis />} />
      <Route path="/records" element={<ConjugationRecordList />} />
      <Route path="/record/:id" element={<ConjugationRecordDetail />} />
      {isAdmin && <Route path="/admin" element={<Admin />} />}
    </Routes>
  )
}
