import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Server } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/useAuth';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNext } from '@/navigation';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Outside the app layout, so the top bar doesn't set the tab title here.
  useEffect(() => {
    document.title = 'Sign in · Home Server';
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setError(err);
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Server className="mx-auto mb-1 size-8 text-primary" />
          <CardTitle className="text-xl">Home Server</CardTitle>
          <CardDescription>Sign in to manage your server</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <ErrorAlert error={error} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
