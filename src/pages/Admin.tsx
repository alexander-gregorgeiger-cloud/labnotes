import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase'
import { useAuth } from '../AuthContext'
import { ArrowLeft, Shield, Ban, Check } from 'lucide-react'
import type { UserProfile } from '../AuthContext'

interface UserRow extends UserProfile {
  uid: string
}

export default function Admin() {
  const navigate = useNavigate()
  const { user: currentUser, profile } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyUid, setBusyUid] = useState<string | null>(null)

  // Load all users
  useEffect(() => {
    if (profile?.role !== 'admin') return
    const q = query(collection(firestore, 'users'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const rows: UserRow[] = snap.docs.map(d => ({ uid: d.id, ...(d.data() as UserProfile) }))
      setUsers(rows)
      setLoading(false)
    }, (err) => {
      console.error('Admin users snapshot error:', err)
      setLoading(false)
    })
    return unsub
  }, [profile?.role])

  // Non-admins should not reach this page, but guard anyway
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500">Admin access required.</p>
          <button onClick={() => navigate('/')} className="mt-3 text-primary font-medium hover:underline">
            Back home
          </button>
        </div>
      </div>
    )
  }

  async function setStatus(uid: string, status: 'active' | 'blocked') {
    setBusyUid(uid)
    try {
      await updateDoc(doc(firestore, 'users', uid), { status })
    } catch (err) {
      console.error('Failed to update status:', err)
      alert('Failed to update user status. See console.')
    } finally {
      setBusyUid(null)
    }
  }

  async function setRole(uid: string, role: 'user' | 'admin') {
    setBusyUid(uid)
    try {
      await updateDoc(doc(firestore, 'users', uid), { role })
    } catch (err) {
      console.error('Failed to update role:', err)
      alert('Failed to update user role. See console.')
    } finally {
      setBusyUid(null)
    }
  }

  function fmtDate(ts?: { toDate: () => Date } | null): string {
    if (!ts) return '—'
    try {
      return ts.toDate().toLocaleString()
    } catch {
      return '—'
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 pb-12">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Administration</h1>
            <p className="text-sm text-slate-500">{users.length} registered {users.length === 1 ? 'user' : 'users'}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Created</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Last login</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Role</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isSelf = u.uid === currentUser?.uid
                    const isBlocked = u.status === 'blocked'
                    const isAdmin = u.role === 'admin'
                    return (
                      <tr key={u.uid} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {u.email}
                          {isSelf && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(u.lastLoginAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {isBlocked ? <Ban className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                            {isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            isAdmin ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isAdmin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setStatus(u.uid, isBlocked ? 'active' : 'blocked')}
                              disabled={isSelf || busyUid === u.uid}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                isBlocked
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-red-50 text-red-700 hover:bg-red-100'
                              }`}
                              title={isSelf ? 'You cannot block yourself' : undefined}
                            >
                              {isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              onClick={() => setRole(u.uid, isAdmin ? 'user' : 'admin')}
                              disabled={isSelf || busyUid === u.uid}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isSelf ? 'You cannot change your own role' : undefined}
                            >
                              {isAdmin ? 'Demote' : 'Promote'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
