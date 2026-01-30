import type { GameState, PowerUp, Mine, Player } from '@astroparty/shared';
import {
  PowerUpType,
  POWERUP_CONFIGS,
  ActivePowerUpEffect,
} from '@astroparty/shared';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  POWERUP_RADIUS,
  POWERUP_LIFETIME,
  POWERUP_SPAWN_INTERVAL,
  MAX_POWERUPS_ON_MAP,
  MINE_RADIUS,
  MINE_LIFETIME,
  MINE_EXPLOSION_RADIUS,
  SHIP_MAX_RADIUS,
  AMMO_BOOST_SIZE,
  RAPID_FIRE_RELOAD_MULTIPLIER,
  MEGA_BULLET_COUNT,
  TELEPORT_DASH_CHARGES,
  SHIELD_MAX_HITS,
  MINE_TRAP_COUNT,
  AMMO_BOOST_RELOAD_MULTIPLIER,
} from '@astroparty/shared';

export class PowerUpManager {
  private gameState: GameState;
  private lastSpawnTime: number = 0;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  update(): void {
    this.updatePowerUpSpawning();
    this.updatePowerUpLifetime();
    this.checkPowerUpCollisions();
    this.updateActivePowerUps();
    this.updateMines();
    this.checkMineCollisions();
  }

  private updatePowerUpSpawning(): void {
    const now = Date.now();
    
    // Spawn new power-up if conditions are met
    if (
      this.gameState.isRoundActive &&
      this.gameState.powerUps.length < MAX_POWERUPS_ON_MAP &&
      now - this.lastSpawnTime >= POWERUP_SPAWN_INTERVAL
    ) {
      this.spawnPowerUp();
      this.lastSpawnTime = now;
    }
  }

  private spawnPowerUp(): void {
    // Random power-up type
    const types = Object.values(PowerUpType);
    const randomType = types[Math.floor(Math.random() * types.length)];

    const powerUp: PowerUp = {
      id: `powerup-${Date.now()}-${Math.random()}`,
      type: randomType,
      position: this.getRandomPosition(),
      spawnTime: Date.now(),
    };

    this.gameState.powerUps.push(powerUp);
  }

  private updatePowerUpLifetime(): void {
    const now = Date.now();
    
    // Remove expired power-ups
    this.gameState.powerUps = this.gameState.powerUps.filter(
      powerUp => now - powerUp.spawnTime < POWERUP_LIFETIME
    );
  }

