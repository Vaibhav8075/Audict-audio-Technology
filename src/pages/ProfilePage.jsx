import { User } from 'lucide-react'
import PageShell from './PageShell.jsx'

export default function ProfilePage() {
  return (
    <PageShell
      title="Profile"
      subtitle="Account settings and password management."
      icon={User}
    />
  )
}
