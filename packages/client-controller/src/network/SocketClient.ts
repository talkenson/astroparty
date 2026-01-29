import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, InputEvent } from '@astroparty/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketClient {
  private socket: TypedSocket;

  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    }) as TypedSocket;
  }

  joinGame(playerName: string, callback: (playerId: string) => void): void {
    this.socket.emit('joinGame', playerName, callback);
  }

  sendInput(event: InputEvent): void {
    this.socket.emit('input', event);
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    (this.socket.emit as any)(event, ...args);
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K]
  ): void;
  on(event: string, listener: (...args: any[]) => void): void;
  on(event: any, listener: any): void {
    this.socket.on(event, listener as any);
  }

  disconnect(): void {
    this.socket.disconnect();
  }
}
