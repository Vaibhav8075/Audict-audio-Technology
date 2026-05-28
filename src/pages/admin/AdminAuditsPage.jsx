import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, FileAudio, FileText, RefreshCw, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAPI, auditsAPI, recordingsAPI } from '../../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../../index.jsx'

const createAuditId = () => `AUD-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`
const createLocalDateTime = () => new Date().toISOString().slice(0, 16)

export default function AdminAuditsPage() {
  const [audits, setAudits] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [form, setForm] = useState(() => ({
    audit_id: createAuditId(),
    client_name: '',
    employee_id: '',
    call_date: createLocalDateTime(),
  }))

  const employees = useMemo(
    () => users.filter((user) => user.role === 'employee' && user.is_active),
    [users],
  )

  const filteredAudits = useMemo(() => {
    if (!selectedEmployeeId) return audits
    return audits.filter((a) => String(a.employee_id) === String(selectedEmployeeId))
  }, [audits, selectedEmployeeId])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [auditData, userData] = await Promise.all([
        auditsAPI.getAll({ per_page: 100 }),
        adminAPI.getUsers({ per_page: 100 }),
      ])
      setAudits(auditData.audits || [])
      setUsers(userData.users || [])
      const employee = userData.users?.find((user) => user.role === 'employee')
      if (employee) {
        setForm((current) => current.employee_id ? current : { ...current, employee_id: String(employee.id) })
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load audits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createAudit = async (event) => {
    event.preventDefault()
    if (!form.client_name || !form.employee_id || !form.audit_id) {
      toast.error('Add audit ID, client, and employee')
      return
    }
    setSaving(true)
    try {
      await auditsAPI.create({
        audit_id: form.audit_id,
        client_name: form.client_name,
        employee_id: Number(form.employee_id),
        call_date: new Date(form.call_date).toISOString(),
      })
      toast.success('Audit created')
      setForm((current) => ({
        ...current,
        audit_id: createAuditId(),
        client_name: '',
      }))
      await loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not create audit')
    } finally {
      setSaving(false)
    }
  }

  const uploadAudio = async (auditId, file) => {
    if (!file) return
    setUploadingId(auditId)
    try {
      await recordingsAPI.upload(auditId, file)
      toast.success('Audio uploaded')
      await loadData()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed')
    } finally {
      setUploadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Manage Audits"
        subtitle="Create an audit, assign it to an employee, then upload the call audio."
        action={<button type="button" onClick={loadData} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      <Card className="p-6">
        <form onSubmit={createAudit} className="grid gap-4 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Audit ID</label>
            <input className="input-field" value={form.audit_id} onChange={(event) => setForm({ ...form, audit_id: event.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Client name</label>
            <input className="input-field" value={form.client_name} onChange={(event) => setForm({ ...form, client_name: event.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Employee</label>
            <select className="input-field" value={form.employee_id} onChange={(event) => setForm({ ...form, employee_id: event.target.value })}>
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-1.5">Call date</label>
            <input type="datetime-local" className="input-field" value={form.call_date} onChange={(event) => setForm({ ...form, call_date: event.target.value })} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
              <FileText size={15} /> {saving ? 'Creating...' : 'Create audit'}
            </button>
          </div>
        </form>
      </Card>

      {/* Employee filter dropdown */}
      {employees.length > 0 && (
        <Card className="p-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase">Filter Employee:</label>
          <select
            className="input-field max-w-xs text-xs py-1.5 px-3"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name}
              </option>
            ))}
          </select>
        </Card>
      )}

      <div className="grid gap-4">
        {loading ? (
          <Card className="p-6 text-slate-500 dark:text-white/50">Loading audits...</Card>
        ) : filteredAudits.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={FileAudio} title="No audits match filter" description="Select a different employee or create an audit above." />
          </Card>
        ) : (
          filteredAudits.map((audit) => (
            <Card key={audit.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display font-semibold text-slate-800 dark:text-white">{audit.audit_id}</h3>
                    <Badge variant={audit.status}>{audit.status}</Badge>
                    {audit.recording?.has_file && <Badge variant="green">audio uploaded</Badge>}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-white/60 mt-1">{audit.client_name} - {audit.employee_name}</p>
                  <p className="text-xs text-slate-400 dark:text-white/35 mt-1 flex items-center gap-1">
                    <Calendar size={13} /> {audit.call_date ? new Date(audit.call_date).toLocaleString() : 'No date'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  {audit.recording?.has_file && (
                    <Link to={`/audits/${audit.id}`} className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap justify-center">
                      Review call
                    </Link>
                  )}
                  <label className="btn-secondary cursor-pointer justify-center whitespace-nowrap">
                    <Upload size={15} /> {uploadingId === audit.id ? 'Uploading...' : 'Upload audio'}
                    <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg" className="hidden" disabled={uploadingId === audit.id} onChange={(event) => uploadAudio(audit.id, event.target.files?.[0])} />
                  </label>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
