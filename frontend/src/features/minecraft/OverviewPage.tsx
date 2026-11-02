import { useEffect, useState, type ReactNode } from 'react';
import { Info, Loader2, Play, RefreshCw, Square } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ServerStatus } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative } from '@/lib/format';
import { minecraftKeys, useServerStatus, useStartServer, useStopServer } from './api';
import { StatusBadge } from './StatusBadge';

type Transition = 'starting' | 'stopping' | null;

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="space-y-1">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium break-words">{children}</dd>
  </div>
);

const OverviewPage = () => {
  const queryClient = useQueryClient();
  const [transition, setTransition] = useState<Transition>(null);
  const booting =
    queryClient.getQueryData<ServerStatus>(minecraftKeys.status)?.health === 'starting';
  const {
    data: status,
    error,
    isPending,
    refetch,
    isFetching,
  } = useServerStatus({
    fast: transition !== null || booting,
  });
  const start = useStartServer();
  const stop = useStopServer();

  // A transition ends once the container reaches the target state (or after two minutes).
  const reachedTarget =
    status !== undefined &&
    ((transition === 'starting' && status.running && status.health !== 'starting') ||
      (transition === 'stopping' && !status.running));
  if (reachedTarget) setTransition(null);

  useEffect(() => {
    if (!transition) return;
    const timer = setTimeout(() => setTransition(null), 120_000);
    return () => clearTimeout(timer);
  }, [transition]);

  const missing = status?.state === 'missing';
  const busy = start.isPending || stop.isPending || transition !== null;

  const onStart = () =>
    start.mutate(undefined, {
      onSuccess: () => {
        setTransition('starting');
        toast.success('Starting the Minecraft server…');
      },
      onError: (err) => toast.error(err.message),
    });

  const onStop = () =>
    stop.mutate(undefined, {
      onSuccess: () => {
        setTransition('stopping');
        toast.success('Minecraft server stopped');
      },
      onError: (err) => toast.error(err.message),
    });

  return (
    <>
      <PageHeader
        title="Minecraft server"
        description="Start and stop the server container. It is off unless started here."
        actions={
          <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? 'animate-spin' : undefined} /> Refresh
          </Button>
        }
      />

      <div className="space-y-4">
        <ErrorAlert error={error} title="Couldn't load the server status" />
        <ErrorAlert error={start.error ?? stop.error} title="The last action failed" />

        {missing && (
          <Alert>
            <Info />
            <AlertTitle>The Minecraft container doesn't exist yet</AlertTitle>
            <AlertDescription>
              Create it on the server with <code className="font-mono">make minecraft-create</code>{' '}
              (or <code className="font-mono">make docker-up</code>), then start it here.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Status{' '}
              {isPending ? <Skeleton className="h-5 w-20" /> : <StatusBadge status={status} />}
            </CardTitle>
            <CardDescription>
              {transition === 'starting' && 'Waiting for the server to finish starting…'}
              {transition === 'stopping' && 'Waiting for the container to stop…'}
              {!transition && 'Refreshes automatically.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {status && (
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail label="Container">{status.container}</Detail>
                <Detail label="State">{status.state}</Detail>
                {status.running ? (
                  <Detail label="Started">
                    <span title={formatDateTime(status.startedAt)}>
                      {formatRelative(status.startedAt)}
                    </span>
                  </Detail>
                ) : (
                  <Detail label="Stopped">
                    <span title={formatDateTime(status.finishedAt)}>
                      {formatRelative(status.finishedAt)}
                    </span>
                  </Detail>
                )}
                <Detail label={status.running ? 'Health' : 'Last exit code'}>
                  {status.running ? (status.health ?? '—') : (status.exitCode ?? '—')}
                </Detail>
              </dl>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                onClick={onStart}
                disabled={!status || status.running || missing || busy}
                className="sm:w-32"
              >
                {start.isPending ? <Loader2 className="animate-spin" /> : <Play />} Start
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    variant="destructive"
                    disabled={!status?.running || busy}
                    className="sm:w-32"
                  >
                    {stop.isPending ? <Loader2 className="animate-spin" /> : <Square />} Stop
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Stop the Minecraft server?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Connected players are disconnected. The world is saved before the server shuts
                      down, which can take up to 30 seconds.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onStop}>
                      Stop server
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default OverviewPage;
