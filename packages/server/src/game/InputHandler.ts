import type { GameState, InputEvent, InputAction } from '@astroparty/shared';
import { InputAction as InputActionEnum, AMMO_CLIP_SIZE, BULLET_SPEED, SHIP_SIZE } from '@astroparty/shared';
import { z } from 'zod';

const InputEventSchema = z.object({
  playerId: z.string(),
  action: z.nativeEnum(InputActionEnum),
  timestamp: z.number(),
});

export class InputHandler {
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
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
    }
  }

  private handleThrustStart(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    player.isThrustActive = true;
    // Reset turn start time when switching from rotation to thrust
    player.turnStartTime = Date.now();
  }

  private handleThrustStop(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    player.isThrustActive = false;
    // Reset turn start time when switching from thrust to rotation
    player.turnStartTime = Date.now();
  }

  private handleFire(playerId: string): void {
    const player = this.gameState.players.get(playerId);
    if (!player) return;

    // Check if player has ammo
    if (player.ammo <= 0) {
      return;
    }

    // Consume ammo
    player.ammo--;
    
    // If this was the last bullet, start reload timer
    if (player.ammo < AMMO_CLIP_SIZE) {
      player.lastReloadTime = Date.now();
    }

    // Create bullet at ship's nose
    const bulletOffset = SHIP_SIZE * 0.6; // Spawn slightly ahead of ship
    const bullet = {
      id: `${playerId}-${Date.now()}-${Math.random()}`,
      playerId,
      position: {
        x: player.position.x + Math.cos(player.rotation) * bulletOffset,
        y: player.position.y + Math.sin(player.rotation) * bulletOffset,
      },
      velocity: {
        x: player.velocity.x + Math.cos(player.rotation) * BULLET_SPEED,
        y: player.velocity.y + Math.sin(player.rotation) * BULLET_SPEED,
      },
      spawnTime: Date.now(),
    };

    this.gameState.bullets.push(bullet);
  }
}
