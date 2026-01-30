import type { GameState, InputEvent, InputAction } from '@astroparty/shared';
import { 
  InputAction as InputActionEnum, 
  AMMO_CLIP_SIZE, 
  BULLET_SPEED, 
  SHIP_SIZE,
  PowerUpType,
  SPLIT_SHOT_ANGLE,
  SPLIT_SHOT_COUNT,
  MEGA_BULLET_SPEED_MULTIPLIER,
} from '@astroparty/shared';
import { z } from 'zod';
import type { GameManager } from './GameManager.js';

const InputEventSchema = z.object({
  playerId: z.string(),
  action: z.nativeEnum(InputActionEnum),
  timestamp: z.number(),
});

export class InputHandler {
  private gameState: GameState;
  private gameManager: GameManager;

  constructor(gameState: GameState, gameManager: GameManager) {
    this.gameState = gameState;
    this.gameManager = gameManager;
  }

  handleInput(event: InputEvent): void {
    // Validate input
    const result = InputEventSchema.safeParse(event);
    if (!result.success) {
      console.warn('Invalid input event:', result.error);
      return;
    }

    const player = this.gameState.players.get(event.playerId);
    if (!player || !player.isAlive) {
      return;
    }

    switch (event.action) {
      case InputActionEnum.THRUST_START:
        this.handleThrustStart(event.playerId);
        break;
      case InputActionEnum.THRUST_STOP:
        this.handleThrustStop(event.playerId);
        break;
      case InputActionEnum.FIRE:
        this.handleFire(event.playerId);
        break;
      case InputActionEnum.PLACE_MINE:
        this.handlePlaceMine(event.playerId);
        break;
      case InputActionEnum.DASH:
        this.handleDash(event.playerId);
        break;
    }
  }

  private handleThrustStart(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Check for reverse controls
    const hasReverseControls = player.activePowerUps.some(
      e => e.type === PowerUpType.REVERSE_CONTROLS
    );

    if (hasReverseControls) {
      // Reverse: thrust command becomes stop
      player.isThrustActive = false;
      player.turnStartTime = Date.now();
    } else {
      player.isThrustActive = true;
      player.turnStartTime = Date.now();
    }
  }

  private handleThrustStop(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Check for reverse controls
    const hasReverseControls = player.activePowerUps.some(
      e => e.type === PowerUpType.REVERSE_CONTROLS
    );

    if (hasReverseControls) {
      // Reverse: stop command becomes thrust
      player.isThrustActive = true;
      player.turnStartTime = Date.now();
    } else {
      player.isThrustActive = false;
      player.turnStartTime = Date.now();
    }
  }

  private handleFire(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Check if player has ammo
    if (player.ammo <= 0) {
      return;
    }

    // Check for split shot
    const hasSplitShot = player.activePowerUps.some(
      e => e.type === PowerUpType.SPLIT_SHOT
    );

    // Check for mega bullet
    const megaBulletEffect = player.activePowerUps.find(
      e => e.type === PowerUpType.MEGA_BULLET
    );
    const isMegaBullet = megaBulletEffect && 
                         megaBulletEffect.megaBulletsRemaining && 
                         megaBulletEffect.megaBulletsRemaining > 0;

    // Consume ammo (only 1 even with split shot)
    player.ammo--;
    
    // If this was the last bullet, start reload timer
    if (player.ammo < AMMO_CLIP_SIZE) {
      player.lastReloadTime = Date.now();
    }

    // Decrement mega bullets if active
    if (isMegaBullet && megaBulletEffect.megaBulletsRemaining) {
      megaBulletEffect.megaBulletsRemaining--;
    }

    if (hasSplitShot) {
      // Fire 3 bullets at different angles
      const angleStep = (SPLIT_SHOT_ANGLE * Math.PI) / 180; // Convert to radians
      const angles = [
        player.rotation - angleStep,  // Left
        player.rotation,               // Center
        player.rotation + angleStep,  // Right
      ];

      for (const angle of angles) {
        this.createBullet(playerId, player, angle, !!isMegaBullet);
      }
    } else {
      // Single bullet
      this.createBullet(playerId, player, player.rotation, !!isMegaBullet);
    }
  }

  private createBullet(
    playerId: string, 
    player: any, 
    angle: number, 
    isMega: boolean
  ): void {
    const bulletOffset = SHIP_SIZE * 0.6;
    const speed = isMega ? BULLET_SPEED * MEGA_BULLET_SPEED_MULTIPLIER : BULLET_SPEED;
    
    const bullet = {
      id: `${playerId}-${Date.now()}-${Math.random()}`,
      playerId,
      position: {
        x: player.position.x + Math.cos(angle) * bulletOffset,
        y: player.position.y + Math.sin(angle) * bulletOffset,
      },
      velocity: {
        x: player.velocity.x + Math.cos(angle) * speed,
        y: player.velocity.y + Math.sin(angle) * speed,
      },
      spawnTime: Date.now(),
      isMega,
    };

    this.gameState.bullets.push(bullet);
  }

  private handlePlaceMine(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Attempt to place mine via PowerUpManager
    this.gameManager.getPowerUpManager().spawnMine(playerId);
  }

  private handleDash(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Attempt to execute dash via PowerUpManager
    this.gameManager.getPowerUpManager().executeDash(playerId);
  }
}
