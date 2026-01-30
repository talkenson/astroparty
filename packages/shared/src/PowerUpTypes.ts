import type { Vector2D } from './types.js';

// ========================================
// Power-Up Type Enumeration
// ========================================

export enum PowerUpType {
  AMMO_BOOST = 'AMMO_BOOST',
  SPLIT_SHOT = 'SPLIT_SHOT',
  SPEED_BOOST = 'SPEED_BOOST',
  MINE_TRAP = 'MINE_TRAP',
  SHIELD = 'SHIELD',
  RAPID_FIRE = 'RAPID_FIRE',
  GHOST_MODE = 'GHOST_MODE',
  MEGA_BULLET = 'MEGA_BULLET',
  TELEPORT_DASH = 'TELEPORT_DASH',
  REVERSE_CONTROLS = 'REVERSE_CONTROLS',
}

// ========================================
// Power-Up Interfaces
// ========================================

export interface PowerUpConfig {
  type: PowerUpType;
  color: string;
  duration: number; // milliseconds, 0 for instant/charge-based
  icon: string; // emoji or symbol
}

export interface PowerUp {
  id: string;
  type: PowerUpType;
  position: Vector2D;
  spawnTime: number;
}

export interface ActivePowerUpEffect {
  type: PowerUpType;
  expiresAt: number; // timestamp when effect expires
  // Type-specific data
  splitShotActive?: boolean;
  ammoBoostActive?: boolean;
  speedBoostActive?: boolean;
  rapidFireActive?: boolean;
  ghostModeActive?: boolean;
  megaBulletsRemaining?: number; // for MEGA_BULLET
  reverseControlsActive?: boolean;
}

export interface Mine {
  id: string;
  playerId: string;
  position: Vector2D;
  spawnTime: number;
}

// ========================================
// Power-Up Configurations
// ========================================

export const POWERUP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  [PowerUpType.AMMO_BOOST]: {
    type: PowerUpType.AMMO_BOOST,
    color: '#FFD700', // Gold
    duration: 20000, // 20 seconds
    icon: '🟡',
  },
  [PowerUpType.SPLIT_SHOT]: {
    type: PowerUpType.SPLIT_SHOT,
    color: '#9B59B6', // Purple
    duration: 15000, // 15 seconds
    icon: '🟣',
  },
  [PowerUpType.SPEED_BOOST]: {
    type: PowerUpType.SPEED_BOOST,
    color: '#3498DB', // Blue
    duration: 15000, // 15 seconds
    icon: '🔵',
  },
  [PowerUpType.MINE_TRAP]: {
    type: PowerUpType.MINE_TRAP,
    color: '#E74C3C', // Red
    duration: 0, // Gives 3 charges
    icon: '🔴',
  },
  [PowerUpType.SHIELD]: {
    type: PowerUpType.SHIELD,
    color: '#2ECC71', // Green
    duration: 20000, // 20 seconds or until depleted
    icon: '🟢',
  },
  [PowerUpType.RAPID_FIRE]: {
    type: PowerUpType.RAPID_FIRE,
    color: '#E67E22', // Orange
    duration: 15000, // 15 seconds
    icon: '🟠',
  },
  [PowerUpType.GHOST_MODE]: {
    type: PowerUpType.GHOST_MODE,
    color: '#ECF0F1', // White
    duration: 10000, // 10 seconds
    icon: '⚪',
  },
  [PowerUpType.MEGA_BULLET]: {
    type: PowerUpType.MEGA_BULLET,
    color: '#C0392B', // Dark Red
    duration: 0, // Gives 5 mega bullets
    icon: '🟤',
  },
  [PowerUpType.TELEPORT_DASH]: {
    type: PowerUpType.TELEPORT_DASH,
    color: '#1ABC9C', // Cyan
    duration: 0, // Gives 3 charges
    icon: '🟪',
  },
  [PowerUpType.REVERSE_CONTROLS]: {
    type: PowerUpType.REVERSE_CONTROLS,
    color: '#95A5A6', // Gray
    duration: 8000, // 8 seconds (applied to random enemy)
    icon: '⚫',
  },
};
