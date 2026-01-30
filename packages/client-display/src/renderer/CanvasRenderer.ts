import type { SerializedGameState } from '@astroparty/shared';
import { GAME_WIDTH, GAME_HEIGHT, SHIP_SIZE, BULLET_RADIUS, SHIP_MAX_RADIUS } from '@astroparty/shared';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: SerializedGameState | null = null;
  private scale: number = 1;
  private stars: { x: number; y: number; size: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
 
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    // this.ctx.imageSmoothingEnabled = true;
    // this.ctx.imageSmoothingQuality = 'high';
    
    this.setupCanvas();
    window.addEventListener('resize', () => this.setupCanvas());
  }

  private setupCanvas(): void {
    // Calculate scale to fit game into window
    const scaleX = window.innerWidth / GAME_WIDTH;
    const scaleY = window.innerHeight / GAME_HEIGHT;
    this.scale = Math.min(scaleX, scaleY);

    this.canvas.width = GAME_WIDTH;
    this.canvas.height = GAME_HEIGHT;
    this.canvas.style.width = `${GAME_WIDTH * this.scale}px`;
    this.canvas.style.height = `${GAME_HEIGHT * this.scale}px`;
  }

  updateGameState(state: SerializedGameState): void {
    this.gameState = state;
    this.updateUI(state);
  }

  start(): void {
    const render = () => {
      this.render();
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);

    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: ((i % 3) * 1.3) * (0.7 + Math.random() * 0.5),
      });
    }
  }

  private render(): void {
    if (!this.gameState) return;

    // Clear canvas
    this.ctx.fillStyle = '#0a0a15';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw starfield background
    this.drawStarfield();

    // Draw bullets
    for (const bullet of this.gameState.bullets) {
      this.drawBullet(bullet);
    }

    // Draw players
    for (const player of this.gameState.players) {
      if (player.isAlive) {
        this.drawShip(player);
      }
    }
  }

  private drawStarfield(): void {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';

    // text astroparty with large letter intervals
    this.ctx.font = 'bold 200px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.letterSpacing = '12px'; 
    this.ctx.fillText('Astroparty', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70);
    this.ctx.letterSpacing = '1px'; 

    // Draw some static stars for atmosphere
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';

    for (const star of this.stars) {
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawShip(player: { position: { x: number; y: number }; rotation: number; color: string; name: string }): void {
    this.ctx.save();
    this.ctx.translate(player.position.x, player.position.y);
    this.ctx.rotate(player.rotation);

    // Draw ship as triangle
    this.ctx.fillStyle = player.color;
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1;
    
    this.ctx.beginPath();
    this.ctx.moveTo(SHIP_SIZE * 0.6, 0); // Nose
    this.ctx.lineTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.4); // Left wing
    this.ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.4); // Right wing
    this.ctx.closePath();

    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(0,0, SHIP_MAX_RADIUS, 0, Math.PI * 2);
    this.ctx.closePath();
    this.ctx.stroke();

    this.ctx.restore();

    // Draw player name above ship
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(player.name, player.position.x, player.position.y - SHIP_SIZE);
  }

  private drawBullet(bullet: { position: { x: number; y: number } }): void {
    this.ctx.fillStyle = '#ffff00';
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, BULLET_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private updateUI(state: SerializedGameState): void {
    // Show/hide leaderboard based on game phase
    const leaderboardOverlay = document.getElementById('leaderboard-overlay')!;
    
    if (state.phase === 'ENDED') {
      leaderboardOverlay.style.display = 'flex';
      this.updateLeaderboard(state);
    } else {
      leaderboardOverlay.style.display = 'none';
    }

    // Update scoreboard (always visible during PLAYING)
    const scoreboard = document.getElementById('scoreboard')!;
    scoreboard.innerHTML = state.players
      .sort((a, b) => b.score - a.score)
      .map(player => `
        <div class="player-score" style="border-left-color: ${player.color}">
          <span>${player.name}</span>: <span>${player.score}</span>
        </div>
      `)
      .join('');

    // Update timer
    const timer = document.getElementById('timer')!;
    if (state.roundEndTime) {
      const remaining = Math.max(0, state.roundEndTime - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      timer.textContent = '--:--';
    }
  }

  private updateLeaderboard(state: SerializedGameState): void {
    const leaderboardContent = document.getElementById('leaderboard-content')!;
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);

    const medals = ['🥇', '🥈', '🥉'];
    const classes = ['first', 'second', 'third'];

    leaderboardContent.innerHTML = sortedPlayers
      .map((player, index) => {
        const rankClass = index < 3 ? classes[index] : '';
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        
        return `
          <div class="leaderboard-entry ${rankClass}">
            <div class="rank">${medal}</div>
            <div class="player-info">
              <div class="name" style="color: ${player.color}">${player.name}</div>
              <div class="score">${player.score} points</div>
            </div>
          </div>
        `;
      })
      .join('');
  }
}
