import Rcon from "rcon";

interface RconClientConfig {
  host: string;
  port: number;
  password: string;
}

const RCON_TIMEOUT_MS = 5000;

export const sendRconCommand = async (
  config: RconClientConfig,
  command: string,
  timeoutMs = RCON_TIMEOUT_MS,
): Promise<string> => {
  const client = new Rcon(config.host, config.port, config.password, {
    tcp: true,
    challenge: false,
  });
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        client.disconnect();
      } catch {
        // already closed
      }
      fn();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error(`RCON timed out after ${timeoutMs}ms`))),
      timeoutMs,
    );

    client.once("auth", () => {
      client.send(command, 2);
    });
    client.once("response", (response: string) => finish(() => resolve(response)));
    client.once("error", (error: Error) => finish(() => reject(error)));
    client.once("end", () =>
      finish(() => reject(new Error("RCON connection closed unexpectedly"))),
    );
    client.connect();
  });
};