  private checkPowerUpCollisions(): void {
    for (let i = this.gameState.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.gameState.powerUps[i];

      for (const player of this.gameState.players.values()) {
        if (!player.isAlive) continue;

        const dx = powerUp.position.x - player.position.x;
        const dy = powerUp.position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < POWERUP_RADIUS + SHIP_MAX_RADIUS) {
          // Collision! Apply power-up effect
          this.applyPowerUpEffect(player, powerUp.type);
          
          // Add pickup notification
          this.gameState.recentPickups.push({
            type: powerUp.type,
            position: { x: powerUp.position.x, y: powerUp.position.y },
            timestamp: Date.now(),
          });
          
          // Remove power-up
          this.gameState.powerUps.splice(i, 1);
          break;
        }
      }
    }
  }

  private applyPowerUpEffect(player: Player, type: PowerUpType): void {
    const config = POWERUP_CONFIGS[type];
    const now = Date.now();

    switch (type) {
      case PowerUpType.AMMO_BOOST:
        // Increase ammo to 8, add effect for faster reload
        player.ammo = AMMO_BOOST_SIZE;
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
          ammoBoostActive: true,
        });
        break;

      case PowerUpType.SPLIT_SHOT:
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
          splitShotActive: true,
        });
        break;

      case PowerUpType.SPEED_BOOST:
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
          speedBoostActive: true,
        });
        break;

      case PowerUpType.MINE_TRAP:
        // Give 3 mines
        player.minesAvailable = (player.minesAvailable || 0) + MINE_TRAP_COUNT;
        break;

      case PowerUpType.SHIELD:
        // Give shield with 3 hits
        player.shieldHits = SHIELD_MAX_HITS;
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
        });
        break;

      case PowerUpType.RAPID_FIRE:
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
          rapidFireActive: true,
        });
        break;

      case PowerUpType.GHOST_MODE:
        player.activePowerUps.push({
          type,
          expiresAt: now + config.duration,
          ghostModeActive: true,
        });
        break;

      case PowerUpType.MEGA_BULLET:
        player.activePowerUps.push({
          type,
          expiresAt: now + 999999999, // Effectively infinite until bullets run out
          megaBulletsRemaining: MEGA_BULLET_COUNT,
        });
        break;

      case PowerUpType.TELEPORT_DASH:
        // Give 3 dash charges
        player.dashCharges = (player.dashCharges || 0) + TELEPORT_DASH_CHARGES;
        break;

      case PowerUpType.REVERSE_CONTROLS:
        // Apply to random enemy
        this.applyReverseControlsToRandomEnemy(player.id, config.duration);
        break;
    }
  }

  private applyReverseControlsToRandomEnemy(excludePlayerId: string, duration: number): void {
    const enemies = Array.from(this.gameState.players.values()).filter(
      p => p.id !== excludePlayerId && p.isAlive
    );

    if (enemies.length === 0) return;

    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    const now = Date.now();

    randomEnemy.activePowerUps.push({
      type: PowerUpType.REVERSE_CONTROLS,
      expiresAt: now + duration,
      reverseControlsActive: true,
    });
  }

  private updateActivePowerUps(): void {
    const now = Date.now();

    for (const player of this.gameState.players.values()) {
      // Remove expired power-ups
      player.activePowerUps = player.activePowerUps.filter(effect => {
        // Check expiration
        if (now >= effect.expiresAt) {
          return false;
        }

        // Check mega bullets - remove when depleted
        if (effect.type === PowerUpType.MEGA_BULLET && 
            (effect.megaBulletsRemaining === undefined || effect.megaBulletsRemaining <= 0)) {
          return false;
        }

        // Shield - remove when depleted
        if (effect.type === PowerUpType.SHIELD && !player.shieldHits) {
          return false;
        }

        return true;
      });

      // Clean up shield hits if no shield effect
      if (!player.activePowerUps.some(e => e.type === PowerUpType.SHIELD)) {
        player.shieldHits = undefined;
      }
    }
  }

  spawnMine(playerId: string): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isAlive) return false;
    if (!player.minesAvailable || player.minesAvailable <= 0) return false;

    // Create mine at player's position
    const mine: Mine = {
      id: `mine-${Date.now()}-${Math.random()}`,
      playerId,
      position: { x: player.position.x, y: player.position.y },
      spawnTime: Date.now(),
    };

    this.gameState.mines.push(mine);
    player.minesAvailable--;

    return true;
  }

  private updateMines(): void {
    const now = Date.now();
    
    // Remove expired mines
    this.gameState.mines = this.gameState.mines.filter(
      mine => now - mine.spawnTime < MINE_LIFETIME
    );
  }

  private checkMineCollisions(): void {
    for (let i = this.gameState.mines.length - 1; i >= 0; i--) {
      const mine = this.gameState.mines[i];

      for (const player of this.gameState.players.values()) {
        // Skip mine owner and dead players
        if (player.id === mine.playerId || !player.isAlive) continue;

        const dx = mine.position.x - player.position.x;
        const dy = mine.position.y - player.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < MINE_RADIUS + SHIP_MAX_RADIUS) {
          // Mine explodes!
          this.explodeMine(mine, i);
          break;
        }
      }
    }
  }

  private explodeMine(mine: Mine, mineIndex: number): void {
    // Check all players in explosion radius
    for (const player of this.gameState.players.values()) {
      if (!player.isAlive) continue;

      const dx = mine.position.x - player.position.x;
      const dy = mine.position.y - player.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MINE_EXPLOSION_RADIUS) {
        // Player hit by mine explosion
        if (player.id === mine.playerId) continue; // Don't damage self

        // Check shield
        if (player.shieldHits && player.shieldHits > 0) {
          player.shieldHits--;
        } else {
          player.isAlive = false;

          // Award point to mine owner
          const mineOwner = this.gameState.players.get(mine.playerId);
          if (mineOwner) {
            mineOwner.score++;
          }

          // Respawn after delay
          setTimeout(() => {
            if (this.gameState.players.has(player.id)) {
              player.isAlive = true;
              player.position = this.getRandomPosition();
              player.velocity = { x: 0, y: 0 };
              player.rotation = Math.random() * Math.PI * 2;
            }
          }, 2000);
        }
      }
    }

    // Remove mine
    this.gameState.mines.splice(mineIndex, 1);
  }

  executeDash(playerId: string): boolean {
    const player = this.gameState.players.get(playerId);
    if (!player || !player.isAlive) return false;
    if (!player.dashCharges || player.dashCharges <= 0) return false;

    // Calculate dash direction (current velocity or facing direction)
    let dashDirX: number, dashDirY: number;
    
    const speed = Math.sqrt(player.velocity.x ** 2 + player.velocity.y ** 2);
    if (speed > 0.1) {
      // Dash in velocity direction
      dashDirX = player.velocity.x / speed;
      dashDirY = player.velocity.y / speed;
    } else {
      // Dash in facing direction
      dashDirX = Math.cos(player.rotation);
      dashDirY = Math.sin(player.rotation);
    }

    // Apply dash (teleport 200 pixels)
    const DASH_DISTANCE = 200;
    player.position.x += dashDirX * DASH_DISTANCE;
    player.position.y += dashDirY * DASH_DISTANCE;

    // Wrap around screen
    if (player.position.x < 0) player.position.x += GAME_WIDTH;
    if (player.position.x > GAME_WIDTH) player.position.x -= GAME_WIDTH;
    if (player.position.y < 0) player.position.y += GAME_HEIGHT;
    if (player.position.y > GAME_HEIGHT) player.position.y -= GAME_HEIGHT;

    player.dashCharges--;
    return true;
  }

  getReloadMultiplier(player: Player): number {
    // Check for reload speed boosts
    if (player.activePowerUps.some(e => e.type === PowerUpType.AMMO_BOOST)) {
      return AMMO_BOOST_RELOAD_MULTIPLIER;
    }
    if (player.activePowerUps.some(e => e.type === PowerUpType.RAPID_FIRE)) {
      return RAPID_FIRE_RELOAD_MULTIPLIER;
    }
    return 1.0;
  }

  getMaxAmmo(player: Player): number {
    if (player.activePowerUps.some(e => e.type === PowerUpType.AMMO_BOOST)) {
      return AMMO_BOOST_SIZE;
    }
    return 3; // Default AMMO_CLIP_SIZE
  }

  clearAllPowerUps(): void {
    this.gameState.powerUps = [];
    this.gameState.mines = [];
    this.lastSpawnTime = Date.now(); // Reset spawn timer
  }

  private getRandomPosition(): { x: number; y: number } {
    return {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
    };
  }
}
