import type { GameState, Player, Bullet, Block } from '@astroparty/shared';
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
  PowerUpType,
  SPEED_BOOST_MULTIPLIER,
  SPEED_BOOST_ACCELERATION_MULTIPLIER,
  BLOCK_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
} from '@astroparty/shared';

export class PhysicsEngine {
  private gameState: GameState;
  private spatialGrid: Map<string, Block[]>; // Spatial hash for fast collision detection

  constructor(gameState: GameState, private onPlayerDirty?: (playerId: string) => void) {
    this.gameState = gameState;
    this.spatialGrid = new Map();
    this.rebuildSpatialGrid();
  }
  
  /**
   * Rebuild spatial grid when map changes
   * Called by GameManager when loading new map
   */
  rebuildSpatialGrid(): void {
    this.spatialGrid.clear();
    
    for (const block of this.gameState.blocks) {
      const key = `${block.gridX},${block.gridY}`;
      if (!this.spatialGrid.has(key)) {
        this.spatialGrid.set(key, []);
      }
      this.spatialGrid.get(key)!.push(block);
    }
  }

  update(): void {
    this.updateShips();
    this.updateBullets();
    this.checkCollisions();
    this.removeDeadBullets();
  }

  /**
   * Public method to check if a position would be inside a wall
   * Used by GameManager for spawn position validation
   */
  isPositionInsideWall(x: number, y: number, radius: number): boolean {
    return this.collidesWithWalls(x, y, radius);
  }

