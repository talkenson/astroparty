// ========================================
// Core Game Types
// ========================================

export interface Vector2D {
  x: number;
  y: number;
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
}

export interface Bullet {
  id: string;
  playerId: string;
  position: Vector2D;
  velocity: Vector2D;
  spawnTime: number;
}

export type GamePhase = 'WAITING' | 'PLAYING' | 'ENDED';

export interface GameState {
  players: Map<string, Player>;
  bullets: Bullet[];
  roundEndTime: number | null; // timestamp when round ends
  isRoundActive: boolean;
  phase: GamePhase; // Current game phase
  hostPlayerId: string | null; // First player who can start the game
}

// ========================================
// Socket Event Types
// ========================================

export enum InputAction {
  THRUST_START = "THRUST_START",
  THRUST_STOP = "THRUST_STOP",
  FIRE = "FIRE",
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
  }>;
  bullets: Bullet[];
  roundEndTime: number | null;
  isRoundActive: boolean;
  phase: GamePhase;
  hostPlayerId: string | null;
}
