import { useEffect, useState, useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Calendar, FileAudio, Mic, RefreshCw, Lock, ChevronDown, ChevronUp, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { auditsAPI } from '../api.js'
import { Badge, Card, EmptyState, SectionHeader } from '../index.jsx'
import useAuthStore from '../authStore.js'

export default function AuditsPage() {
  const [audits, setAudits] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [expandedEmployees, setExpandedEmployees] = useState({})
  const { user } = useAuthStore()
  const { searchQuery } = useOutletContext() || { searchQuery: '' }

  const loadAudits = async () => {
    setLoading(true)
    try {
      let data
      if (user?.role === 'employee') {
        data = await auditsAPI.getPublicList()
      } else {
        data = await auditsAPI.getAll({ per_page: 100 })
      }
      setAudits(data.audits || [])
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load audits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAudits()
  }, [])

  
  useEffect(() => {
    if (audits.length > 0) {
      const initial = {}
      audits.forEach((a) => {
        if (a.employee_id) {
          initial[String(a.employee_id)] = true
        }
      })
      setExpandedEmployees(initial)
    }
  }, [audits])

  const toggleEmployee = (empId) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [String(empId)]: !prev[String(empId)]
    }))
  }

  
  const uniqueEmployees = useMemo(() => {
    const map = new Map()
    audits.forEach((a) => {
      const empId = a.employee_id
      const empName = a.employee_name
      if (empId && empName) {
        map.set(String(empId), empName)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [audits])

  
  const filteredAudits = useMemo(() => {
    let result = audits
    if (selectedEmployeeId) {
      result = result.filter((a) => String(a.employee_id) === String(selectedEmployeeId))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((a) => 
        a.audit_id?.toLowerCase().includes(q) ||
        a.client_name?.toLowerCase().includes(q) ||
        a.employee_name?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q)
      )
    }
    return result
  }, [audits, selectedEmployeeId, searchQuery])

  
  const groupedAudits = useMemo(() => {
    const map = new Map()
    filteredAudits.forEach((audit) => {
      const empId = audit.employee_id || 'unknown'
      const empName = audit.employee_name || 'Unknown Employee'
      if (!map.has(String(empId))) {
        map.set(String(empId), {
          employee_id: empId,
          employee_name: empName,
          audits: []
        })
      }
      map.get(String(empId)).audits.push(audit)
    })
    return Array.from(map.values())
  }, [filteredAudits])

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audits"
        subtitle="Assigned call audits and uploaded recording status."
        action={<button type="button" onClick={loadAudits} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>}
      />

      {}
      {uniqueEmployees.length >= 1 && (
        <Card className="p-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase">Filter Employee:</label>
          <select
            className="input-field max-w-xs text-xs py-1.5 px-3"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="">All Employees</option>
            {uniqueEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </Card>
      )}

      {loading ? (
        <Card className="p-6 text-slate-500 dark:text-white/50">Loading audits...</Card>
      ) : groupedAudits.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Mic} title="No audits available" description="No audits match the selected filter." />
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedAudits.map((group) => {
            const isExpanded = !!expandedEmployees[String(group.employee_id)]

            return (
              <div key={group.employee_id} className="space-y-3">
                {}
                <Card
                  onClick={() => toggleEmployee(group.employee_id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:border-brand/40 transition-all bg-slate-50/50 dark:bg-white/[0.01] select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand">
                      <User size={18} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-slate-800 dark:text-white text-sm">
                        {group.employee_name}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5">
                        {group.audits.length} {group.audits.length === 1 ? 'call audit' : 'call audits'} recorded
                      </p>
                    </div>
                  </div>
                  <div className="text-slate-400 hover:text-slate-700 dark:hover:text-white/70 transition-colors">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </Card>

                {}
                {isExpanded && (
                  <div className="pl-6 border-l border-slate-200 dark:border-white/[0.06] space-y-3 ml-5">
                    {group.audits.map((audit) => {
                      const canReview = user?.role === 'admin' || audit.is_own_audit

                      return (
                        <Card key={audit.id} className="p-5">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-display font-semibold text-slate-800 dark:text-white text-xs">{audit.audit_id}</h3>
                                <Badge variant={audit.status}>{audit.status}</Badge>
                                {audit.recording?.has_file ? (
                                  audit.recording?.is_expired ? (
                                    <Badge variant="gray">audio expired (7d)</Badge>
                                  ) : (
                                    <Badge variant="green">audio ready</Badge>
                                  )
                                ) : (
                                  <Badge variant="gray">no audio</Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-white/60 mt-1">Client: {audit.client_name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1 flex items-center gap-1">
                                <Calendar size={12} /> {audit.call_date ? new Date(audit.call_date).toLocaleString() : 'No date'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-white/40">
                              <div className="flex items-center gap-1.5 text-[11px]">
                                <FileAudio size={14} /> {audit.recording?.has_file && !audit.recording?.is_expired ? 'Uploaded' : 'Unavailable'}
                              </div>
                              {!canReview ? (
                                <span className="inline-flex items-center gap-1 text-slate-400 dark:text-white/30 text-[10px] py-1.5 px-2.5 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200/50 dark:border-white/5 cursor-not-allowed font-semibold">
                                  <Lock size={11} /> Locked (Private)
                                </span>
                              ) : (
                                audit.recording?.has_file && !audit.recording?.is_expired && (
                                  <Link to={`/audits/${audit.id}`} className="btn-primary text-[10px] py-1.5 px-2.5">
                                    Review call
                                  </Link>
                                )
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
