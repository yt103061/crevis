import { cn, scoreBg } from '@/lib/utils'

interface ScoreBadgeProps {
  score: number
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ScoreBadge({ score, label, size = 'md', className }: ScoreBadgeProps) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-lg px-4 py-2 font-bold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        scoreBg(score),
        sizes[size],
        className
      )}
    >
      {label && <span className="opacity-70">{label}</span>}
      <span className="font-num">{score}</span>
    </span>
  )
}
