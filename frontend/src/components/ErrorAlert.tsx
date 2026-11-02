import { CircleAlert } from 'lucide-react';
import { ApiError } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Joi validation details: [{ message, path, ... }]. */
const validationMessages = (details: unknown): string[] | null =>
  Array.isArray(details) && details.every((d) => typeof d?.message === 'string')
    ? details.map((d: { message: string }) => d.message)
    : null;

/**
 * Shows an API error with whatever detail the backend sent: validation messages as a list,
 * anything else (e.g. the underlying error behind a 500) as formatted JSON.
 */
export const ErrorAlert = ({ error, title }: { error: unknown; title?: string }) => {
  if (!error) return null;
  const apiError = error instanceof ApiError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  const messages = validationMessages(apiError?.details);
  const hasDetails = !messages && apiError?.details !== undefined && apiError.details !== null;

  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{title ?? message}</AlertTitle>
      <AlertDescription>
        {title && <p>{message}</p>}
        {messages && messages.length > 1 && (
          <ul className="list-disc pl-4">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {hasDetails && (
          <pre className="mt-1 max-h-48 w-full overflow-auto rounded bg-destructive/5 p-2 font-mono text-xs whitespace-pre-wrap">
            {JSON.stringify(apiError.details, null, 2)}
          </pre>
        )}
        {apiError && apiError.code !== 'API_ERROR' && (
          <p className="text-xs opacity-70">
            {apiError.code}
            {apiError.status ? ` · HTTP ${apiError.status}` : ''}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
};
