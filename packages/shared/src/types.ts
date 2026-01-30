// ========================================
// Core Game Types
// ========================================

import type { ActivePowerUpEffect } from './PowerUpTypes.js';

export interface Vector2D {
  x: number;
  y: number;
}

// ========================================
// Map Types
// ========================================

export interface Block {
  gridX: number; // X position in grid (0-31)
  gridY: number; // Y position in grid (0-17)
}

export interface MapData {
  name: string;
  blocks: Block[];
}

export interface Player {
  id: string;
  name: string;
  position: Vector2D;
  velocity: Vector2D;
  rotation: number; // radians
  color: string;
  score: number;
  ammo: number;
  isAlive: boolean;
  isThrustActive: boolean; // whether player is currently thrusting
  turnStartTime: number; // timestamp when rotation started (for acceleration)
  lastReloadTime: number; // timestamp of last ammo reload
  
  // Power-up related fields
  activePowerUps: ActivePowerUpEffect[];
  shieldHits?: number; // Remaining hits shield can absorb
  dashCharges?: number; // Remaining teleport dash charges
  minesAvailable?: number; // Remaining mines to place
}

export interface Bullet {
  id: string;
  playerId: string;
  position: Vector2D;
  velocity: Vector2D;
  spawnTime: number;
  isMega: boolean; // Is this a mega bullet?
}

export type GamePhase = 'WAITING' | 'PLAYING' | 'ENDED';

export interface GameState {
  players: Map<string, Player>;
  bullets: Bullet[];
  powerUps: PowerUp[];
  mines: Mine[];
  blocks: Block[]; // Current map blocks
  recentPickups: PowerUpPickup[]; // Recent power-up pickups for notifications
  roundEndTime: number | null; // timestamp when round ends
  isRoundActive: boolean;
  phase: GamePhase; // Current game phase
  hostPlayerId: string | null; // First player who can start the game
}

// Import Mine and PowerUp from PowerUpTypes
import type { Mine, PowerUp, PowerUpType } from './PowerUpTypes.js';

// Power-up pickup event (for client notifications)
export interface PowerUpPickup {
  type: PowerUpType;
  position: Vector2D;
  timestamp: number;
}

// ========================================
// Socket Event Types
// ========================================

export enum InputAction {
  THRUST_START = "THRUST_START",
  THRUST_STOP = "THRUST_STOP",
  FIRE = "FIRE",
  PLACE_MINE = "PLACE_MINE",
  DASH = "DASH",
}

export interface InputEvent {
  playerId: string;
  action: InputAction;
  timestamp: number;
}

// Client -> Server events
export interface ClientToServerEvents {
  joinGame: (playerName: string, callback: (playerId: string) => void) => void;
  input: (event: InputEvent) => void;
  startGame: () => void; // Host starts the game
  playAgain: () => void; // Any player requests new round
  disconnect: () => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  gameState: (state: SerializedGameState) => void;
  playerJoined: (playerId: string, playerName: string) => void;
  playerLeft: (playerId: string) => void;
  roundStart: (endTime: number) => void;
  roundEnd: (winner: { id: string; name: string; score: number } | null) => void;
}

// Serialized version of GameState for network transmission
export interface SerializedGameState {
  players: Array<{
    id: string;
    name: string;
    position: Vector2D;
    velocity: Vector2D;
    rotation: number;
    color: string;
    score: number;
    ammo: number;
    isAlive: boolean;
    activePowerUps: ActivePowerUpEffect[];
    shieldHits?: number;
    dashCharges?: number;
    minesAvailable?: number;
  }>;
  bullets: Bullet[];
  powerUps: PowerUp[];
  mines: Mine[];
  blocks: Block[];
  recentPickups: PowerUpPickup[];
  roundEndTime: number | null;
  isRoundActive: boolean;
  phase: GamePhase;
  hostPlayerId: string | null;
}
