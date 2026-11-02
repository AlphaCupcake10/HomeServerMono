const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/** "5 minutes ago", "in 2 hours". */
export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? ['second', 1];
  return relative.format(Math.round(seconds / size), unit);
};

export const formatDateTime = (value: string | Date | null | undefined): string =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
