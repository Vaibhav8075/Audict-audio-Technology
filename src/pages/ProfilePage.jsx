import { useEffect, useState } from 'react'
import { User, ShieldCheck, Mail, Building, Clock, Lock, Save, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersAPI } from '../api.js'
import { Card, SectionHeader, Badge } from '../index.jsx'
import useAuthStore from '../authStore.js'

export default function ProfilePage() {
  const { user: authUser, setUser } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [updatingProfile, setUpdatingProfile] = useState(false)

  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await usersAPI.getProfile()
      setProfile(data)
      setFullName(data.full_name || '')
      setDepartment(data.department || '')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load profile information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    setUpdatingProfile(true)
    try {
      await usersAPI.updateProfile({
        full_name: fullName,
        department: department
      })
      toast.success('Profile details updated successfully')
      
      
      if (authUser) {
        setUser({
          ...authUser,
          full_name: fullName,
          department: department
        })
      }
      
      await loadProfile()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword) {
      toast.error('Current password is required')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setChangingPassword(true)
    try {
      await usersAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      })
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionHeader
        title="Profile Settings"
        subtitle="Manage your personal account profile, password, and system details."
        icon={User}
        action={<button type="button" onClick={loadProfile} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {loading ? (
        <Card className="p-6 text-slate-500 dark:text-white/50">Loading profile settings...</Card>
      ) : !profile ? (
        <Card className="p-6 text-center text-slate-500">Failed to load profile. Please sign out and sign back in.</Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {}
          <div className="space-y-6 md:col-span-1">
            <Card className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shadow-lg">
                <span className="text-brand-600 dark:text-brand-400 font-bold text-2xl">
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 dark:text-white text-lg leading-tight">
                  {profile.full_name}
                </h3>
                <p className="text-xs text-slate-400 dark:text-white/40 mt-1 uppercase font-mono tracking-wider">
                  {profile.role}
                </p>
              </div>

              <div className="w-full pt-4 border-t border-slate-100 dark:border-white/[0.04] space-y-3 text-xs text-left text-slate-600 dark:text-white/60">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-400" />
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building size={14} className="text-slate-400" />
                  <span>{profile.department || 'No department assigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-slate-400" />
                  <Badge variant={profile.role === 'admin' ? 'blue' : 'gray'}>
                    {profile.role === 'admin' ? 'Administrator' : 'Standard User'}
                  </Badge>
                </div>
              </div>
            </Card>

            <Card className="p-5 text-xs space-y-3 text-slate-500 dark:text-white/30">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Clock size={13} /> Created</span>
                <span className="font-mono">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Clock size={13} /> Last Login</span>
                <span className="font-mono">{profile.last_login ? new Date(profile.last_login).toLocaleDateString() : 'First login'}</span>
              </div>
            </Card>
          </div>

          {}
          <div className="space-y-6 md:col-span-2">
            {}
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Save size={16} className="text-brand" /> Edit Personal Information
              </h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Full Name</label>
                    <input
                      className="input-field"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Department</label>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="e.g. Sales, Quality Audit"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={updatingProfile} className="btn-primary text-xs px-4 py-2">
                    {updatingProfile ? 'Saving Details...' : 'Save Profile details'}
                  </button>
                </div>
              </form>
            </Card>

            {}
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Lock size={16} className="text-brand" /> Change Account Password
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Current Password</label>
                    <input
                      className="input-field"
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">New Password</label>
                    <input
                      className="input-field"
                      type="password"
                      required
                      placeholder="Min 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-white/45 mb-1.5 uppercase">Confirm Password</label>
                    <input
                      className="input-field"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={changingPassword} className="btn-primary text-xs px-4 py-2">
                    {changingPassword ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
