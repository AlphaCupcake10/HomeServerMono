import { useState, type ReactNode } from 'react';
import { ChevronRight, Loader2, RefreshCw, Save, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LOG_LEVELS,
  type AuditEntry,
  type LogLevel,
  type RuntimeSettings,
  type RuntimeSettingsUpdate,
} from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FEATURES, FEATURE_KEYS } from '@/config/features';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAdminSettings, useAuditLog, useUpdateSettings } from './api';

const MAX_LIMIT = 100_000;

/** Only what changed, so the audit log records exactly the edit. */
const diffSettings = (from: RuntimeSettings, to: RuntimeSettings): RuntimeSettingsUpdate => {
  const update: RuntimeSettingsUpdate = {};
  const features = Object.fromEntries(
    FEATURE_KEYS.filter((key) => from.features[key].enabled !== to.features[key].enabled).map(
      (key) => [key, to.features[key]],
    ),
  );
  if (Object.keys(features).length > 0) update.features = features;
  if (from.exposeErrorDetails !== to.exposeErrorDetails)
    update.exposeErrorDetails = to.exposeErrorDetails;
  if (from.logLevel !== to.logLevel) update.logLevel = to.logLevel;
  const rateLimit: RuntimeSettingsUpdate['rateLimit'] = {};
  if (from.rateLimit.max !== to.rateLimit.max) rateLimit.max = to.rateLimit.max;
  if (from.rateLimit.authMax !== to.rateLimit.authMax) rateLimit.authMax = to.rateLimit.authMax;
  if (Object.keys(rateLimit).length > 0) update.rateLimit = rateLimit;
  return update;
};

const validLimit = (value: number) => Number.isInteger(value) && value >= 1 && value <= MAX_LIMIT;

const show = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));

