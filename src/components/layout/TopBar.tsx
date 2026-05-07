import { Bell } from 'lucide-react'

interface TopBarProps {
  title: string
  actions?: React.ReactNode
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header
      className="flex items-center px-6 gap-4"
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #E8E8E8',
      }}
    >
      <h1
        className="font-sans font-medium flex-1"
        style={{ fontSize: 16, color: '#000000' }}
      >
        {title}
      </h1>
      {actions}
      <button
        className="flex items-center justify-center transition-colors"
        style={{
          width: 32,
          height: 32,
          color: '#999999',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#666666' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#999999' }}
      >
        <Bell style={{ width: 18, height: 18 }} strokeWidth={1.5} />
      </button>
    </header>
  )
}
