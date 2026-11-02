import type Docker from "dockerode";
import { ApiError, describeError } from "./errors";

/** Translates Docker daemon errors (dockerode sets `statusCode`) into API errors. */
export const toDockerApiError = (
  error: unknown,
  messages: { notFound: string; notModified?: string },
): unknown => {
  const statusCode = (error as { statusCode?: number } | null)?.statusCode;
  if (statusCode === 304) return new ApiError(409, messages.notModified ?? "Nothing to change");
  if (statusCode === 404) return new ApiError(404, messages.notFound, describeError(error));
  if (statusCode !== undefined) {
    return new ApiError(502, "Docker daemon returned an error", describeError(error));
  }
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === "ENOENT" || code === "ECONNREFUSED" || code === "EACCES") {
    return new ApiError(
      502,
      "Cannot reach the Docker daemon (is the socket mounted?)",
      describeError(error),
    );
  }
  return error;
};

/** Docker multiplexes stdout/stderr as frames: 1 byte stream, 3 bytes padding, 4 bytes length. */
export const demuxDockerLogs = (buffer: Buffer): string => {
  let offset = 0;
  let output = "";
  while (offset + 8 <= buffer.length) {
    const payloadLength = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = Math.min(start + payloadLength, buffer.length);
    output += buffer.toString("utf-8", start, end);
    offset = end;
  }
  return output;
};

/** The last `tail` lines of a container's stdout + stderr as text. */
export const readContainerLogs = async (
  container: Docker.Container,
  { tail, timestamps = false }: { tail: number; timestamps?: boolean },
): Promise<string> => {
  const info = await container.inspect();
  const buffer = (await container.logs({
    stdout: true,
    stderr: true,
    follow: false,
    tail,
    timestamps,
  })) as unknown as Buffer;
  // TTY containers return a raw stream instead of multiplexed frames.
  return info.Config?.Tty ? buffer.toString("utf-8") : demuxDockerLogs(buffer);
};
