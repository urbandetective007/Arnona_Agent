import Sidebar from './Sidebar'
import { RoleProvider } from './RoleContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto">
          {children}
        </main>
      </div>
    </RoleProvider>
  )
}
