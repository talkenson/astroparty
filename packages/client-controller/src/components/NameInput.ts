import { SocketClient } from '../network/SocketClient';

export class NameInput {
  private onJoinCallback?: (playerName: string, playerId: string) => void;
  private socketClient: SocketClient;

  constructor() {
    const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
    this.socketClient = new SocketClient(serverUrl);

    this.setupEventListeners();
    this.setupConnectionStatus();
  }

  private setupEventListeners(): void {
    const input = document.getElementById('player-name-input') as HTMLInputElement;
    const button = document.getElementById('join-button') as HTMLButtonElement;

    const joinGame = () => {
      const playerName = input.value.trim();
      if (playerName.length === 0) {
        alert('Please enter a name');
        return;
      }

      button.disabled = true;
      button.textContent = 'Joining...';

      this.socketClient.joinGame(playerName, (playerId) => {
        if (this.onJoinCallback) {
          this.onJoinCallback(playerName, playerId);
        }
      });
    };

    button.addEventListener('click', joinGame);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinGame();
      }
    });

    // Auto-focus input
    input.focus();
  }

  private setupConnectionStatus(): void {
    const statusDot = document.querySelector('.status-dot') as HTMLElement;
    const statusText = document.querySelector('#connection-status span') as HTMLElement;

    this.socketClient.on('connect', () => {
      statusDot.classList.remove('disconnected');
      statusText.textContent = 'Connected';
    });

    this.socketClient.on('disconnect', () => {
      statusDot.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
    });
  }

  onJoin(callback: (playerName: string, playerId: string) => void): void {
    this.onJoinCallback = callback;
  }

  getSocketClient(): SocketClient {
    return this.socketClient;
  }
}
