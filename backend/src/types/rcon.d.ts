declare module "rcon" {
  import { EventEmitter } from "node:events";

  interface RconClientOptions {
    tcp?: boolean;
    challenge?: boolean;
    id?: number;
  }

  class Rcon extends EventEmitter {
    constructor(host: string, port: number, password: string, options?: RconClientOptions);
    send(data: string, cmd?: number, id?: number): void;
    connect(): void;
    disconnect(): void;
    setTimeout(timeout: number, callback?: () => void): void;
  }

  export default Rcon;
}
