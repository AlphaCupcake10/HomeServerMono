import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AdminSettings, AuditEntry, RuntimeSettingsUpdate } from '@/api/types';
import { appConfigKey } from '@/config/useAppConfig';

export const adminKeys = {
  settings: ['admin', 'settings'] as const,
  audit: (limit: number) => ['admin', 'audit', limit] as const,
};

export const useAdminSettings = () =>
  useQuery({
    queryKey: adminKeys.settings,
    queryFn: () => api<AdminSettings>('/admin/settings'),
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: RuntimeSettingsUpdate) =>
      api<AdminSettings>('/admin/settings', { method: 'PUT', body: update }),
    onSuccess: (settings) => {
      queryClient.setQueryData(adminKeys.settings, settings);
      // Feature flags drive the sidebar and route guards: refresh them right away.
      void queryClient.invalidateQueries({ queryKey: appConfigKey });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });
};

export const useAuditLog = (limit = 50) =>
  useQuery({
    queryKey: adminKeys.audit(limit),
    queryFn: () =>
      api<{ entries: AuditEntry[] }>(`/admin/audit?limit=${limit}`).then((r) => r.entries),
    refetchInterval: 30_000,
  });
