import type { Server as SocketIOServer } from 'socket.io';
import type {
  Player,
  Bullet,
  GameState,
  SerializedGameState,
  ClientToServerEvents,
  ServerToClientEvents,
  InputEvent,
} from '@astroparty/shared';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_FPS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  AMMO_CLIP_SIZE,
} from '@astroparty/shared';
import { PhysicsEngine } from './PhysicsEngine.js';
import { InputHandler } from './InputHandler.js';

export class GameManager {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private gameState: GameState;
  private physicsEngine: PhysicsEngine;
  private inputHandler: InputHandler;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private roundDuration: number;
  private playerNames: Map<string, string> = new Map();

  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>, roundDuration: number) {
    this.io = io;
    this.roundDuration = roundDuration;
    
    this.gameState = {
      players: new Map(),
      bullets: [],
      roundEndTime: null,
      isRoundActive: false,
    };

    this.physicsEngine = new PhysicsEngine(this.gameState);
    this.inputHandler = new InputHandler(this.gameState);
  }

  start(): void {
    // Start game loop at 60 FPS
    const tickInterval = 1000 / GAME_FPS;
    this.gameLoopInterval = setInterval(() => {
      this.update();
    }, tickInterval);
  }

  stop(): void {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
  }

  addPlayer(playerId: string, playerName: string): void {
    if (this.gameState.players.size >= MAX_PLAYERS) {
      console.warn(`Cannot add player ${playerId}: max players reached`);
      return;
    }

    const colorIndex = this.gameState.players.size % PLAYER_COLORS.length;
    const spawnPosition = this.getRandomSpawnPosition();

    const player: Player = {
      id: playerId,
      name: playerName,
      position: spawnPosition,
      velocity: { x: 0, y: 0 },
      rotation: Math.random() * Math.PI * 2, // Random initial direction
      color: PLAYER_COLORS[colorIndex],
      score: 0,
      ammo: AMMO_CLIP_SIZE,
      isAlive: true,
      isThrustActive: false,
      turnStartTime: Date.now(),
      lastReloadTime: Date.now(),
    };

    this.gameState.players.set(playerId, player);
    this.playerNames.set(playerId, playerName);

    // Notify all clients
    this.io.emit('playerJoined', playerId, playerName);

    // Start round if not active and we have at least 1 player
    if (!this.gameState.isRoundActive && this.gameState.players.size >= 1) {
      this.startRound();
    }
  }

  removePlayer(playerId: string): void {
    this.gameState.players.delete(playerId);
    this.playerNames.delete(playerId);
    
    // Remove bullets from this player
    this.gameState.bullets = this.gameState.bullets.filter(b => b.playerId !== playerId);

    this.io.emit('playerLeft', playerId);

    // End round if no players left
    if (this.gameState.players.size === 0 && this.gameState.isRoundActive) {
      this.endRound();
    }
  }

  handleInput(event: InputEvent): void {
    this.inputHandler.handleInput(event);
  }

  private update(): void {
    // Update physics
    this.physicsEngine.update();

    // Handle ammo reload
    this.updateAmmo();

    // Broadcast game state to all clients
    this.broadcastGameState();

    // Check if round should end
    if (this.gameState.isRoundActive && this.gameState.roundEndTime) {
      if (Date.now() >= this.gameState.roundEndTime) {
        this.endRound();
      }
    }
  }

  private updateAmmo(): void {
    const now = Date.now();
    for (const player of this.gameState.players.values()) {
      if (player.ammo < AMMO_CLIP_SIZE) {
        // Check if we can reload another charge
        const timeSinceLastReload = now - player.lastReloadTime;
        const reloadTime = 2000; // AMMO_RELOAD_TIME from constants
        
        if (timeSinceLastReload >= reloadTime) {
          player.ammo = Math.min(player.ammo + 1, AMMO_CLIP_SIZE);
          player.lastReloadTime = now;
        }
      }
    }
  }

  private startRound(): void {
    this.gameState.isRoundActive = true;
    this.gameState.roundEndTime = Date.now() + this.roundDuration;

    // Reset all players
    for (const player of this.gameState.players.values()) {
      player.isAlive = true;
      player.position = this.getRandomSpawnPosition();
      player.velocity = { x: 0, y: 0 };
      player.rotation = Math.random() * Math.PI * 2;
      player.ammo = AMMO_CLIP_SIZE;
      player.isThrustActive = false;
    }

    this.gameState.bullets = [];

    this.io.emit('roundStart', this.gameState.roundEndTime);
  }

  private endRound(): void {
    this.gameState.isRoundActive = false;
    this.gameState.roundEndTime = null;

    // Find winner (highest score)
    let winner: { id: string; name: string; score: number } | null = null;
    for (const player of this.gameState.players.values()) {
      if (!winner || player.score > winner.score) {
        winner = {
          id: player.id,
          name: player.name,
          score: player.score,
        };
      }
    }

    this.io.emit('roundEnd', winner);

    // Start new round after delay if we still have players
    setTimeout(() => {
      if (this.gameState.players.size > 0) {
        this.startRound();
      }
    }, 10000); // ROUND_END_DELAY
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    return {
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
    };
  }

  private broadcastGameState(): void {
    const serialized: SerializedGameState = {
      players: Array.from(this.gameState.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        velocity: p.velocity,
        rotation: p.rotation,
        color: p.color,
        score: p.score,
        ammo: p.ammo,
        isAlive: p.isAlive,
      })),
      bullets: this.gameState.bullets,
      roundEndTime: this.gameState.roundEndTime,
      isRoundActive: this.gameState.isRoundActive,
    };

    this.io.emit('gameState', serialized);
  }
}
