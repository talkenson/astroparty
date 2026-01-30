import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@astroparty/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketClient {
  private socket: TypedSocket;

  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      query: { type: 'display' },
    }) as TypedSocket;
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: any, listener: any): void {
    this.socket.on(event, listener as any);
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    this.socket.emit(event, ...args as any);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
