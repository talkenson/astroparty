// Game configuration constants (from reference repository)
export const MAX_PLAYERS = 15;
export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

// Physics constants
export const ACCELERATION = 0.15; // Ship acceleration
export const MAX_SPEED = 5; // Maximum speed
export const FRICTION = 0.98; // Friction (inertia)
export const BULLET_SPEED = 8;

// Ammo system constants
export const AMMO_CLIP_SIZE = 3; // Clip size (number of charges)
export const AMMO_RELOAD_TIME = 2000; // Reload time for one charge in milliseconds
export const TURN_SPEED = 0.03; // Base turn speed
export const TURN_SPEED_MAX = 0.12; // Maximum turn speed
export const TURN_ACCELERATION_TIME = 3000; // Time in ms to reach maximum turn speed

// Ship dimensions
export const SHIP_SIZE = 30; // Ship size (length from nose to tail)
export const SHIP_MAX_RADIUS = Math.max(
  SHIP_SIZE,
  Math.sqrt(Math.pow(SHIP_SIZE * 0.6, 2) + Math.pow(SHIP_SIZE * 0.5, 2))
);

// Collision constants
export const COLLISION_DISTANCE = SHIP_MAX_RADIUS * 2; // Minimum distance between ship centers
export const COLLISION_FORCE = 0.8; // Repulsion force on collision
export const RESTITUTION = 0.6; // Coefficient of restitution (elasticity, 0-1)
export const SHIP_MASS = 1.0; // Ship mass (same for all)

// Function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Generate 15 colors evenly distributed around the color wheel
// Using larger steps for better distinction between adjacent colors
export const PLAYER_COLORS: string[] = [];
for (let i = 0; i < 15; i++) {
  const hue = (10 + i * 34) % 360; // Start at 10°, 34 degrees between colors for better separation
  const saturation = 100; // Full saturation for bright colors
  const lightness = 50; // Medium brightness for good visibility
  PLAYER_COLORS.push(hslToRgb(hue, saturation, lightness));
}

// Game timing
export const GAME_FPS = 60;
export const ROUND_END_DELAY = 10000; // 10 seconds

// Bullet constants
export const BULLET_RADIUS = 3;
export const BULLET_LIFETIME = 3000; // 3 seconds before auto-removal
