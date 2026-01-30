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
  SHIP_MAX_RADIUS,
} from '@astroparty/shared';
import { PhysicsEngine } from './PhysicsEngine.js';
import { InputHandler } from './InputHandler.js';
import { PowerUpManager } from './PowerUpManager.js';
import { MapManager } from './MapManager.js';

export class GameManager {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private gameState: GameState;
  private physicsEngine: PhysicsEngine;
  private inputHandler: InputHandler;
  private powerUpManager: PowerUpManager;
  private mapManager: MapManager;
  private gameLoopInterval: NodeJS.Timeout | null = null;
  private roundDuration: number;
  private playerNames: Map<string, string> = new Map();

  constructor(io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>, roundDuration: number) {
    this.io = io;
    this.roundDuration = roundDuration;
    
    this.gameState = {
      players: new Map(),
      bullets: [],
      powerUps: [],
      mines: [],
      blocks: [], // Will be loaded from map
      recentPickups: [],
      roundEndTime: null,
      isRoundActive: false,
      phase: 'WAITING',
      hostPlayerId: null,
    };

    this.physicsEngine = new PhysicsEngine(this.gameState);
    this.inputHandler = new InputHandler(this.gameState, this);
    this.powerUpManager = new PowerUpManager(this.gameState, this.physicsEngine);
    this.mapManager = new MapManager();
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
      activePowerUps: [],
    };

    this.gameState.players.set(playerId, player);
    this.playerNames.set(playerId, playerName);

    // Set first player as host
    if (this.gameState.hostPlayerId === null) {
      this.gameState.hostPlayerId = playerId;
      console.log(`First player joined. Host set to: ${playerId}`);
    } else {
      console.log(`Player joined. Current host: ${this.gameState.hostPlayerId}, new player: ${playerId}`);
    }

    // Notify all clients
    this.io.emit('playerJoined', playerId, playerName);

    // Don't auto-start anymore - wait for host to click start
  }

  removePlayer(playerId: string): void {
    this.gameState.players.delete(playerId);
    this.playerNames.delete(playerId);
    
    // Remove bullets from this player
    this.gameState.bullets = this.gameState.bullets.filter(b => b.playerId !== playerId);
    
    // Remove mines from this player
    this.gameState.mines = this.gameState.mines.filter(m => m.playerId !== playerId);

    this.io.emit('playerLeft', playerId);

    // End round if no players left
    if (this.gameState.players.size === 0 && this.gameState.isRoundActive) {
      this.endRound();
    }
  }

  handleInput(event: InputEvent): void {
    this.inputHandler.handleInput(event);
  }

  // Manual game start (called by host)
  startGame(playerId: string): void {
    console.log(`startGame called by ${playerId}, host is ${this.gameState.hostPlayerId}, phase is ${this.gameState.phase}`);
    
    if (this.gameState.phase !== 'WAITING') {
      console.warn(`Cannot start game: phase is ${this.gameState.phase}`);
      return;
    }

    if (this.gameState.hostPlayerId !== playerId) {
      console.warn(`Only host can start the game: ${playerId} is not host`);
      return;
    }

    if (this.gameState.players.size < 1) {
      console.warn('Cannot start game: need at least 1 player');
      return;
    }

    this.startRound();
  }

  // Reset game after round ends (called by any player)
  resetGame(): void {
    if (this.gameState.phase !== 'ENDED') {
      console.warn(`Cannot reset game: phase is ${this.gameState.phase}`);
      return;
    }

    // Reset scores
    for (const player of this.gameState.players.values()) {
      player.score = 0;
    }

    this.startRound();
  }

  private update(): void {
    // Update physics
    this.physicsEngine.update();

    // Update power-ups
    this.powerUpManager.update();

    // Handle ammo reload
    this.updateAmmo();
    
    // Clean up old pickup notifications (keep for 3 seconds)
    const now = Date.now();
    this.gameState.recentPickups = this.gameState.recentPickups.filter(
      pickup => now - pickup.timestamp < 3000
    );

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
      const maxAmmo = this.powerUpManager.getMaxAmmo(player);
      
      if (player.ammo < maxAmmo) {
        // Check if we can reload another charge
        const timeSinceLastReload = now - player.lastReloadTime;
        const baseReloadTime = 2000; // AMMO_RELOAD_TIME from constants
        const reloadMultiplier = this.powerUpManager.getReloadMultiplier(player);
        const reloadTime = baseReloadTime * reloadMultiplier;
        
        if (timeSinceLastReload >= reloadTime) {
          player.ammo = Math.min(player.ammo + 1, maxAmmo);
          player.lastReloadTime = now;
        }
      }
    }
  }

  private startRound(): void {
    this.gameState.isRoundActive = true;
    this.gameState.phase = 'PLAYING';
    this.gameState.roundEndTime = Date.now() + this.roundDuration;
    
    // Load random map
    const map = this.mapManager.getRandomMap();
    this.gameState.blocks = map.blocks;
    console.log(`[GameManager] Starting round with map: ${map.name}`);
    
    // Rebuild spatial grid for optimized collisions
    this.physicsEngine.rebuildSpatialGrid();

    // Reset all players
    for (const player of this.gameState.players.values()) {
      player.isAlive = true;
      player.position = this.getRandomSpawnPosition();
      player.velocity = { x: 0, y: 0 };
      player.rotation = Math.random() * Math.PI * 2;
      player.ammo = AMMO_CLIP_SIZE;
      player.isThrustActive = false;
      player.activePowerUps = [];
      player.shieldHits = undefined;
      player.dashCharges = undefined;
      player.minesAvailable = undefined;
    }

    this.gameState.bullets = [];
    
    // Clear all power-ups, mines, and pickups
    this.powerUpManager.clearAllPowerUps();
    this.gameState.recentPickups = [];

    this.io.emit('roundStart', this.gameState.roundEndTime);
  }

  private endRound(): void {
    this.gameState.isRoundActive = false;
    this.gameState.phase = 'ENDED';
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

    // Don't auto-restart - wait for playAgain
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    // Try to find a valid spawn position that doesn't collide with walls
    const maxAttempts = 100;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      
      // Check if this position is clear of walls
      if (!this.physicsEngine.isPositionInsideWall(x, y, SHIP_MAX_RADIUS)) {
        return { x, y };
      }
    }
    
    // Fallback: return center if we couldn't find a spot
    console.warn('[GameManager] Could not find clear spawn position, using center');
    return {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
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
        activePowerUps: p.activePowerUps,
        shieldHits: p.shieldHits,
        dashCharges: p.dashCharges,
        minesAvailable: p.minesAvailable,
      })),
      bullets: this.gameState.bullets,
      powerUps: this.gameState.powerUps,
      mines: this.gameState.mines,
      blocks: this.gameState.blocks,
      recentPickups: this.gameState.recentPickups,
      roundEndTime: this.gameState.roundEndTime,
      isRoundActive: this.gameState.isRoundActive,
      phase: this.gameState.phase,
      hostPlayerId: this.gameState.hostPlayerId,
    };

    this.io.emit('gameState', serialized);
  }
  
  // Expose PowerUpManager methods for InputHandler
  getPowerUpManager(): PowerUpManager {
    return this.powerUpManager;
  }
}
