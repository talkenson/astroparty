# AstroParty - Development Guide for AI Agents

## Project Overview
**AstroParty** is a real-time multiplayer space shooter game built with TypeScript, Socket.IO, and Canvas rendering. Players control ships using mobile phone controllers while watching the action on a shared display screen.

## Architecture

### Monorepo Structure
```
astroparty/
├── packages/
│   ├── shared/          # Shared types, constants, interfaces
│   ├── server/          # Game server (Node.js + Socket.IO)
│   ├── client-display/  # Display client (Canvas renderer)
│   └── client-controller/ # Mobile controller client
└── .agent/             # AI agent documentation
```

### Technology Stack
- **Language:** TypeScript
- **Runtime:** Node.js (server), Browser (clients)
- **Networking:** Socket.IO (WebSocket + polling fallback)
- **Build:** tsc (TypeScript compiler), Vite (client bundling)
- **Server Framework:** Fastify

## Key Systems

### 1. Network Architecture
**Critical:** AstroParty uses an optimized event-driven network model:

#### Display Clients (`?type=display`)
- Receive **full game state** at 60 FPS via `gameState` event
- Receive **static map data** once per round via `mapSync` event
- Belong to Socket.IO room `'displays'`
- Traffic: ~1.2 KB/frame (after mapSync optimization)

#### Controller Clients (`?type=controller`)
- Receive **personal state only** via `playerState` event
- Updates sent **only when state changes** (dirty set mechanism)
- Each controller has a dedicated room (socket.id)
- Traffic: ~0 bytes/sec when idle, ~100 bytes/action

#### Dirty Set Mechanism
Server tracks player state changes in `Set<string> dirtyPlayers`:
- Physics hits, kills, respawns → `PhysicsEngine` marks dirty
- Power-up pickups, expiry → `PowerUpManager` marks dirty
- Ammo usage → `InputHandler` marks dirty
- Network sends updates **only to dirty players**, then clears set

**Critical Files:**
- `packages/server/src/game/GameManager.ts` - Core dirty logic
- `packages/server/src/game/PhysicsEngine.ts` - Collision/respawn timers
- `packages/server/src/game/PowerUpManager.ts` - Power-up lifecycle

### 2. Game Loop (Server)
```
60 FPS tick:
1. PhysicsEngine.update() - movement, collisions, wall checks
2. PowerUpManager.update() - spawning, pickups, expiry
3. updateAmmo() - reload logic
4. broadcastGameState() - network sync
```

### 3. Map System
- Maps stored in `packages/server/maps/*.txt` (ASCII format)
- `#` = wall block, `.` = empty space
- Loaded by `MapManager`, converted to `Block[]` array
- **Spatial grid optimization**: O(1) collision detection via `Map<string, Block[]>`

### 4. Power-Ups
Defined in `packages/shared/src/PowerUpTypes.ts`:
- AMMO_BOOST, SPLIT_SHOT, SPEED_BOOST
- SHIELD, RAPID_FIRE, GHOST_MODE
- MEGA_BULLET, MINE_TRAP, TELEPORT_DASH
- REVERSE_CONTROLS (negative power-up)

## Common Development Tasks

### Building the Project
```bash
# Build order (dependencies first)
cd packages/shared && npm run build
cd packages/server && npm run build
cd packages/client-display && npm run dev  # or build
cd packages/client-controller && npm run dev  # or build
```

### Running the Server
```bash
cd packages/server
npm start  # or npm run dev for watch mode
```

### Adding a New Power-Up
1. Add enum to `PowerUpTypes.ts`
2. Add config to `POWERUP_CONFIGS`
3. Implement effect in `PowerUpManager.applyPowerUpEffect()`
4. **Don't forget:** Mark player dirty after applying!

### Debugging Network Issues
- Check client type param: `?type=display` or `?type=controller`
- Verify dirty set logic: Are changes calling `markPlayerDirty()`?
- Monitor `dirtyPlayers.size` - should clear to 0 after broadcast
- Check `broadcastGameState()` - displays vs controllers use different events

## Critical Patterns

### ✅ DO:
- Always call `markPlayerDirty(id)` when modifying player state
- Clear timers in `removePlayer()` (memory leak prevention)
- Use spatial grid for collision checks (`isPositionInsideWall`)
- Send map via `mapSync` for displays, not in `gameState`

### ❌ DON'T:
- Don't send `blocks` in `gameState` (wastes bandwidth)
- Don't modify player state without marking dirty (controllers won't update)
- Don't create respawn timers without tracking them (memory leak)
- Don't allow game actions in non-PLAYING phase

## Known Issues & Design Decisions

### Memory Management
- **setTimeout cleanup:** All respawn timers tracked in `Map<string, NodeJS.Timeout>`
- Cleared in `PhysicsEngine.clearRespawnTimer()` and `PowerUpManager.clearRespawnTimer()`
- Called from `GameManager.removePlayer()`

### Spawn System
- Uses grid-based spawn selection to avoid walls
- Falls back to center if no valid spawn found
- **Critical:** `PhysicsEngine.rebuildSpatialGrid()` must be called after map change

### Host Management
- First player to join becomes host
- Host reassigned automatically on disconnect
- `markAllPlayersDirty()` called on host change to update UI

## Testing Checklist

Before committing changes:
- [ ] Server builds without errors (`npm run build`)
- [ ] Shared types build first (dependency)
- [ ] New player sees correct phase (Start Game button or controls)
- [ ] Power-ups expire correctly and update controller UI
- [ ] Players can't move before game starts
- [ ] No memory leaks (timers cleared on disconnect)
- [ ] Display receives map via `mapSync` (check Network tab)

## Performance Targets

- **Server tick rate:** 60 FPS (16.67ms budget)
- **Display traffic:** <2 KB/frame after optimizations
- **Controller traffic:** <100 bytes/action, 0 when idle
- **Map sync:** Once per round + on display connect

## File Ownership Map

**Core Game Logic:**
- `GameManager.ts` - Game loop, state management, networking
- `PhysicsEngine.ts` - Movement, collisions, wall checks
- `PowerUpManager.ts` - Power-up lifecycle
- `InputHandler.ts` - Player input validation
- `MapManager.ts` - Map loading and selection

**Network:**
- `server.ts` - Socket.IO setup, client routing
- `types.ts` (shared) - Event interfaces, serialization types

**Client Display:**
- `CanvasRenderer.ts` - Game rendering
- `SocketClient.ts` - Network client

**Client Controller:**
- `Controller.ts` - UI updates, button handling
- `SocketClient.ts` - Network client

## Quick Reference

### Constants
Defined in `packages/shared/src/constants.ts`:
- GAME_WIDTH/HEIGHT: 1920x1080
- SHIP_SIZE: 24px
- BLOCK_SIZE: 40px
- AMMO_CLIP_SIZE: 3
- BULLET_SPEED: 600

### Socket Events
```typescript
// Server → Client
gameState: (state: SerializedGameState) => void
playerState: (state: PlayerSpecificState) => void
mapSync: (blocks: Block[]) => void
roundStart: (endTime: number) => void
roundEnd: (winner | null) => void

// Client → Server
input: (event: InputEvent) => void
joinGame: (playerName: string) => void
startGame: () => void
playAgain: () => void
```

## Contact & Resources
- Project: AstroParty multiplayer space shooter
- Stack: TypeScript + Socket.IO + Canvas
- Network model: Event-driven dirty checking
- Performance: 60 FPS server, <2KB/frame traffic
