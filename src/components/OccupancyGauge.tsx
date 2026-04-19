import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OccupancyGaugeProps {
  validated: number;
  expected: number;
  className?: string;
  compact?: boolean;
}

const OccupancyGauge = ({ validated, expected, className, compact = false }: OccupancyGaugeProps) => {
  const percent = expected > 0 ? Math.min(100, Math.round((validated / expected) * 100)) : 0;

  // Couleur selon le remplissage (tokens du design system)
  let barColor = 'bg-primary';
  if (percent >= 90) barColor = 'bg-destructive';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Users className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">
          {validated} / {expected}
        </span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
          <div
            className={cn('h-full transition-all duration-500 ease-out', barColor)}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full max-w-sm mx-auto rounded-2xl border border-border bg-card p-4 shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Occupation du soir</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{percent}%</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-foreground tabular-nums">{validated}</span>
        <span className="text-sm text-muted-foreground">
          / {expected} {expected > 1 ? 'personnes attendues' : 'personne attendue'}
        </span>
      </div>

      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500 ease-out', barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default OccupancyGauge;
