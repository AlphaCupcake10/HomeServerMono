import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Info, Loader2, RefreshCw, Send, Trash2 } from 'lucide-react';
import { ApiError } from '@/api/client';
import { ErrorAlert } from '@/components/ErrorAlert';
import { LogOutput } from '@/components/LogOutput';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSendCommand, useServerLogs, useServerStatus } from './api';

const TAIL_OPTIONS = [50, 200, 1000];
const HISTORY_LIMIT = 50;

interface TranscriptEntry {
  id: number;
  command: string;
  response?: string;
  error?: string;
}

const LogViewer = () => {
  const [tail, setTail] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { data: logs, error, isFetching, refetch } = useServerLogs(tail, autoRefresh);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server log</CardTitle>
        <CardDescription>Latest container output.</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            aria-label="Refresh log"
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="tail">Lines</Label>
            <Select value={String(tail)} onValueChange={(value) => setTail(Number(value))}>
              <SelectTrigger id="tail" className="w-24">
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
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh">Auto-refresh</Label>
          </div>
        </div>

        <ErrorAlert error={error} title="Couldn't load the log" />
        <LogOutput followKey={logs}>
          {logs === undefined ? 'Loading…' : logs.trim() || 'No log output yet.'}
        </LogOutput>
      </CardContent>
    </Card>
  );
};

const CommandConsole = ({ running }: { running: boolean }) => {
  const send = useSendCommand();
  const [command, setCommand] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [transcript]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = command.trim();
    if (!text) return;
    const id = nextId.current++;
    setTranscript((t) => [...t, { id, command: text }]);
    setHistory((h) => [...h.filter((c) => c !== text), text].slice(-HISTORY_LIMIT));
    setHistoryIndex(null);
    setCommand('');
    send.mutate(text, {
      onSuccess: ({ response }) =>
        setTranscript((t) => t.map((e) => (e.id === id ? { ...e, response } : e))),
      onError: (error) =>
        setTranscript((t) =>
          t.map((e) =>
            e.id === id
              ? {
                  ...e,
                  error:
                    error instanceof ApiError ? `${error.message} (${error.code})` : error.message,
                }
              : e,
          ),
        ),
    });
  };

  // ↑ / ↓ walk through previously sent commands, like a shell.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (history.length === 0) return;
    event.preventDefault();
    const last = history.length - 1;
    const index =
      event.key === 'ArrowUp'
        ? historyIndex === null
          ? last
          : Math.max(0, historyIndex - 1)
        : historyIndex === null || historyIndex >= last
          ? null
          : historyIndex + 1;
    setHistoryIndex(index);
    setCommand(index === null ? '' : history[index]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Console</CardTitle>
        <CardDescription>
          Run server commands over RCON, without the leading slash (e.g. list).
        </CardDescription>
        {transcript.length > 0 && (
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTranscript([])}
              aria-label="Clear transcript"
            >
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!running && (
          <Alert>
            <Info />
            <AlertDescription>
              The server isn't running, so commands will fail until it's started.
            </AlertDescription>
          </Alert>
        )}
        {transcript.length > 0 && (
          <div
            ref={transcriptRef}
            className="max-h-72 space-y-2 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
          >
            {transcript.map((entry) => (
              <div key={entry.id}>
                <div className="font-semibold">&gt; {entry.command}</div>
                {entry.response !== undefined && (
                  <div className="whitespace-pre-wrap text-muted-foreground">
                    {entry.response || '(no output)'}
                  </div>
                )}
                {entry.error && (
                  <div className="whitespace-pre-wrap text-destructive">{entry.error}</div>
                )}
                {entry.response === undefined && !entry.error && (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={submit}>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="list"
            maxLength={256}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            aria-label="Command"
          />
          <Button type="submit" disabled={!command.trim() || send.isPending}>
            {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ConsolePage = () => {
  const { data: status, error } = useServerStatus();
  return (
    <>
      <PageHeader title="Console" description="Live server output and RCON commands." />
      <div className="space-y-4">
        <ErrorAlert error={error} title="Couldn't load the server status" />
        <CommandConsole running={status?.running ?? false} />
        <LogViewer />
      </div>
    </>
  );
};

export default ConsolePage;
