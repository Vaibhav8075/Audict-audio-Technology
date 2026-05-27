import { Brain } from 'lucide-react'
import PageShell from './PageShell.jsx'

export default function AIInsightsPage() {
  return (
    <PageShell
      title="AI Insights"
      subtitle="Transcriptions, summaries, sentiment, and suggestions."
      icon={Brain}
    />
  )
}
