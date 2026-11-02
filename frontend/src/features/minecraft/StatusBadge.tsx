import type { ServerStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Tone = 'green' | 'amber' | 'gray' | 'red';

/** Human label + colour for a container state (itzg's healthcheck reports "starting" while booting). */
const describeStatus = (status: ServerStatus | undefined): { label: string; tone: Tone } => {
  if (!status) return { label: 'Unknown', tone: 'gray' };
  if (status.state === 'missing') return { label: 'Not created', tone: 'red' };
  if (status.running) {
    if (status.health === 'starting') return { label: 'Starting…', tone: 'amber' };
    if (status.health === 'unhealthy') return { label: 'Unhealthy', tone: 'red' };
    return { label: 'Running', tone: 'green' };
  }
  if (status.state === 'restarting') return { label: 'Restarting…', tone: 'amber' };
  return { label: 'Stopped', tone: 'gray' };
};

const toneClass: Record<Tone, string> = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  gray: 'bg-muted text-muted-foreground',
  red: 'bg-destructive/10 text-destructive',
};

const dotClass: Record<Tone, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500 animate-pulse',
  gray: 'bg-muted-foreground/60',
  red: 'bg-destructive',
};

export const StatusBadge = ({
  status,
  className,
}: {
  status?: ServerStatus;
  className?: string;
}) => {
  const { label, tone } = describeStatus(status);
  return (
    <Badge className={cn(toneClass[tone], className)}>
      <span className={cn('size-1.5 rounded-full', dotClass[tone])} />
      {label}
    </Badge>
  );
};
