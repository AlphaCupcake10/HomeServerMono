import { ArrowRight, Settings, Users } from 'lucide-react';
import { Link } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FEATURES, FEATURE_KEYS } from '@/config/features';
import { isFeatureEnabled, useAppConfig } from '@/config/useAppConfig';
import { useServerStatus } from '@/features/minecraft/api';
import { StatusBadge } from '@/features/minecraft/StatusBadge';
import { formatRelative } from '@/lib/format';

const MinecraftCard = () => {
  const { data: status, isPending } = useServerStatus();
  const { title, description, icon: Icon } = FEATURES.minecraft;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        {isPending ? (
          <Skeleton className="h-5 w-24" />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={status} />
            {status?.running && status.startedAt && (
              <span>since {formatRelative(status.startedAt)}</span>
            )}
          </div>
        )}
        <Button asChild variant="outline" size="sm">
          <Link to="/minecraft/overview">
            Open <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const { data: config, isPending } = useAppConfig();
  const enabled = FEATURE_KEYS.filter((key) => isFeatureEnabled(config, key));

  return (
    <>
      <PageHeader title="Dashboard" description={`Signed in as ${user?.email}`} />

      <div className="grid gap-4 md:grid-cols-2">
        {isPending && <Skeleton className="h-36" />}
        {enabled.includes('minecraft') && <MinecraftCard />}

        {!isPending && enabled.length === 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>No features enabled</CardTitle>
              <CardDescription>
                {user?.role === 'admin'
                  ? 'Turn features on from the Settings page.'
                  : 'Ask the administrator to enable features.'}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {user?.role === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Administration</CardTitle>
              <CardDescription>Manage users, features and runtime settings.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/users">
                  <Users /> Users
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">
                  <Settings /> Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
};

export default DashboardPage;
