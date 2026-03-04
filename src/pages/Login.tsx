import { useState } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { FlaskConical } from 'lucide-react'

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      if (message.includes('user-not-found') || message.includes('invalid-credential')) {
        setError('Invalid email or password')
      } else if (message.includes('email-already-in-use')) {
        setError('Account already exists. Try signing in.')
      } else if (message.includes('weak-password')) {
        setError('Password must be at least 6 characters')
      } else if (message.includes('invalid-email')) {
        setError('Please enter a valid email')
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <FlaskConical className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">LabNotes</h1>
          <p className="text-slate-500 mt-1">Your digital lab notebook</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-4">{isSignUp ? 'Create Account' : 'Sign In'}</h2>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent text-base"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-transparent text-base"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-2.5 rounded-lg font-medium hover:bg-accent-dark active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-slate-500 mt-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              className="text-primary font-medium hover:text-primary-dark"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