/** One-line summary of an audit entry's details. */
const describeDetails = ({ details, target }: AuditEntry): string => {
  const d = (details ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (d.changes && typeof d.changes === 'object') {
    parts.push(
      Object.entries(d.changes as Record<string, { from: unknown; to: unknown }>)
        .map(([path, { from, to }]) => `${path}: ${show(from)} → ${show(to)}`)
        .join('; '),
    );
  } else if (typeof d.command === 'string') {
    parts.push(`/${d.command}`);
  } else if (Array.isArray(d.keys)) {
    parts.push(`keys: ${d.keys.join(', ')}`);
  } else if (typeof d.email === 'string') {
    parts.push(d.email);
  } else if (details !== undefined && details !== null) {
    parts.push(JSON.stringify(details));
  }
  if (target && !parts.some((p) => p.includes(target))) parts.push(target);
  return parts.join(' · ') || '—';
};

const SettingRow = ({
  title,
  description,
  htmlFor,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 space-y-1">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {title}
      </Label>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const AuditLogCard = () => {
  const { data: entries, error, isPending, isFetching, refetch } = useAuditLog(50);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          The latest 50 admin and server actions (kept for 180 days).
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void refetch()}
            aria-label="Refresh audit log"
          >
            <RefreshCw className={cn(isFetching && 'animate-spin')} />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} title="Couldn't load the audit log" />
        {isPending && <Skeleton className="h-32 w-full" />}
        {entries && entries.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No entries yet.</p>
        )}
        {entries && entries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap" title={formatDateTime(entry.createdAt)}>
                    {formatRelative(entry.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {entry.actor?.email ?? 'system'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-64 font-mono text-xs whitespace-normal break-all">
                    {describeDetails(entry)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const SettingsPage = () => {
  const { data, error, isPending } = useAdminSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<RuntimeSettings | null>(null);
  const [showDeployment, setShowDeployment] = useState(false);

  const values = data?.values;
  const current = draft ?? values;
  const changes = values && draft ? diffSettings(values, draft) : {};
  const dirty = Object.keys(changes).length > 0;
  const limitsValid =
    !current || (validLimit(current.rateLimit.max) && validLimit(current.rateLimit.authMax));

  const edit = (change: (s: RuntimeSettings) => RuntimeSettings) => {
    if (current) setDraft(change(structuredClone(current)));
  };

  const save = () =>
    update.mutate(changes, {
      onSuccess: () => {
        setDraft(null);
        toast.success('Settings saved', { description: 'Changes are already in effect.' });
      },
    });

  const windowMs = (data?.deployment.rateLimit as { windowMs?: number } | undefined)?.windowMs;
  const windowLabel = windowMs ? `${Math.round(windowMs / 60_000)} minute` : 'configured';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Runtime settings, stored in the database and applied immediately. Only you can see this page."
      />

      <div className="space-y-4">
        <ErrorAlert error={error} title="Couldn't load the settings" />
        <ErrorAlert error={update.error} title="Couldn't save the settings" />

        {isPending && <Skeleton className="h-64 w-full" />}

        {current && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
                <CardDescription>
                  A disabled feature disappears from the sidebar for everyone and its API calls are
                  rejected. Disabling doesn't stop anything that is already running.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {FEATURE_KEYS.map((key) => {
                  const { title, description, icon: Icon } = FEATURES[key];
                  return (
                    <SettingRow
                      key={key}
                      htmlFor={`feature-${key}`}
                      title={
                        <span className="flex items-center gap-2">
                          <Icon className="size-4" /> {title}
                        </span>
                      }
                      description={description}
                    >
                      <Switch
                        id={`feature-${key}`}
                        aria-label={`Enable ${title}`}
                        checked={current.features[key].enabled}
                        onCheckedChange={(enabled) =>
                          edit((s) => ({ ...s, features: { ...s.features, [key]: { enabled } } }))
                        }
                      />
                    </SettingRow>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diagnostics</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <SettingRow
                  htmlFor="expose-errors"
                  title="Detailed error responses"
                  description="Include the underlying error (name, message, code) in 5xx responses. Turn off if the API is reachable from the internet."
                >
                  <Switch
                    id="expose-errors"
                    checked={current.exposeErrorDetails}
                    onCheckedChange={(exposeErrorDetails) =>
                      edit((s) => ({ ...s, exposeErrorDetails }))
                    }
                  />
                </SettingRow>
                <SettingRow
                  htmlFor="log-level"
                  title="Log level"
                  description="Use debug while troubleshooting; info for normal operation."
                >
                  <Select
                    value={current.logLevel}
                    onValueChange={(logLevel) =>
                      edit((s) => ({ ...s, logLevel: logLevel as LogLevel }))
                    }
                  >
                    <SelectTrigger id="log-level" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate limits</CardTitle>
                <CardDescription>
                  Per client IP over a {windowLabel} window (the window is set in config.yaml).
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {(
                  [
                    [
                      'max',
                      'Anonymous API requests',
                      'Requests without a valid sign-in (signed-in users are not limited).',
                    ],
                    ['authMax', 'Failed sign-in attempts', 'Failed login and refresh attempts.'],
                  ] as const
                ).map(([key, title, description]) => (
                  <SettingRow
                    key={key}
                    htmlFor={`limit-${key}`}
                    title={title}
                    description={description}
                  >
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      min={1}
                      max={MAX_LIMIT}
                      step={1}
                      className="w-32"
                      aria-invalid={!validLimit(current.rateLimit[key])}
                      value={current.rateLimit[key] || ''}
                      onChange={(e) =>
                        edit((s) => ({
                          ...s,
                          rateLimit: { ...s.rateLimit, [key]: Number(e.target.value) },
                        }))
                      }
                    />
                  </SettingRow>
                ))}
                {!limitsValid && (
                  <p className="pt-3 text-sm text-destructive">
                    Limits must be whole numbers from 1 to {MAX_LIMIT}.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {data?.updatedBy
                  ? `Last changed by ${data.updatedBy.email} ${formatRelative(data.updatedAt)}`
                  : 'Using the defaults from config.yaml.'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDraft(null)}
                  disabled={!dirty || update.isPending}
                >
                  <Undo2 /> Reset
                </Button>
                <Button onClick={save} disabled={!dirty || !limitsValid || update.isPending}>
                  {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
                </Button>
              </div>
            </div>

            <Card>
              <Collapsible open={showDeployment} onOpenChange={setShowDeployment}>
                <CardHeader>
                  <CollapsibleTrigger className="flex items-center gap-2 text-left">
                    <ChevronRight
                      className={cn('size-4 transition-transform', showDeployment && 'rotate-90')}
                    />
                    <CardTitle>Deployment config</CardTitle>
                  </CollapsibleTrigger>
                  <CardDescription>
                    Read-only. Loaded from backend/config/*.yaml at startup; edit those files and
                    restart the API to change it. `runtimeDefaults` only seeds the settings above.
                  </CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
                      {JSON.stringify(data?.deployment, null, 2)}
                    </pre>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </>
        )}

        <AuditLogCard />
      </div>
    </>
  );
};

export default SettingsPage;
