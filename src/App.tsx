import { Routes, Route } from 'react-router-dom'
import { useAuth } from './AuthContext'
import Login from './pages/Login'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import ExperimentList from './pages/ExperimentList'
import ExperimentDetail from './pages/ExperimentDetail'
import ConjugationCalculator from './pages/ConjugationCalculator'

export default function App() {
  const { user, loading } = useAuth()

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

  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="/project/:id" element={<ProjectDetail />} />
      <Route path="/experiments" element={<ExperimentList />} />
      <Route path="/experiment/:id" element={<ExperimentDetail />} />
      <Route path="/conjugation" element={<ConjugationCalculator />} />
    </Routes>
  )
}
