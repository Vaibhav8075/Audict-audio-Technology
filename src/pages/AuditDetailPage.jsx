import { useParams } from 'react-router-dom'
import { Mic } from 'lucide-react'
import PageShell from './PageShell.jsx'

export default function AuditDetailPage() {
  const { id } = useParams()

  return (
    <PageShell
      title={`Audit ${id}`}
      subtitle="Recording, feedback, and AI analysis detail."
      icon={Mic}
    />
  )
}
