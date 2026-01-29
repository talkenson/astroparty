import { NameInput } from './components/NameInput';
import { Controller } from './components/Controller';

const nameInput = new NameInput();
const controller = new Controller();

// When player joins, switch to controller screen
nameInput.onJoin((playerName, playerId) => {
  document.getElementById('name-input-screen')!.style.display = 'none';
  document.getElementById('controller-screen')!.classList.add('active');
  document.getElementById('player-name')!.textContent = playerName;
  
  controller.start(playerId);
});
