import { useMemo, useState } from 'react';
import { Info, Loader2, Lock, Save, Search, Undo2 } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useServerProperties, useUpdateProperties } from './api';

/** The API rejects edits to these (they would cut it off from RCON); rcon.password is never sent. */
const READ_ONLY = new Set(['rcon.port', 'enable-rcon']);

const isBoolean = (value: string | undefined) => value === 'true' || value === 'false';

const PropertiesPage = () => {
  const { data: original, error, isPending } = useServerProperties();
  const update = useUpdateProperties();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const keys = useMemo(
    () =>
      Object.keys(original ?? {})
        .filter((key) => key.toLowerCase().includes(search.trim().toLowerCase()))
        .sort(),
    [original, search],
  );

  const changed = useMemo(
    () =>
      Object.fromEntries(Object.entries(edits).filter(([key, value]) => original?.[key] !== value)),
    [edits, original],
  );
  const changedCount = Object.keys(changed).length;

  const setValue = (key: string, value: string) => setEdits((e) => ({ ...e, [key]: value }));

  const save = () =>
    update.mutate(changed, {
      onSuccess: () => {
        setEdits({});
        toast.success(`Saved ${changedCount} propert${changedCount === 1 ? 'y' : 'ies'}`, {
          description: 'Restart the server to apply the changes.',
        });
      },
    });

  return (
    <>
      <PageHeader
        title="Server properties"
        description="Edit server.properties. Only changed values are saved."
      />

      <div className="space-y-4">
        <Alert>
          <Info />
          <AlertTitle>Changes apply after a restart</AlertTitle>
          <AlertDescription>
            The server reads this file when it starts. Restart it from the{' '}
            <Link to="/minecraft/overview" className="underline underline-offset-4">
              Overview
            </Link>{' '}
            page after saving.
          </AlertDescription>
        </Alert>

        <ErrorAlert error={error} title="Couldn't load server.properties" />
        <ErrorAlert error={update.error} title="Couldn't save the properties" />

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter properties"
            className="pl-9"
            aria-label="Filter properties"
          />
        </div>

        <Card className="py-0">
          <CardContent className="divide-y p-0">
            {isPending &&
              Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="p-3">
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            {original && keys.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {Object.keys(original).length === 0
                  ? 'server.properties is empty or missing. Start the server once to generate it.'
                  : 'No properties match the filter.'}
              </p>
            )}
            {keys.map((key) => {
              const readOnly = READ_ONLY.has(key);
              const value = edits[key] ?? original?.[key] ?? '';
              const dirty = key in changed;
              const id = `prop-${key}`;
              return (
                <div
                  key={key}
                  className={cn(
                    'grid items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,18rem)_1fr]',
                    dirty && 'bg-amber-500/10',
                  )}
                >
                  <label
                    htmlFor={id}
                    className="flex items-center gap-1.5 truncate font-mono text-sm"
                  >
                    {readOnly && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                    {key}
                    {dirty && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />}
                  </label>
                  {isBoolean(original?.[key]) ? (
                    <Switch
                      id={id}
                      checked={value === 'true'}
                      disabled={readOnly}
                      onCheckedChange={(checked) => setValue(key, String(checked))}
                    />
                  ) : (
                    <Input
                      id={id}
                      value={value}
                      readOnly={readOnly}
                      disabled={readOnly}
                      onChange={(e) => setValue(key, e.target.value)}
                      className="font-mono"
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {changedCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <span className="text-sm">
            {changedCount} unsaved change{changedCount === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEdits({})} disabled={update.isPending}>
              <Undo2 /> Reset
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default PropertiesPage;
