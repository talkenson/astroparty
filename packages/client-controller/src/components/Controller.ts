import { InputAction } from '@astroparty/shared';
import { SocketClient } from '../network/SocketClient';

export class Controller {
  private playerId: string = '';
  private socketClient: SocketClient;

  constructor() {
    const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
    this.socketClient = new SocketClient(serverUrl);
  }

  start(playerId: string): void {
    this.playerId = playerId;
    this.setupControls();
    this.listenForGameState();
  }

  private setupControls(): void {
    const thrustButton = document.getElementById('thrust-button')!;
    const fireButton = document.getElementById('fire-button')!;

    // Thrust button - press to thrust, release to rotate
    const handleThrustStart = (e: Event) => {
      e.preventDefault();
      thrustButton.classList.add('active');
      this.sendInput(InputAction.THRUST_START);
      this.vibrate(10);
    };

    const handleThrustStop = (e: Event) => {
      e.preventDefault();
      thrustButton.classList.remove('active');
      this.sendInput(InputAction.THRUST_STOP);
    };

    // Mouse events
    thrustButton.addEventListener('mousedown', handleThrustStart);
    thrustButton.addEventListener('mouseup', handleThrustStop);
    thrustButton.addEventListener('mouseleave', handleThrustStop);

    // Touch events
    thrustButton.addEventListener('touchstart', handleThrustStart);
    thrustButton.addEventListener('touchend', handleThrustStop);
    thrustButton.addEventListener('touchcancel', handleThrustStop);

    // Fire button - tap to fire
    const handleFire = (e: Event) => {
      e.preventDefault();
      this.sendInput(InputAction.FIRE);
      this.vibrate(20);
    };

    fireButton.addEventListener('mousedown', handleFire);
    fireButton.addEventListener('touchstart', handleFire);
  }

  private sendInput(action: InputAction): void {
    this.socketClient.sendInput({
      playerId: this.playerId,
      action,
      timestamp: Date.now(),
    });
  }

  private listenForGameState(): void {
    this.socketClient.on('gameState', (state) => {
      const player = state.players.find(p => p.id === this.playerId);
      if (player) {
        this.updateAmmoDisplay(player.ammo);
      }
    });
  }

  private updateAmmoDisplay(ammo: number): void {
    const ammoDots = document.querySelectorAll('.ammo-dot');
    
    ammoDots.forEach((dot, index) => {
      dot.classList.remove('loaded', 'reloading');
      
      if (index < ammo) {
        dot.classList.add('loaded');
      } else {
        // Show reloading state for next bullet
        if (index === ammo) {
          dot.classList.add('reloading');
        }
      }
    });
  }

  private vibrate(duration: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
}
