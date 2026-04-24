import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore'
import { auth, firestore } from './firebase'

export interface UserProfile {
  email: string
  createdAt: Timestamp
  lastLoginAt: Timestamp
  status: 'active' | 'blocked'
  role: 'user' | 'admin'
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true })

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Track auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  // Track user profile when signed in
  useEffect(() => {
    if (!user) return
    const ref = doc(firestore, 'users', user.uid)
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        // Auto-create profile for pre-existing accounts
        const now = Timestamp.now()
        const defaultProfile: UserProfile = {
          email: user.email || '',
          createdAt: now,
          lastLoginAt: now,
          status: 'active',
          role: 'user',
        }
        try {
          await setDoc(ref, defaultProfile)
        } catch (err) {
          console.error('Failed to create user profile:', err)
        }
        // onSnapshot will fire again with the created doc
        return
      }
      setProfile(snap.data() as UserProfile)
      setLoading(false)
    }, (err) => {
      console.error('Profile snapshot error:', err)
      setLoading(false)
    })
    return unsub
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
