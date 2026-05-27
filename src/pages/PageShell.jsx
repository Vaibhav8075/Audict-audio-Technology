import { Card, SectionHeader, EmptyState } from '../index.jsx'

export default function PageShell({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="space-y-5">
      <SectionHeader title={title} subtitle={subtitle} />
      {children || (
        <Card className="p-6">
          <EmptyState
            icon={Icon}
            title={`${title} is wired`}
            description="Connect this screen to the matching API call when you are ready to build out the workflow."
          />
        </Card>
      )}
    </div>
  )
}
