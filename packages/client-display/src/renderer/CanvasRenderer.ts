import type { SerializedGameState, Block } from '@astroparty/shared';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  SHIP_SIZE, 
  BULLET_RADIUS, 
  SHIP_MAX_RADIUS,
  POWERUP_RADIUS,
  POWERUP_CONFIGS,
  MINE_RADIUS,
  MEGA_BULLET_SIZE_MULTIPLIER,
  PowerUpType,
  BLOCK_SIZE,
} from '@astroparty/shared';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: SerializedGameState | null = null;
  private blocks: Block[] = []; // Cached map blocks from mapSync
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

  /**
   * Update cached map blocks (called via mapSync event)
   */
  updateMap(blocks: Block[]): void {
    this.blocks = blocks;
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
    
    // Draw walls (from cached blocks)
    for (const block of this.blocks) {
      this.drawBlock(block);
    }

    // Draw power-ups
    for (const powerUp of this.gameState.powerUps) {
      this.drawPowerUp(powerUp);
    }

    // Draw mines
    for (const mine of this.gameState.mines) {
      this.drawMine(mine);
    }

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
    
    // Draw notification
    this.drawPowerUpNotification();
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

  private drawBlock(block: any): void {
    const x = block.gridX * BLOCK_SIZE;
    const y = block.gridY * BLOCK_SIZE;
    
    // Draw solid block
    this.ctx.fillStyle = '#2a2a3e';
    this.ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
    
    // Draw border
    this.ctx.strokeStyle = '#1a1a2e';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
  }

  private drawShip(player: any): void {
    const hasGhost = player.activePowerUps?.some((e: any) => e.type === PowerUpType.GHOST_MODE);
    const hasShield = player.shieldHits && player.shieldHits > 0;
    
    this.ctx.save();
    this.ctx.translate(player.position.x, player.position.y);
    this.ctx.rotate(player.rotation);

    // Draw shield effect first (behind ship)
    if (hasShield) {
      this.ctx.strokeStyle = '#2ECC71';
      this.ctx.lineWidth = 3;
      this.ctx.globalAlpha = 0.6;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, SHIP_MAX_RADIUS + 5, 0, Math.PI * 2);
      this.ctx.stroke();
      
      // Shield hits indicator
      for (let i = 0; i < player.shieldHits; i++) {
        const angle = (i / player.shieldHits) * Math.PI * 2;
        const x = Math.cos(angle) * (SHIP_MAX_RADIUS + 8);
        const y = Math.sin(angle) * (SHIP_MAX_RADIUS + 8);
        this.ctx.fillStyle = '#2ECC71';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.globalAlpha = 1;
    }

    // Set alpha for ghost mode
    if (hasGhost) {
      this.ctx.globalAlpha = 0.4;
    }

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

    // this.ctx.beginPath();
    // this.ctx.arc(0,0, SHIP_MAX_RADIUS, 0, Math.PI * 2);
    // this.ctx.closePath();
    // this.ctx.stroke();

    this.ctx.globalAlpha = 1;
    this.ctx.restore();

    // Draw player name above ship
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(player.name, player.position.x, player.position.y - SHIP_SIZE);
  }

  private drawBullet(bullet: any): void {
    const radius = bullet.isMega ? BULLET_RADIUS * MEGA_BULLET_SIZE_MULTIPLIER : BULLET_RADIUS;
    const color = bullet.isMega ? '#FF4444' : '#ffff00';
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(bullet.position.x, bullet.position.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Add glow effect for mega bullets
    if (bullet.isMega) {
      this.ctx.strokeStyle = '#FF8888';
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = 0.5;
      this.ctx.beginPath();
      this.ctx.arc(bullet.position.x, bullet.position.y, radius + 2, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
  }

  private drawPowerUp(powerUp: any): void {
    const config = POWERUP_CONFIGS[powerUp.type as PowerUpType];
    
    this.ctx.save();
    this.ctx.translate(powerUp.position.x, powerUp.position.y);
    
    // Draw pulsing circle
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
    this.ctx.strokeStyle = config.color;
    this.ctx.fillStyle = config.color + '40'; // Add alpha
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = pulse;
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, POWERUP_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw icon/emoji
    this.ctx.globalAlpha = 1;
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'white';
    this.ctx.fillText(config.icon, 1, 1);
    
    // Draw name below
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = config.color;
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.lineWidth = 3;
    this.ctx.strokeText(config.name, 0, POWERUP_RADIUS + 8);
    this.ctx.fillText(config.name, 0, POWERUP_RADIUS + 8);
    
    this.ctx.restore();
  }
  
  private drawPowerUpNotification(): void {
    if (!this.gameState) return;
    
    const now = Date.now();
    const duration = 2000; // 2 seconds
    
    // Draw each recent pickup
    for (const pickup of this.gameState.recentPickups) {
      const elapsed = now - pickup.timestamp;
      if (elapsed > duration) continue;
      
      const config = POWERUP_CONFIGS[pickup.type];
      
      // Animate: fade in, scale up, fade out
      const progress = elapsed / duration;
      let alpha = 1;
      let scale = 1;
      
      if (progress < 0.15) {
        // Fade in + scale up (faster)
        alpha = progress / 0.15;
        scale = 0.8 + (progress / 0.15) * 0.4; // 0.8 -> 1.2
      } else if (progress > 0.7) {
        // Fade out
        alpha = (1 - progress) / 0.3;
        scale = 1.2 + ((progress - 0.7) / 0.3) * 0.3; // 1.2 -> 1.5
      } else {
        scale = 1.2;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.translate(pickup.position.x, pickup.position.y);
      
      const fontSize = Math.floor(24 * scale);
      this.ctx.font = `bold ${fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      
      // Draw with outline
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
      this.ctx.lineWidth = 4;
      this.ctx.strokeText(config.name, 0, -50);
      
      this.ctx.fillStyle = config.color;
      this.ctx.fillText(config.name, 0, -50);
      
      this.ctx.restore();
    }
  }

  private drawMine(mine: any): void {
    this.ctx.save();
    this.ctx.translate(mine.position.x, mine.position.y);
    
    // Draw mine body
    this.ctx.fillStyle = '#E74C3C';
    this.ctx.strokeStyle = '#C0392B';
    this.ctx.lineWidth = 2;
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, MINE_RADIUS, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw spikes
    this.ctx.strokeStyle = '#E74C3C';
    this.ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(Math.cos(angle) * MINE_RADIUS, Math.sin(angle) * MINE_RADIUS);
      this.ctx.lineTo(Math.cos(angle) * (MINE_RADIUS + 5), Math.sin(angle) * (MINE_RADIUS + 5));
      this.ctx.stroke();
    }
    
    // Blinking light
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      this.ctx.fillStyle = '#FF0000';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.restore();
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
