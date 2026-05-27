import { Shield } from 'lucide-react'
import PageShell from '../PageShell.jsx'

export default function AdminPage() {
  return (
    <PageShell
      title="Admin Panel"
      subtitle="System controls for users, audits, analytics, and feedback."
      icon={Shield}
    />
  )
}
