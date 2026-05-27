import { BarChart3 } from 'lucide-react'
import PageShell from '../PageShell.jsx'

export default function AdminAnalyticsPage() {
  return (
    <PageShell
      title="Analytics"
      subtitle="Operational performance and audit trends."
      icon={BarChart3}
    />
  )
}
