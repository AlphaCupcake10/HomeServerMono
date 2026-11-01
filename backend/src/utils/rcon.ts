import Rcon from "rcon";

interface RconClientConfig {
  host: string;
  port: number;
  password: string;
}

export const sendRconCommand = async (config: RconClientConfig, command: string): Promise<string> => {
  const client = new Rcon(config.host, config.port, config.password, { tcp: true, challenge: false });
  return new Promise<string>((resolve, reject) => {
    client.once("auth", () => {
      client.send(command, 2);
    });
    client.once("response", (response: string) => {
      client.disconnect();
      resolve(response);
    });
    client.once("error", (error: Error) => {
      client.disconnect();
      reject(error);
    });
    client.connect();
  });
};
