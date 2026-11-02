import { Pickaxe, type LucideIcon } from 'lucide-react';
import type { FeatureKey } from '@/api/types';

/** Display info for each switchable feature (keys match backend FEATURE_KEYS). */
export const FEATURES: Record<
  FeatureKey,
  { title: string; description: string; icon: LucideIcon }
> = {
  minecraft: {
    title: 'Minecraft server',
    description:
      'Start/stop the server, view logs, run console commands and edit server.properties.',
    icon: Pickaxe,
  },
};

export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];
