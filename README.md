# 🚀 AstroParty

A multiplayer browser-based space combat game inspired by classic Asteroids. Players control spaceships with simple two-button controls in an intense battle arena.

## 🎮 Game Features

- **2-16 Players**: Support for solo flight or intense multiplayer battles
- **Simple Controls**: Two buttons - Thrust/Rotate and Fire
- **Jackbox-Style**: Separate controller devices and shared display screen
- **Real-time Multiplayer**: WebSocket-based synchronization

## 🏗️ Architecture

- **Server**: Fastify + Socket.io + Matter.js physics
- **Display Client**: Full-screen game field with Canvas rendering
- **Controller Client**: Mobile-friendly two-button interface
- **Shared Package**: Common types and game constants

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
```

### Development

```bash
# Start all services (server + both clients)
pnpm dev
```

**Development URLs:**
- **Display**: http://localhost:5173
- **Controller**: http://localhost:5174

**Production URLs (after `npm start`):**
- **Display**: http://localhost:3000/display/
- **Controller**: http://localhost:3000/controller/

### Production

```bash
# Build all packages
npm run build

# Start server
npm start
```

## 🐳 Docker Deployment

### Build Docker Image

```bash
# Build the Docker image
docker build -t astroparty:latest .

# Or use docker-compose
docker-compose build
```

### Run with Docker

```bash
# Run with docker-compose (recommended)
docker-compose up -d

# Or run directly
docker run -d -p 3000:3000 \
  -e ROUND_DURATION=150000 \
  --name astroparty \
  astroparty:latest
```

Then open:
- **Display**: http://localhost:3000/display/
- **Controller**: http://localhost:3000/controller/

### Stop Docker Container

```bash
# With docker-compose
docker-compose down

# Or stop container directly
docker stop astroparty
docker rm astroparty
```

## 🎯 How to Play

1. Open the **Display** on a large screen (TV, monitor)
2. Players open **Controller** on their phones/devices
3. Enter your name and join
4. **Left Button**: Press to thrust forward, release to rotate clockwise
5. **Right Button**: Fire bullets (3 ammo, 2s reload per charge)
6. Destroy other ships to score points!
7. Ships wrap around screen edges, bullets disappear at edges

## 📁 Project Structure

```
astroparty/
├── packages/
│   ├── shared/          # Types and constants
│   ├── server/          # Game server
│   ├── client-display/  # Game field display
│   └── client-controller/ # Player controls
└── package.json
```

## 🔧 Configuration

Edit `.env` to configure:
- `PORT`: Server port (default: 3000)
- `ROUND_DURATION`: Round length in milliseconds (default: 150000 = 2:30)

## 🛠️ Tech Stack

- **TypeScript** - Type safety
- **Fastify** - Fast server framework
- **Socket.io** - Real-time communication
- **Matter.js** - Physics engine
- **Vite** - Fast build tool
- **Canvas API** - Game rendering

## 📝 License

MIT