  private updateShips(): void {
    for (const player of this.gameState.players.values()) {
      if (!player.isAlive) continue;

      if (player.isThrustActive) {
        // Check for speed boost
        const hasSpeedBoost = player.activePowerUps.some(
          e => e.type === PowerUpType.SPEED_BOOST
        );
        
        const acceleration = hasSpeedBoost 
          ? ACCELERATION * SPEED_BOOST_ACCELERATION_MULTIPLIER 
          : ACCELERATION;
        const maxSpeed = hasSpeedBoost 
          ? MAX_SPEED * SPEED_BOOST_MULTIPLIER 
          : MAX_SPEED;

        // Apply acceleration in current direction
        player.velocity.x += Math.cos(player.rotation) * acceleration;
        player.velocity.y += Math.sin(player.rotation) * acceleration;

        // Clamp to max speed
        const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
        if (speed > maxSpeed) {
          player.velocity.x = (player.velocity.x / speed) * maxSpeed;
          player.velocity.y = (player.velocity.y / speed) * maxSpeed;
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

      // Calculate new position
      const newX = player.position.x + player.velocity.x;
      const newY = player.position.y + player.velocity.y;
      
      // Check wall collision (Ghost Mode doesn't bypass walls)
      const collisionNormal = this.getWallCollisionNormal(newX, newY, SHIP_MAX_RADIUS);
      if (collisionNormal) {
        // Reflect velocity vector off the wall normal
        // Formula: v' = v - 2(v·n)n
        const dotProduct = player.velocity.x * collisionNormal.x + player.velocity.y * collisionNormal.y;
        player.velocity.x = player.velocity.x - 2 * dotProduct * collisionNormal.x;
        player.velocity.y = player.velocity.y - 2 * dotProduct * collisionNormal.y;
        
        // Apply bounce damping (keep 70% of velocity)
        player.velocity.x *= 0.7;
        player.velocity.y *= 0.7;
        
        // Don't update position - stay at current position
      } else {
        // Update position if no collision
        player.position.x = newX;
        player.position.y = newY;
      }

      // Screen wrapping
      if (player.position.x < 0) player.position.x += GAME_WIDTH;
      if (player.position.x > GAME_WIDTH) player.position.x -= GAME_WIDTH;
      if (player.position.y < 0) player.position.y += GAME_HEIGHT;
      if (player.position.y > GAME_HEIGHT) player.position.y -= GAME_HEIGHT;
    }
  }

  private updateBullets(): void {
    // Update bullet positions and check wall collisions
    this.gameState.bullets = this.gameState.bullets.filter(bullet => {
      bullet.position.x += bullet.velocity.x;
      bullet.position.y += bullet.velocity.y;
      
      // Remove bullet if it hits a wall
      if (this.collidesWithWalls(bullet.position.x, bullet.position.y, BULLET_RADIUS)) {
        return false; // Remove bullet
      }
      
      return true; // Keep bullet
    });
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
          // Check shield
          if (player.shieldHits && player.shieldHits > 0) {
            // Shield absorbs hit
            player.shieldHits--;
            this.onPlayerDirty?.(player.id);
            
            // Remove bullet
            this.gameState.bullets.splice(i, 1);
            break;
          }
          
          // Hit!
          player.isAlive = false;
          this.onPlayerDirty?.(player.id);
          
          // Award point to shooter
          const shooter = this.gameState.players.get(bullet.playerId);
          if (shooter) {
            shooter.score++;
            this.onPlayerDirty?.(shooter.id);
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
              this.onPlayerDirty?.(player.id);
            }
          }, 2_000);
          
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
          // Check for ghost mode on either player
          const p1HasGhost = p1.activePowerUps.some(e => e.type === PowerUpType.GHOST_MODE);
          const p2HasGhost = p2.activePowerUps.some(e => e.type === PowerUpType.GHOST_MODE);
          
          // Skip collision if either player has ghost mode
          if (p1HasGhost || p2HasGhost) {
            continue;
          }
          
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

  // ========================================
  // Wall Collision Helpers
  // ========================================

  /**
   * Check if a circle collides with any wall block
   * Uses spatial grid for O(1) lookup instead of O(n)
   */
  private collidesWithWalls(x: number, y: number, radius: number): boolean {
    // Calculate which grid cells the circle could overlap
    const minGridX = Math.max(0, Math.floor((x - radius) / BLOCK_SIZE));
    const maxGridX = Math.min(GRID_WIDTH - 1, Math.floor((x + radius) / BLOCK_SIZE));
    const minGridY = Math.max(0, Math.floor((y - radius) / BLOCK_SIZE));
    const maxGridY = Math.min(GRID_HEIGHT - 1, Math.floor((y + radius) / BLOCK_SIZE));

    // Check only blocks in the relevant grid cells
    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        const key = `${gridX},${gridY}`;
        const blocks = this.spatialGrid.get(key);
        
        if (blocks) {
          for (const block of blocks) {
            if (this.circleRectCollision(x, y, radius, block)) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Circle-Rectangle collision detection
   */
  private circleRectCollision(cx: number, cy: number, radius: number, block: Block): boolean {
    const rectX = block.gridX * BLOCK_SIZE;
    const rectY = block.gridY * BLOCK_SIZE;
    const rectWidth = BLOCK_SIZE;
    const rectHeight = BLOCK_SIZE;

    // Find the closest point on the rectangle to the circle
    const closestX = Math.max(rectX, Math.min(cx, rectX + rectWidth));
    const closestY = Math.max(rectY, Math.min(cy, rectY + rectHeight));

    // Calculate distance from closest point to circle center
    const distanceX = cx - closestX;
    const distanceY = cy - closestY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;

    return distanceSquared < radius * radius;
  }

  /**
   * Get the collision normal for proper reflection physics
   * Returns null if no collision, or a normalized vector pointing away from the wall
   * Uses spatial grid for optimization
   */
  private getWallCollisionNormal(cx: number, cy: number, radius: number): { x: number; y: number } | null {
    // Calculate which grid cells the circle could overlap
    const minGridX = Math.max(0, Math.floor((cx - radius) / BLOCK_SIZE));
    const maxGridX = Math.min(GRID_WIDTH - 1, Math.floor((cx + radius) / BLOCK_SIZE));
    const minGridY = Math.max(0, Math.floor((cy - radius) / BLOCK_SIZE));
    const maxGridY = Math.min(GRID_HEIGHT - 1, Math.floor((cy + radius) / BLOCK_SIZE));

    // Check only blocks in the relevant grid cells
    for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
      for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
        const key = `${gridX},${gridY}`;
        const blocks = this.spatialGrid.get(key);
        
        if (blocks) {
          for (const block of blocks) {
            if (this.circleRectCollision(cx, cy, radius, block)) {
              // Found collision, calculate normal
              const rectX = block.gridX * BLOCK_SIZE;
              const rectY = block.gridY * BLOCK_SIZE;
              const rectWidth = BLOCK_SIZE;
              const rectHeight = BLOCK_SIZE;

              // Find the closest point on the rectangle to the circle
              const closestX = Math.max(rectX, Math.min(cx, rectX + rectWidth));
              const closestY = Math.max(rectY, Math.min(cy, rectY + rectHeight));

              // Calculate normal direction (from closest point to circle center)
              const normalX = cx - closestX;
              const normalY = cy - closestY;

              // Normalize the vector
              const length = Math.sqrt(normalX * normalX + normalY * normalY);
              if (length > 0) {
                return {
                  x: normalX / length,
                  y: normalY / length,
                };
              }
            }
          }
        }
      }
    }
    
    return null; // No collision
  }
}
