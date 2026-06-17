import { useEffect, useState, useMemo } from 'react'
import {
  TrendingUp, Award, MessageSquare, Shield,
  RefreshCw, Search, ArrowUpDown, Download,
  User, BarChart3, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminAPI } from '../api.js'
import { Card, SectionHeader, StatCard, Skeleton, Badge, ProgressBar } from '../index.jsx'

export default function ScorecardPage() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [sortConfig, setSortConfig] = useState({ key: 'avg_quality_score', direction: 'desc' })

  const loadScorecard = async () => {
    setLoading(true)
    try {
      const data = await adminAPI.getEmployeeAnalytics()
      setEmployees(data || [])
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not load employee performance metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadScorecard()
  }, [])

  // List of unique departments for filter dropdown
  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean))
    return ['all', ...Array.from(depts)]
  }, [employees])

  // CSV Export handler
  const handleExportCSV = () => {
    if (employees.length === 0) {
      toast.error('No employee performance data to export')
      return
    }

    const headers = [
      'Employee Name',
      'Email Address',
      'Department',
      'Total Audits Assigned',
      'Completed Audits',
      'Average AI Quality Score (%)',
      'Average CSAT Score (%)',
      'Average Customer Feedback Rating (1-5)',
      'Average HOD QA Rating (1-5)'
    ]

    const csvRows = [
      headers.join(','),
      ...employees.map(e => [
        `"${e.full_name}"`,
        `"${e.email}"`,
        `"${e.department || 'N/A'}"`,
        e.total_audits,
        e.completed_audits,
        e.avg_quality_score,
        e.avg_csat_score,
        e.avg_feedback_rating,
        e.avg_qa_rating
      ].join(','))
    ]

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `employee_scorecard_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Scorecard metrics exported successfully')
  }

  // Sort handler
  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Filter and sort employees list
  const processedEmployees = useMemo(() => {
    let list = [...employees]

    // 1. Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      list = list.filter(e => 
        e.full_name?.toLowerCase().includes(query) ||
        e.email?.toLowerCase().includes(query)
      )
    }

    // 2. Department filter
    if (selectedDept !== 'all') {
      list = list.filter(e => e.department === selectedDept)
    }

    // 3. Sorting
    list.sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      // Default to numeric sort
      return sortConfig.direction === 'asc'
        ? (aVal ?? 0) - (bVal ?? 0)
        : (bVal ?? 0) - (aVal ?? 0)
    })

    return list
  }, [employees, searchQuery, selectedDept, sortConfig])

  // Global scorecard metrics
  const globalSummary = useMemo(() => {
    if (employees.length === 0) return { avgQuality: 0, avgCSAT: 0, totalAudits: 0 }
    
    let totalQuality = 0
    let totalCSAT = 0
    let totalAuditsCount = 0
    let qualityCount = 0
    let csatCount = 0

    employees.forEach(e => {
      totalAuditsCount += e.total_audits
      if (e.avg_quality_score > 0) {
        totalQuality += e.avg_quality_score
        qualityCount++
      }
      if (e.avg_csat_score > 0) {
        totalCSAT += e.avg_csat_score
        csatCount++
      }
    })

    return {
      avgQuality: qualityCount > 0 ? Math.round(totalQuality / qualityCount) : 0,
      avgCSAT: csatCount > 0 ? Math.round(totalCSAT / csatCount) : 0,
      totalAudits: totalAuditsCount
    }
  }, [employees])

  return (
    <div className="space-y-6 pb-12">
      <SectionHeader
        title="Employee Performance Scorecard"
        subtitle="Track aggregate call audit statistics, AI quality assessments, and HOD evaluations."
        action={
          <div className="flex gap-2">
            <button
              onClick={loadScorecard}
              className="btn-secondary"
              title="Refresh Performance Scorecard"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={handleExportCSV}
              className="btn-primary"
              title="Export metrics to CSV file"
            >
              <Download size={15} /> Export Scorecard
            </button>
          </div>
        }
      />

      {/* Overview stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Leaderboard Avg Call Quality"
          value={`${globalSummary.avgQuality}%`}
          icon={Award}
          color="orange"
          loading={loading}
        />
        <StatCard
          label="Leaderboard Avg Satisfaction"
          value={`${globalSummary.avgCSAT}%`}
          icon={TrendingUp}
          color="green"
          loading={loading}
        />
        <StatCard
          label="Total Audited Calls"
          value={globalSummary.totalAudits}
          icon={BarChart3}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Filter Options Bar */}
      <div className="grid gap-4 md:grid-cols-4 items-center">
        <Card className="md:col-span-3 p-4 flex items-center gap-3">
          <Search size={16} className="text-slate-400 dark:text-white/35" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search employees by name or email..."
            className="bg-transparent border-none outline-none text-sm w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/20"
          />
        </Card>

        <div>
          <select
            className="input-field"
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
          >
            <option value="all">All Departments</option>
            {departments.filter(d => d !== 'all').map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scorecard Table Card */}
      <Card className="p-6">
        {loading ? (
          <Skeleton className="h-60 w-full rounded-xl" />
        ) : (
          <div className="border border-slate-100 dark:border-white/[0.06] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06] text-slate-500 dark:text-white/40 uppercase font-semibold">
                  <tr>
                    <th 
                      onClick={() => requestSort('full_name')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Employee Name <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                    <th className="px-4 py-3">Department</th>
                    <th 
                      onClick={() => requestSort('total_audits')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors text-center"
                    >
                      <div className="flex items-center gap-1 justify-center">
                        Total Audits <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('avg_quality_score')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        AI Quality Score <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('avg_csat_score')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Avg CSAT <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('avg_feedback_rating')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors text-center"
                    >
                      <div className="flex items-center gap-1 justify-center">
                        Feedback Rating <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                    <th 
                      onClick={() => requestSort('avg_qa_rating')}
                      className="px-4 py-3 cursor-pointer hover:text-slate-800 dark:hover:text-white transition-colors text-center"
                    >
                      <div className="flex items-center gap-1 justify-center">
                        HOD QA Rating <ArrowUpDown size={12} className="opacity-50" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04] text-slate-600 dark:text-white/70">
                  {processedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No employee performance records match your active search filters.
                      </td>
                    </tr>
                  ) : (
                    processedEmployees.map((e) => (
                      <tr key={e.employee_id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-brand">
                              {e.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-white">{e.full_name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-white/30 font-mono mt-0.5">{e.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 capitalize">{e.department || 'N/A'}</td>
                        <td className="px-4 py-3.5 text-center font-semibold">{e.total_audits}</td>
                        <td className="px-4 py-3.5">
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold">
                              <span>{e.avg_quality_score}%</span>
                            </div>
                            <ProgressBar value={e.avg_quality_score} color={e.avg_quality_score >= 80 ? 'green' : 'orange'} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold">
                              <span>{e.avg_csat_score}%</span>
                            </div>
                            <ProgressBar value={e.avg_csat_score} color={e.avg_csat_score >= 80 ? 'green' : 'orange'} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {e.avg_feedback_rating > 0 ? (
                            <Badge variant="orange" className="font-bold">
                              {e.avg_feedback_rating} / 5
                            </Badge>
                          ) : (
                            <span className="text-slate-400 dark:text-white/20">No ratings</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {e.avg_qa_rating > 0 ? (
                            <Badge variant="hod" className="font-bold">
                              {e.avg_qa_rating} / 5
                            </Badge>
                          ) : (
                            <span className="text-slate-400 dark:text-white/20">Unreviewed</span>
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
    </div>
  )
}
