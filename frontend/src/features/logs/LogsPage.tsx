import { useMemo, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { ContainerSummary } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LogOutput } from '@/components/LogOutput';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useContainerLogs, useContainers } from './api';
import { formatLogLine, type LogTone } from './formatLogLine';

const TAIL_OPTIONS = [100, 500, 2000, 5000];

const toneClass: Record<LogTone, string> = {
  error: 'text-red-400',
  warn: 'text-amber-300',
  debug: 'text-zinc-500',
  plain: '',
};

const StateBadge = ({ state }: { state: string }) => (
  <Badge
    className={cn(
      'capitalize',
      state === 'running'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : 'bg-muted text-muted-foreground',
    )}
  >
    {state}
  </Badge>
);

/** Desktop: a list of the stack's containers to pick from. */
const ContainerList = ({
  containers,
  selected,
  onSelect,
}: {
  containers: ContainerSummary[];
  selected: string | undefined;
  onSelect: (name: string) => void;
}) => (
  <nav className="space-y-1" aria-label="Containers">
    {containers.map((c) => (
      <button
        key={c.name}
        type="button"
        onClick={() => onSelect(c.name)}
        aria-current={c.name === selected ? 'true' : undefined}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted',
          c.name === selected ? 'border-primary bg-muted' : 'border-transparent',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium">{c.service || c.name}</span>
          <StateBadge state={c.state} />
        </div>
        <div className="truncate text-xs text-muted-foreground">{c.name}</div>
        <div className="truncate text-xs text-muted-foreground">{c.status}</div>
      </button>
    ))}
  </nav>
);

const LogsPage = () => {
  const [params, setParams] = useSearchParams();
  const { data: containers, error: listError, isPending } = useContainers();
  const [tail, setTail] = useState(500);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [pretty, setPretty] = useState(true);
  const [filter, setFilter] = useState('');

  // ?container= keeps the selection linkable; default to the API, else the first container.
  const requested = params.get('container');
  const selected =
    containers?.find((c) => c.name === requested)?.name ??
    containers?.find((c) => c.service === 'api')?.name ??
    containers?.[0]?.name;
  const current = containers?.find((c) => c.name === selected);
  const select = (name: string) => setParams({ container: name }, { replace: true });

  const {
    data: logs,
    error: logsError,
    isFetching,
    refetch,
  } = useContainerLogs(selected, { tail, timestamps, autoRefresh });

  const lines = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (logs ?? '')
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => formatLogLine(line, pretty))
      .filter((line) => !needle || line.text.toLowerCase().includes(needle));
  }, [logs, pretty, filter]);

  const download = () => {
    if (!logs || !selected) return;
    const url = URL.createObjectURL(new Blob([logs], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selected}-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Logs"
        description="Read-only output of the containers in this stack. Only the super admin can see this page."
      />

      <ErrorAlert error={listError} title="Couldn't list the containers" />

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          {isPending && <Skeleton className="h-48 w-full" />}
          {containers && (
            <ContainerList containers={containers} selected={selected} onSelect={select} />
          )}
        </div>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {current ? current.service || current.name : 'Container'}
              {current && <StateBadge state={current.state} />}
            </CardTitle>
            <CardDescription className="truncate">
              {current ? `${current.name} · ${current.image}` : 'No container selected'}
            </CardDescription>
            <CardAction className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={download}
                disabled={!logs}
                aria-label="Download log"
              >
                <Download />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void refetch()}
                disabled={!selected}
                aria-label="Refresh log"
              >
                <RefreshCw className={cn(isFetching && 'animate-spin')} />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mobile/tablet: containers as a select instead of the side list. */}
            {containers && containers.length > 0 && (
              <div className="lg:hidden">
                <Label htmlFor="container" className="sr-only">
                  Container
                </Label>
                <Select value={selected} onValueChange={select}>
                  <SelectTrigger id="container" className="w-full">
                    <SelectValue placeholder="Choose a container" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.service || c.name} · {c.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="log-tail">Lines</Label>
                <Select value={String(tail)} onValueChange={(value) => setTail(Number(value))}>
                  <SelectTrigger id="log-tail" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAIL_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="logs-auto" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="logs-auto">Auto-refresh</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="logs-pretty" checked={pretty} onCheckedChange={setPretty} />
                <Label htmlFor="logs-pretty">Pretty JSON</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="logs-ts" checked={timestamps} onCheckedChange={setTimestamps} />
                <Label htmlFor="logs-ts">Docker timestamps</Label>
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter lines"
                className="pl-9"
                aria-label="Filter log lines"
              />
            </div>

            <ErrorAlert error={logsError} title="Couldn't load the log" />

            <LogOutput followKey={`${selected}:${logs}`} className="h-[60vh]">
              {!selected
                ? 'No containers found for this stack.'
                : logs === undefined
                  ? 'Loading…'
                  : lines.length === 0
                    ? filter
                      ? 'No lines match the filter.'
                      : 'No log output.'
                    : lines.map((line, i) => (
                        <div key={i} className={toneClass[line.tone]}>
                          {line.text}
                        </div>
                      ))}
            </LogOutput>
            {logs !== undefined && (
              <p className="text-xs text-muted-foreground">
                {filter ? `${lines.length} matching lines · ` : ''}
                last {tail} lines{autoRefresh ? ' · refreshing every 3s' : ''}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LogsPage;
