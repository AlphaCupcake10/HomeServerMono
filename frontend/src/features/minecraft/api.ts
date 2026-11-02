import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { CommandResult, ServerStatus } from '@/api/types';

export const minecraftKeys = {
  all: ['minecraft'] as const,
  status: ['minecraft', 'status'] as const,
  logs: (tail: number) => ['minecraft', 'logs', tail] as const,
  properties: ['minecraft', 'properties'] as const,
};

/** Polls fast while a start/stop is in progress, slowly otherwise. */
export const useServerStatus = ({ fast = false }: { fast?: boolean } = {}) =>
  useQuery({
    queryKey: minecraftKeys.status,
    queryFn: () => api<ServerStatus>('/minecraft/status'),
    refetchInterval: fast ? 3_000 : 15_000,
  });

const usePowerMutation = (action: 'start' | 'stop') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ container: string }>(`/minecraft/${action}`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: minecraftKeys.status }),
  });
};

export const useStartServer = () => usePowerMutation('start');
export const useStopServer = () => usePowerMutation('stop');

export const useServerLogs = (tail: number, autoRefresh: boolean) =>
  useQuery({
    queryKey: minecraftKeys.logs(tail),
    queryFn: () => api<{ logs: string }>(`/minecraft/logs?tail=${tail}`).then((r) => r.logs),
    refetchInterval: autoRefresh ? 3_000 : false,
  });

export const useSendCommand = () =>
  useMutation({
    mutationFn: (command: string) =>
      api<CommandResult>('/minecraft/commands', { method: 'POST', body: { command } }),
  });

export const useServerProperties = () =>
  useQuery({
    queryKey: minecraftKeys.properties,
    queryFn: () => api<Record<string, string>>('/minecraft/properties'),
  });

export const useUpdateProperties = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (properties: Record<string, string>) =>
      api<{ updated: boolean }>('/minecraft/properties', { method: 'PUT', body: { properties } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: minecraftKeys.properties }),
  });
};
