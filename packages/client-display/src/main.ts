import { CanvasRenderer } from './renderer/CanvasRenderer';
import { SocketClient } from './network/SocketClient';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const renderer = new CanvasRenderer(canvas);

// Connect to server (use window.location for production, localhost for dev)
const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const socketClient = new SocketClient(serverUrl);

// Listen for static map data (sent once per round or on connect)
socketClient.on('mapSync', (blocks) => {
  renderer.updateMap(blocks);
});

// Update renderer when game state changes
socketClient.on('gameState', (state) => {
  renderer.updateGameState(state);
});

socketClient.on('roundStart', (endTime) => {
  console.log('Round started, ends at:', new Date(endTime));
});

socketClient.on('roundEnd', (winner) => {
  if (winner) {
    console.log(`Round ended! Winner: ${winner.name} with ${winner.score} points`);
  } else {
    console.log('Round ended with no winner');
  }
});

// Update connection status UI
const statusDot = document.querySelector('.status-dot') as HTMLElement;
const statusText = document.querySelector('#connection-status span') as HTMLElement;

socketClient.on('connect', () => {
  statusDot.classList.remove('disconnected');
  statusText.textContent = 'Connected';
});

socketClient.on('disconnect', () => {
  statusDot.classList.add('disconnected');
  statusText.textContent = 'Disconnected';
});

// Start render loop
renderer.start();
