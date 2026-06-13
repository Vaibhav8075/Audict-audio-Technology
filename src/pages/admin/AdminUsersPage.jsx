import { useEffect, useState } from 'react'
import {
  Users, UserPlus, Search, RefreshCw, X, Eye, EyeOff,
  UserCheck, AlertTriangle, KeyRound
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAPI } from '../../api.js'
import { Card, SectionHeader, Badge, Modal, Skeleton } from '../../index.jsx'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'employee',
    department: ''
  })
  const [showPassword, setShowPassword] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await adminAPI.getUsers({ per_page: 100 })
      setUsers(data.users || [])
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load users list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!form.email || !form.full_name || !form.password) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      await adminAPI.createUser(form)
      toast.success('User account created successfully')
      setIsModalOpen(false)
      setForm({
        email: '',
        full_name: '',
        password: '',
        role: 'employee',
        department: ''
      })
      await loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create user account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user? They will no longer be able to log in.')) return
    try {
      await adminAPI.deactivateUser(userId)
      toast.success('User account deactivated')
      await loadUsers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Deactivation failed')
    }
  }

  
  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title="Users Management"
        subtitle="Provision and deactivate credentials for system employees and administrators."
        action={
          <div className="flex gap-2">
            <button type="button" onClick={loadUsers} className="btn-secondary">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <UserPlus size={15} /> Create User Account
            </button>
          </div>
        }
      />

      {}
      <Card className="p-4 flex items-center gap-3">
        <Search size={16} className="text-slate-400 dark:text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by full name, email, department..."
          className="bg-transparent border-none outline-none text-sm w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/20"
        />
      </Card>

      {}
      <Card className="p-6">
        {loading ? (
          <Skeleton className="h-60 w-full rounded-xl" />
        ) : (
          <div className="border border-slate-100 dark:border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-white/40 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Assigned Audits</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-600 dark:text-white/70">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No active users matched your search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-white">{user.full_name}</td>
                        <td className="px-4 py-3 font-mono">{user.email}</td>
                        <td className="px-4 py-3 capitalize">{user.department || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.role === 'admin' ? 'admin' : 'employee'}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-semibold">{user.audit_count}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.is_active ? 'green' : 'gray'}>
                            {user.is_active ? 'active' : 'inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {user.is_active && (
                            <button
                              onClick={() => handleDeactivate(user.id)}
                              className="text-xs font-semibold px-3 py-1 rounded bg-bordeauxVelvet/5 dark:bg-bordeauxVelvet/10 hover:bg-bordeauxVelvet/15 text-bordeauxVelvet dark:text-red-300 border border-bordeauxVelvet/15"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create User Credentials">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              placeholder="e.g. John Doe"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 6 characters"
                className="input-field pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Access Role</label>
              <select
                className="input-field"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <option value="employee">Employee / Agent</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={e => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Sales, Support"
                className="input-field"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Creating...' : 'Provision Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
