import { useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import type { User } from '@/api/types';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_PASSWORD = 8;

const CreateUserPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const create = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<{ user: User }>('/auth/register', { method: 'POST', body }),
  });

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mismatch) return;
    create.mutate(
      { email: email.trim(), password },
      {
        onSuccess: ({ user }) => {
          toast.success(`Created ${user.email}`, {
            description: 'Share the password with them; they can sign in right away.',
          });
          setEmail('');
          setPassword('');
          setConfirm('');
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Users" description="Only the super admin can create accounts." />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-4" /> Create a user
          </CardTitle>
          <CardDescription>New accounts get the regular user role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            </div>
            <p className={mismatch ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {mismatch ? "The passwords don't match." : `At least ${MIN_PASSWORD} characters.`}
            </p>
            <ErrorAlert error={create.error} />
            <Button type="submit" disabled={create.isPending || mismatch}>
              {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Create user
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export default CreateUserPage;
