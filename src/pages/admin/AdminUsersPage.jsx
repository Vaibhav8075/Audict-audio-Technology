import { Users } from 'lucide-react'
import PageShell from '../PageShell.jsx'

export default function AdminUsersPage() {
  return (
    <PageShell
      title="Users"
      subtitle="Create, update, and deactivate platform users."
      icon={Users}
    />
  )
}
