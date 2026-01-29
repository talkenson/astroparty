import type { GameState, Player, Bullet } from '@astroparty/shared';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  ACCELERATION,
  MAX_SPEED,
  FRICTION,
  TURN_SPEED,
  TURN_SPEED_MAX,
  TURN_ACCELERATION_TIME,
  SHIP_MAX_RADIUS,
  COLLISION_DISTANCE,
  RESTITUTION,
  BULLET_LIFETIME,
  BULLET_RADIUS,
} from '@astroparty/shared';

export class PhysicsEngine {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(): void {
    this.updateShips();
    this.updateBullets();
    this.checkCollisions();
    this.removeDeadBullets();
  }

  private updateShips(): void {
    for (const player of this.gameState.players.values()) {
      if (!player.isAlive) continue;

      if (player.isThrustActive) {
        // Apply acceleration in current direction
        player.velocity.x += Math.cos(player.rotation) * ACCELERATION;
        player.velocity.y += Math.sin(player.rotation) * ACCELERATION;

        // Clamp to max speed
        const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
        if (speed > MAX_SPEED) {
          player.velocity.x = (player.velocity.x / speed) * MAX_SPEED;
          player.velocity.y = (player.velocity.y / speed) * MAX_SPEED;
        }
      } else {
        // Rotate when not thrusting
        const timeSinceTurnStart = Date.now() - player.turnStartTime;
        const turnProgress = Math.min(timeSinceTurnStart / TURN_ACCELERATION_TIME, 1);
        const currentTurnSpeed = TURN_SPEED + (TURN_SPEED_MAX - TURN_SPEED) * turnProgress;
        
        player.rotation += currentTurnSpeed;
        
        // Normalize rotation to [0, 2π]
        if (player.rotation > Math.PI * 2) {
          player.rotation -= Math.PI * 2;
        }
      }

      // Apply friction
      player.velocity.x *= FRICTION;
      player.velocity.y *= FRICTION;

      // Update position
      player.position.x += player.velocity.x;
      player.position.y += player.velocity.y;

      // Screen wrapping
      if (player.position.x < 0) player.position.x += GAME_WIDTH;
      if (player.position.x > GAME_WIDTH) player.position.x -= GAME_WIDTH;
      if (player.position.y < 0) player.position.y += GAME_HEIGHT;
      if (player.position.y > GAME_HEIGHT) player.position.y -= GAME_HEIGHT;
    }
  }

  private updateBullets(): void {
    for (const bullet of this.gameState.bullets) {
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
    }
  }

  private checkCollisions(): void {
    // Bullet-Ship collisions
    for (let i = this.gameState.bullets.length - 1; i >= 0; i--) {
      const bullet = this.gameState.bullets[i];
      
      for (const player of this.gameState.players.values()) {
        // Skip if bullet is from this player or player is dead
        if (bullet.playerId === player.id || !player.isAlive) continue;

        const dx = bullet.position.x - player.position.x;
        const dy = bullet.position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < SHIP_MAX_RADIUS + BULLET_RADIUS) {
          // Hit!
          player.isAlive = false;
          
          // Award point to shooter
          const shooter = this.gameState.players.get(bullet.playerId);
          if (shooter) {
            shooter.score++;
          }

          // Remove bullet
          this.gameState.bullets.splice(i, 1);
          
          // Respawn killed player after delay
          setTimeout(() => {
            if (this.gameState.players.has(player.id)) {
              player.isAlive = true;
              player.position = this.getRandomSpawnPosition();
              player.velocity = { x: 0, y: 0 };
              player.rotation = Math.random() * Math.PI * 2;
            }
          }, 2000);
          
          break;
        }
      }
    }

    // Ship-Ship collisions (elastic collisions)
    const players = Array.from(this.gameState.players.values());
    for (let i = 0; i < players.length; i++) {
      const p1 = players[i];
      if (!p1.isAlive) continue;

      for (let j = i + 1; j < players.length; j++) {
        const p2 = players[j];
        if (!p2.isAlive) continue;

        const dx = p2.position.x - p1.position.x;
        const dy = p2.position.y - p1.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < COLLISION_DISTANCE) {
          // Elastic collision
          this.resolveElasticCollision(p1, p2, dx, dy, distance);
        }
      }
    }
  }

  private resolveElasticCollision(p1: Player, p2: Player, dx: number, dy: number, distance: number): void {
    // Normalize collision vector
    const nx = dx / distance;
    const ny = dy / distance;

    // Relative velocity
    const dvx = p2.velocity.x - p1.velocity.x;
    const dvy = p2.velocity.y - p1.velocity.y;

    // Relative velocity in collision normal direction
    const dvn = dvx * nx + dvy * ny;

    // Do not resolve if velocities are separating
    if (dvn > 0) return;

    // Calculate impulse scalar
    const impulse = (-(1 + RESTITUTION) * dvn) / 2; // Equal mass assumption

    // Apply impulse
    p1.velocity.x -= impulse * nx;
    p1.velocity.y -= impulse * ny;
    p2.velocity.x += impulse * nx;
    p2.velocity.y += impulse * ny;

    // Separate overlapping ships
    const overlap = COLLISION_DISTANCE - distance;
    const separationX = (overlap / 2) * nx;
    const separationY = (overlap / 2) * ny;
    
    p1.position.x -= separationX;
    p1.position.y -= separationY;
    p2.position.x += separationX;
    p2.position.y += separationY;
  }

  private removeDeadBullets(): void {
    const now = Date.now();
    
    // Remove bullets that are off-screen or too old
    this.gameState.bullets = this.gameState.bullets.filter(bullet => {
      // Check age
      if (now - bullet.spawnTime > BULLET_LIFETIME) {
        return false;
      }

      // Check if off-screen
      if (
        bullet.position.x < 0 ||
        bullet.position.x > GAME_WIDTH ||
        bullet.position.y < 0 ||
        bullet.position.y > GAME_HEIGHT
      ) {
        return false;
      }

      return true;
    });
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    return {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
    };
  }
}
