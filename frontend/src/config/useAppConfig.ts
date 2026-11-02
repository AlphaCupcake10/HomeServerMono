import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { AppConfig, FeatureKey } from '@/api/types';
import { useAuth } from '@/auth/useAuth';

export const appConfigKey = ['config'] as const;

/** Client-safe runtime config (enabled features). Refetched on focus so toggles show up quickly. */
export const useAppConfig = () => {
  const { status } = useAuth();
  return useQuery({
    queryKey: appConfigKey,
    queryFn: () => api<AppConfig>('/config'),
    enabled: status === 'authenticated',
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
};

export const isFeatureEnabled = (config: AppConfig | undefined, feature: FeatureKey): boolean =>
  config?.features[feature]?.enabled === true;
