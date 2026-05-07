import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CopyButtonProps {
  value: string
  className?: string
}

export function CopyButton({ value, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded transition-colors hover:bg-[#F0F0F0]',
        className
      )}
      title="コピー"
    >
      {copied ? (
        <Check className="h-4 w-4" style={{ color: '#4A9E5C' }} />
      ) : (
        <Copy className="h-4 w-4" style={{ color: '#CCCCCC' }} />
      )}
    </button>
  )
}
