import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Centered spinner for lazy pages and auth/config checks. */
export const PageLoader = ({ fullScreen = false }: { fullScreen?: boolean }) => (
  <div
    className={cn(
      'flex items-center justify-center text-muted-foreground',
      fullScreen ? 'min-h-svh' : 'min-h-[40vh]',
    )}
    role="status"
    aria-label="Loading"
  >
    <Loader2 className="size-6 animate-spin" />
  </div>
);
