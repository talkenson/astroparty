import type { Server as SocketIOServer } from 'socket.io';
import type {
  Player,
  Bullet,
  GameState,
  SerializedGameState,
  ClientToServerEvents,
  ServerToClientEvents,
  InputEvent,
  PlayerSpecificState, // Import added
} from '@astroparty/shared';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GAME_FPS,
  MAX_PLAYERS,
  PLAYER_COLORS,
  AMMO_CLIP_SIZE,
  SHIP_MAX_RADIUS,
  BLOCK_SIZE,
  GRID_WIDTH,
  GRID_HEIGHT,
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
  // Dirty set for network optimization
  private dirtyPlayers: Set<string> = new Set();

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

    this.physicsEngine = new PhysicsEngine(this.gameState, (id) => this.markPlayerDirty(id));
    this.inputHandler = new InputHandler(this.gameState, this);
    this.powerUpManager = new PowerUpManager(this.gameState, this.physicsEngine, (id) => this.markPlayerDirty(id));
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

    // Initial state sync for the new player
    this.markPlayerDirty(playerId);

    // Don't auto-start anymore - wait for host to click start
  }

  removePlayer(playerId: string): void {
    // Check if host left
    const wasHost = this.gameState.hostPlayerId === playerId;

    this.gameState.players.delete(playerId);
    this.playerNames.delete(playerId);
    this.dirtyPlayers.delete(playerId); // Clean up dirty set
    
    // Clear any pending respawn timers
    this.physicsEngine.clearRespawnTimer(playerId);
    this.powerUpManager.clearRespawnTimer(playerId);
    
    // Remove bullets from this player
    this.gameState.bullets = this.gameState.bullets.filter(b => b.playerId !== playerId);
    
    // Remove mines from this player
    this.gameState.mines = this.gameState.mines.filter(m => m.playerId !== playerId);

    // Reassign host if needed
    if (wasHost) {
      const remainingPlayers = Array.from(this.gameState.players.keys());
      if (remainingPlayers.length > 0) {
        this.gameState.hostPlayerId = remainingPlayers[0];
        console.log(`Host left. New host assigned: ${this.gameState.hostPlayerId}`);
      } else {
        this.gameState.hostPlayerId = null;
      }
      // Notify everyone about new host
      this.markAllPlayersDirty();
    }

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
            this.markPlayerDirty(player.id);
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
    
    // Sync new map to all displays
    this.syncMapToAllDisplays();
    
    // Force update for everyone
    this.markAllPlayersDirty();
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

    // Update all clients with new phase
    this.markAllPlayersDirty();

    // Don't auto-restart - wait for playAgain
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    // Try to find a valid spawn position that doesn't collide with walls
    const maxAttempts = 30;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.random() * GAME_WIDTH;
      const y = Math.random() * GAME_HEIGHT;
      
      // Check if this position is clear of walls
      if (!this.physicsEngine.isPositionInsideWall(x, y, SHIP_MAX_RADIUS)) {
        return { x, y };
      }
    }
    
    // Fallback: systematically search grid centers
    // Center of block is safest: BLOCK_SIZE/2 + i * BLOCK_SIZE
    console.warn('[GameManager] Random spawn failed, searching grid centers...');
    
    // Create a randomized order of grid indices to avoid always spawning top-left
    const gridIndices: {x: number, y: number}[] = [];
    // Skip outer edges (0 and MAX-1) to avoid map boundaries
    for (let y = 1; y < GRID_HEIGHT - 1; y++) {
      for (let x = 1; x < GRID_WIDTH - 1; x++) {
        gridIndices.push({x, y});
      }
    }
    
    // Shuffle indices for variety even in fallback
    for (let i = gridIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gridIndices[i], gridIndices[j]] = [gridIndices[j], gridIndices[i]];
    }

    // Check each grid center
    for (const pos of gridIndices) {
      const centerX = pos.x * BLOCK_SIZE + BLOCK_SIZE / 2;
      const centerY = pos.y * BLOCK_SIZE + BLOCK_SIZE / 2;

      if (!this.physicsEngine.isPositionInsideWall(centerX, centerY, SHIP_MAX_RADIUS)) {
        console.log(`[GameManager] Found spawn at grid center (${centerX}, ${centerY})`);
        return { x: centerX, y: centerY };
      }
    }
    
    // Last resort: force spawn at top-left corner (should never happen with proper maps)
    console.error('[GameManager] NO VALID SPAWN FOUND! Using emergency position');
    return { x: 90, y: 90 };
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
      // blocks removed - sent separately via mapSync
      recentPickups: this.gameState.recentPickups,
      roundEndTime: this.gameState.roundEndTime,
      isRoundActive: this.gameState.isRoundActive,
      phase: this.gameState.phase,
      hostPlayerId: this.gameState.hostPlayerId,
    };

    this.io.to('displays').emit('gameState', serialized);
    
    // Send optimized state only to dirty players
    if (this.dirtyPlayers.size > 0) {
      for (const playerId of this.dirtyPlayers) {
        const player = this.gameState.players.get(playerId);
        if (!player) continue;

        const state: PlayerSpecificState = {
          id: player.id,
          name: player.name,
          color: player.color,
          ammo: player.ammo,
          isAlive: player.isAlive,
          score: player.score,
          activePowerUps: player.activePowerUps,
          shieldHits: player.shieldHits,
          dashCharges: player.dashCharges,
          minesAvailable: player.minesAvailable,
          phase: this.gameState.phase,
          roundEndTime: this.gameState.roundEndTime,
          hostPlayerId: this.gameState.hostPlayerId,
        };

        this.io.to(player.id).emit('playerState', state);
      }
      this.dirtyPlayers.clear();
    }
  }

  public markPlayerDirty(playerId: string): void {
    this.dirtyPlayers.add(playerId);
  }

  private markAllPlayersDirty(): void {
    for (const id of this.gameState.players.keys()) {
      this.dirtyPlayers.add(id);
    }
  }

  /**
   * Sync map to a specific display client
   */
  syncMapToDisplay(socketId: string): void {
    this.io.to(socketId).emit('mapSync', this.gameState.blocks);
  }

  /**
   * Sync map to all displays (called on round start)
   */
  syncMapToAllDisplays(): void {
    this.io.to('displays').emit('mapSync', this.gameState.blocks);
  }
  
  // Expose PowerUpManager methods for InputHandler
  getPowerUpManager(): PowerUpManager {
    return this.powerUpManager;
  }
}
