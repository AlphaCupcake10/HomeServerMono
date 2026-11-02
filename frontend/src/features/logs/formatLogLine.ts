export type LogTone = 'error' | 'warn' | 'debug' | 'plain';

export interface FormattedLine {
  text: string;
  tone: LogTone;
}

// Pino's numeric levels (the API logs JSON in production).
const PINO_LEVELS: Record<number, { label: string; tone: LogTone }> = {
  10: { label: 'TRACE', tone: 'debug' },
  20: { label: 'DEBUG', tone: 'debug' },
  30: { label: 'INFO', tone: 'plain' },
  40: { label: 'WARN', tone: 'warn' },
  50: { label: 'ERROR', tone: 'error' },
  60: { label: 'FATAL', tone: 'error' },
};

/** Fields shown elsewhere in the line (or noise) and left out of the trailing JSON. */
const OMITTED = new Set(['level', 'time', 'msg', 'pid', 'hostname']);

// MongoDB's structured log severities ("D1".."D5" are debug levels).
const MONGO_SEVERITIES: Record<string, { label: string; tone: LogTone }> = {
  F: { label: 'FATAL', tone: 'error' },
  E: { label: 'ERROR', tone: 'error' },
  W: { label: 'WARN', tone: 'warn' },
  I: { label: 'INFO', tone: 'plain' },
};

/** MongoDB 4.4+ logs: { t: { $date }, s, c (component), msg, attr }. */
const formatMongo = (entry: Record<string, unknown>, prefix: string): FormattedLine | null => {
  const date = (entry.t as { $date?: string } | undefined)?.$date;
  if (typeof entry.s !== 'string' || typeof entry.msg !== 'string' || !date) return null;
  const severity = MONGO_SEVERITIES[entry.s] ?? { label: 'DEBUG', tone: 'debug' as const };
  const time = prefix ? '' : `${clock(date)} `;
  const attr = entry.attr ? ` ${JSON.stringify(entry.attr)}` : '';
  return {
    text: `${prefix}${time}${severity.label.padEnd(5)} ${String(entry.c ?? '').padEnd(8)} ${entry.msg}${attr}`,
    tone: severity.tone,
  };
};

/** Docker's --timestamps prefix: RFC 3339 with nanoseconds, then a space. */
const DOCKER_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?Z /;

const toneFromText = (text: string): LogTone => {
  if (/\b(ERROR|FATAL|SEVERE)\b|\[(error|emerg|crit|alert)\]/i.test(text)) return 'error';
  if (/\bWARN(ING)?\b|\[warn\]/i.test(text)) return 'warn';
  return 'plain';
};

const clock = (value: number | string) =>
  new Date(value).toLocaleTimeString(undefined, { hour12: false });

/**
 * Makes one log line readable: Pino (API) and MongoDB JSON become "HH:MM:SS LEVEL message
 * {extra fields}", other lines are kept as-is. Each line gets a tone for colouring.
 */
export const formatLogLine = (line: string, pretty: boolean): FormattedLine => {
  const match = DOCKER_TIMESTAMP.exec(line);
  const prefix = match ? `${match[1].replace('T', ' ')} ` : '';
  const body = match ? line.slice(match[0].length) : line;

  if (pretty && body.startsWith('{')) {
    try {
      const entry = JSON.parse(body) as Record<string, unknown>;
      const level = typeof entry.level === 'number' ? PINO_LEVELS[entry.level] : undefined;
      if (level && 'msg' in entry) {
        const extra = Object.fromEntries(Object.entries(entry).filter(([k]) => !OMITTED.has(k)));
        const time = !prefix && typeof entry.time === 'number' ? `${clock(entry.time)} ` : '';
        const rest = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : '';
        return {
          text: `${prefix}${time}${level.label.padEnd(5)} ${String(entry.msg)}${rest}`,
          tone: level.tone,
        };
      }
      const mongo = formatMongo(entry, prefix);
      if (mongo) return mongo;
    } catch {
      // Not JSON after all: fall through to the raw line.
    }
  }
  return { text: `${prefix}${body}`, tone: toneFromText(body) };
};
