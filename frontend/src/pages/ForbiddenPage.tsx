import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

const ForbiddenPage = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
    <ShieldAlert className="size-10 text-muted-foreground" />
    <h1 className="text-lg font-medium">You don't have access to this page</h1>
    <p className="max-w-sm text-sm text-muted-foreground">Only the super admin can open it.</p>
    <Button asChild variant="outline">
      <Link to="/">Back to the dashboard</Link>
    </Button>
  </div>
);

export default ForbiddenPage;
