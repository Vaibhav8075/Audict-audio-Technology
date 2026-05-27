import { useRef, useState, useEffect } from 'react'
import { motion } from 'framer-motion'

import Header from '../components/dashboard/Header'
import Stats from '../components/dashboard/Stats'
import CategoryView from '../components/dashboard/CategoryView'
import ClientView from '../components/dashboard/ClientView'
import CallModal from '../components/dashboard/CallModal'
import AudioUpload from '../components/dashboard/AudioUpload'
import Queue from '../components/dashboard/Queue'
import Tips from '../components/dashboard/Tips'

const API_BASE_URL = 'http://127.0.0.1:8000'
const API_KEY = 'banking_secret_key_2024_change_this_in_production'

export default function Home() {
  const fileInputRef = useRef(null)
  const [calls, setCalls] = useState([])
  const [selectedCall, setSelectedCall] = useState(null)
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState('category')
  const [stats, setStats] = useState({ total: 0, high: 0, urgent: 0 })

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    handleAnalyzeCall(file)
  }

  async function handleAnalyzeCall(file) {
    const tempId = Date.now()

    setCalls(prev => [
      {
        id: tempId,
        title: file.name,
        status: 'processing',
      },
      ...prev,
    ])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`${API_BASE_URL}/api/calls/analyze`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
        },
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || 'Analyze failed')
      }

      const { call_id } = await res.json()

      let data = null
      for (let i = 0; i < 30; i++) {
        const resultRes = await fetch(`${API_BASE_URL}/api/calls/result/${call_id}`, {
          headers: {
            'X-API-Key': API_KEY,
          },
        })

        if (!resultRes.ok) {
          throw new Error('Failed to fetch result')
        }

        data = await resultRes.json()
        if (data.status === 'completed') break
        await new Promise(r => setTimeout(r, 2000))
      }

      if (!data || data.status !== 'completed') {
        throw new Error('Processing timed out')
      }

      const mappedCall = {
        id: call_id,
        title: file.name,
        status: 'completed',

        customer_details: data.customer_details || {},

        rule_based: data.rule_based || {},

        ai_verification: data.ai_verification || {
          verified_intent: data.rule_based?.intent?.label,
          verified_priority: data.rule_based?.priority,
          reasoning: ['AI verification not available'],
        },

        final_decision: data.final_decision || {
          intent: data.rule_based?.intent?.label,
          priority: data.rule_based?.priority,
        },

        intent: {
          label: data.final_decision?.intent || data.rule_based?.intent?.label || 'General Inquiry',
          confidence: data.rule_based?.intent?.confidence || 'Medium',
        },
        sentiment: data.rule_based?.sentiment || { label: 'Neutral', score: 0 },
        priority: (data.final_decision?.priority || data.rule_based?.priority || 'Medium').toLowerCase(),
        risk_level: data.rule_based?.sentiment?.label === 'Negative' ? 'High' : 'Low',

        summary: data.summary || [],
        transcript: data.transcript || '',

        action_items: buildActionItems(data),
      }

      setCalls(prev =>
        prev.map(call => (call.id === tempId ? mappedCall : call))
      )
    } catch (err) {
      console.error(err)
      
      if (err.message.includes('401') || err.message.includes('Invalid or missing API key')) {
        alert('Authentication failed: Invalid API key. Please check your configuration.')
      } else if (err.message.includes('429') || err.message.includes('rate limit')) {
        alert('Rate limit exceeded. Please wait a moment and try again.')
      } else {
        alert('Backend error: ' + err.message)
      }
      
      setCalls(prev => prev.filter(c => c.id !== tempId))
    }
  }

  function buildActionItems(data) {
    const intent = data.final_decision?.intent || data.rule_based?.intent?.label || ''
    const priority = data.final_decision?.priority || data.rule_based?.priority || 'Medium'
    const customerName = data.customer_details?.name || 'Customer'

    const items = []

    if (intent.toLowerCase().includes('loan')) {
      items.push({ task: `Process loan inquiry for ${customerName}`, completed: false })
    } else if (intent.toLowerCase().includes('withdrawal')) {
      items.push({ task: `Process withdrawal request for ${customerName}`, completed: false })
    } else if (intent.toLowerCase().includes('deposit')) {
      items.push({ task: `Process deposit request for ${customerName}`, completed: false })
    } else if (intent.toLowerCase().includes('complaint')) {
      items.push({ task: `Resolve complaint from ${customerName}`, completed: false })
    } else {
      items.push({ task: `Follow up with ${customerName} regarding inquiry`, completed: false })
    }

    if (priority === 'High' || data.rule_based?.sentiment?.label === 'Negative') {
      items.push({ task: `Escalate to senior banker — high priority case`, completed: false })
    }

    return items
  }

  useEffect(() => {
    const high = calls.filter(c => c.priority === 'high').length
    const urgent = calls.filter(c => c.risk_level === 'High').length

    setStats({
      total: calls.filter(c => c.status === 'completed').length,
      high,
      urgent,
    })
  }, [calls])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen"
      style={{ background: "#EBE3D2", color: "#414833" }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Header
          query={query}
          setQuery={setQuery}
          onUpload={handleUploadClick}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
        />

        <Stats stats={stats} />

        <div className="flex gap-4 mt-8 mb-6">
          <button
            onClick={() => setActiveView('category')}
            className="px-6 py-2.5 rounded-lg font-semibold transition-all hover:opacity-90"
            style={activeView === 'category'
              ? { background: '#414833', color: '#EBE3D2', boxShadow: '0 4px 14px #41483340' }
              : { background: '#CCBFA366', color: '#737A5D', border: '1px solid #CCBFA3' }}
          >
            Category View
          </button>
          <button
            onClick={() => setActiveView('client')}
            className="px-6 py-2.5 rounded-lg font-semibold transition-all hover:opacity-90"
            style={activeView === 'client'
              ? { background: '#414833', color: '#EBE3D2', boxShadow: '0 4px 14px #41483340' }
              : { background: '#CCBFA366', color: '#737A5D', border: '1px solid #CCBFA3' }}
          >
            Client View
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {activeView === 'category' ? (
              <CategoryView
                calls={calls.filter(c => c.status === 'completed')}
                onOpenCall={(call) => setSelectedCall(call)}
              />
            ) : (
              <ClientView
                calls={calls.filter(c => c.status === 'completed')}
                onOpenCall={(call) => setSelectedCall(call)}
              />
            )}
          </div>

          <div className="space-y-6">
            <AudioUpload onAnalyze={handleAnalyzeCall} />
            <Queue calls={calls.filter(c => c.status === 'processing')} />
            <Tips />
          </div>
        </div>
      </div>

      <CallModal
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
      />
    </motion.div>
  )
}