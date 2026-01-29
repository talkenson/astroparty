import Fastify from 'fastify';
import FastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { GameManager } from './game/GameManager.js';
import type { ClientToServerEvents, ServerToClientEvents } from '@astroparty/shared';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROUND_DURATION = parseInt(process.env.ROUND_DURATION || '150000', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Initialize Fastify
const fastify = Fastify({
  logger: true,
});

// Serve static files in production mode
if (IS_PRODUCTION) {
  const clientDisplayPath = join(__dirname, '../../client-display/dist');
  const clientControllerPath = join(__dirname, '../../client-controller/dist');

  fastify.register(FastifyStatic, {
    root: clientDisplayPath,
    prefix: '/display/',
  });

  fastify.register(FastifyStatic, {
    root: clientControllerPath,
    prefix: '/controller/',
    decorateReply: false,
  });

  // Redirect root to display in production
  fastify.get('/', async (request, reply) => {
    return reply.redirect('/display/');
  });
}

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Initialize Socket.IO
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
  cors: {
    origin: '*', // In production, restrict this to your domain
    methods: ['GET', 'POST'],
  },
});

// Initialize Game Manager
const gameManager = new GameManager(io, ROUND_DURATION);

// Socket.IO connection handler
io.on('connection', (socket) => {
  fastify.log.info(`Client connected: ${socket.id}`);

  socket.on('joinGame', (playerName, callback) => {
    fastify.log.info(`Player joining: ${playerName} (${socket.id})`);
    gameManager.addPlayer(socket.id, playerName);
    callback(socket.id);
  });

  socket.on('input', (event) => {
    gameManager.handleInput(event);
  });

  socket.on('disconnect', () => {
    fastify.log.info(`Client disconnected: ${socket.id}`);
    gameManager.removePlayer(socket.id);
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`🚀 AstroParty server running on port ${PORT}`);
    
    if (IS_PRODUCTION) {
      fastify.log.info(`🌐 Game URL: http://localhost:${PORT}`);
      fastify.log.info(`📺 Display: http://localhost:${PORT}/display/`);
      fastify.log.info(`🎮 Controller: http://localhost:${PORT}/controller/`);
    } else {
      fastify.log.info(`📺 Display client (Vite dev): http://localhost:5173`);
      fastify.log.info(`🎮 Controller client (Vite dev): http://localhost:5174`);
    }
    
    fastify.log.info(`⏱️  Round duration: ${ROUND_DURATION}ms`);
    
    // Start game loop
    gameManager.start();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
