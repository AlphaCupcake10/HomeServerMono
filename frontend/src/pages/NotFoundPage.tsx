import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
    <p className="text-5xl font-semibold text-muted-foreground">404</p>
    <h1 className="text-lg font-medium">Page not found</h1>
    <p className="max-w-sm text-sm text-muted-foreground">
      This page doesn't exist, or the feature it belongs to is turned off.
    </p>
    <Button asChild variant="outline">
      <Link to="/">Back to the dashboard</Link>
    </Button>
  </div>
);

export default NotFoundPage;
