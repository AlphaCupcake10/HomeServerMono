import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { ContainerSummary } from '@/api/types';

export const containerKeys = {
  list: ['admin', 'containers'] as const,
  logs: (name: string, tail: number, timestamps: boolean) =>
    ['admin', 'containers', name, 'logs', tail, timestamps] as const,
};

export const useContainers = () =>
  useQuery({
    queryKey: containerKeys.list,
    queryFn: () =>
      api<{ containers: ContainerSummary[] }>('/admin/containers').then((r) => r.containers),
    refetchInterval: 15_000,
  });

export const useContainerLogs = (
  name: string | undefined,
  { tail, timestamps, autoRefresh }: { tail: number; timestamps: boolean; autoRefresh: boolean },
) =>
  useQuery({
    queryKey: containerKeys.logs(name ?? '', tail, timestamps),
    queryFn: () =>
      api<{ logs: string }>(
        `/admin/containers/${encodeURIComponent(name!)}/logs?tail=${tail}&timestamps=${timestamps}`,
      ).then((r) => r.logs),
    enabled: Boolean(name),
    refetchInterval: autoRefresh ? 3_000 : false,
  });
