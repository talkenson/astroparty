import { InputAction } from '@astroparty/shared';
import { SocketClient } from '../network/SocketClient';

export class Controller {
  private playerId: string = '';
  private socketClient!: SocketClient;

  // Controller should receive the socket client, not create a new one
  start(playerId: string, socketClient: SocketClient): void {
    this.playerId = playerId;
    this.socketClient = socketClient;
    this.setupControls();
    this.setupPhaseButtons();
    this.listenForGameState();
  }

  private setupPhaseButtons(): void {
    const startButton = document.getElementById('start-game-button')!;
    const playAgainButton = document.getElementById('play-again-button')!;

    startButton.addEventListener('click', () => {
      this.socketClient.emit('startGame');
      this.vibrate(30);
    });

    playAgainButton.addEventListener('click', () => {
      this.socketClient.emit('playAgain');
      this.vibrate(30);
    });
  }

  private setupControls(): void {
    const thrustButton = document.getElementById('thrust-button')!;
    const fireButton = document.getElementById('fire-button')!;
    const mineButton = document.getElementById('mine-button');
    const dashButton = document.getElementById('dash-button');

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
    
    // Mine button - tap to place mine
    if (mineButton) {
      const handleMine = (e: Event) => {
        e.preventDefault();
        this.sendInput(InputAction.PLACE_MINE);
        this.vibrate(15);
      };
      mineButton.addEventListener('mousedown', handleMine);
      mineButton.addEventListener('touchstart', handleMine);
    }
    
    // Dash button - tap to dash
    if (dashButton) {
      const handleDash = (e: Event) => {
        e.preventDefault();
        this.sendInput(InputAction.DASH);
        this.vibrate(25);
      };
      dashButton.addEventListener('mousedown', handleDash);
      dashButton.addEventListener('touchstart', handleDash);
    }
  }

  private sendInput(action: InputAction): void {
    this.socketClient.sendInput({
      playerId: this.playerId,
      action,
      timestamp: Date.now(),
    });
  }

  private listenForGameState(): void {
    // Listen for optimized player updates
    this.socketClient.on('playerState', (state) => {
      // Direct update from specific state
      this.updateAmmoDisplay(state.ammo);
      this.updatePlayerColor(state.color);
      this.updatePowerUpIndicators(state);
      
      this.updateGamePhase(state.phase, state.hostPlayerId);
    });
  }

  private updateGamePhase(phase: string, hostPlayerId: string | null): void {
    const controls = document.getElementById('controls')!;
    const startButton = document.getElementById('start-game-button')!;
    const playAgainButton = document.getElementById('play-again-button')!;

    // Removed verbose logging
    // console.log(`[Controller] Phase: ${phase}, Host: ${hostPlayerId}, Me: ${this.playerId}`);

    if (phase === 'WAITING') {
      // Show start button only to host
      if (hostPlayerId === this.playerId) {
        controls.style.display = 'none';
        startButton.style.display = 'flex';
        playAgainButton.style.display = 'none';
      } else {
        controls.style.display = 'none';
        startButton.style.display = 'none';
        playAgainButton.style.display = 'none';
        // console.log('[Controller] Waiting for host to start...');
      }
    } else if (phase === 'PLAYING') {
      // Show game controls
      controls.style.display = 'flex';
      startButton.style.display = 'none';
      playAgainButton.style.display = 'none';
    } else if (phase === 'ENDED') {
      // Show play again button
      controls.style.display = 'none';
      startButton.style.display = 'none';
      playAgainButton.style.display = 'flex';
    }
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

  private updatePlayerColor(color: string): void {
    // Update player color indicator
    const colorIndicator = document.getElementById('player-color');
    if (colorIndicator) {
      colorIndicator.style.backgroundColor = color;
    }

    // Subtle background gradient with player color
    document.body.style.background = `linear-gradient(135deg, 
      rgba(10, 10, 21, 1) 0%, 
      ${color}22 100%
    )`;
  }
  
  private updatePowerUpIndicators(player: any): void {
    // Update shield indicator
    const shieldDisplay = document.getElementById('shield-display');
    if (shieldDisplay) {
      if (player.shieldHits && player.shieldHits > 0) {
        shieldDisplay.style.display = 'block';
        shieldDisplay.textContent = `🛡️ ${player.shieldHits}`;
      } else {
        shieldDisplay.style.display = 'none';
      }
    }
    
    // Update dash charges
    const dashDisplay = document.getElementById('dash-display');
    const dashButton = document.getElementById('dash-button');
    if (dashDisplay && dashButton) {
      if (player.dashCharges && player.dashCharges > 0) {
        dashDisplay.textContent = `${player.dashCharges}`;
        dashButton.style.display = 'flex';
      } else {
        dashButton.style.display = 'none';
      }
    }
    
    // Update mine availability
    const mineDisplay = document.getElementById('mine-display');
    const mineButton = document.getElementById('mine-button');
    if (mineDisplay && mineButton) {
      if (player.minesAvailable && player.minesAvailable > 0) {
        mineDisplay.textContent = `${player.minesAvailable}`;
        mineButton.style.display = 'flex';
      } else {
        mineButton.style.display = 'none';
      }
    }
  }

  private vibrate(duration: number): void {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
  }
}
