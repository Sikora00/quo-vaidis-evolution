import './style.css'
import SimulationWorker from './simulation.worker?worker'

const worker = new SimulationWorker();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="sim-container">
    <h1>Quo Vaidis Evolution</h1>
    <div id="stats-population">Population: 0</div>
    
    <div class="toolbar">
      <button id="start-btn">Start</button>
      <button id="stop-btn">Stop</button>
      <button id="restart-btn">New Simulation</button>
    </div>

    <canvas id="sim-canvas"></canvas>

    <div class="bottom-panel">
      <div class="panel-header">
        <button class="tab-btn active" data-tab="tab-stats">Statistics</button>
        <button class="tab-btn" data-tab="tab-params">World Parameters</button>
        <button class="tab-btn" data-tab="tab-evolution">Evolution DNA</button>
      </div>

      <!-- Statistics Tab -->
      <div id="tab-stats" class="panel-content active">
        <div id="stats-dna">
          <div class="stat-row">
            <span class="stat-label">Empty</span>
            <div class="bar-container"><div id="bar-empty" class="bar-fill" style="width: 0%"></div></div>
            <span id="dna-empty" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Food</span>
            <div class="bar-container"><div id="bar-food" class="bar-fill" style="width: 0%"></div></div>
            <span id="dna-food" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Poison</span>
            <div class="bar-container"><div id="bar-poison" class="bar-fill" style="width: 0%"></div></div>
            <span id="dna-poison" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Partner (S)</span>
            <div class="bar-container"><div id="bar-same" class="bar-fill" style="width: 0%"></div></div>
            <span id="dna-same" class="stat-value">0</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Partner (D)</span>
            <div class="bar-container"><div id="bar-diff" class="bar-fill" style="width: 0%"></div></div>
            <span id="dna-diff" class="stat-value">0</span>
          </div>
        </div>
      </div>

      <!-- Parameters Tab -->
      <div id="tab-params" class="panel-content">
        <div class="params-column">
          <div class="control-group">
            <label>Simulation Delay: <span id="val-speed">33</span>ms</label>
            <input type="range" id="param-speed" min="0" max="500" value="33" step="1">
          </div>
          <div class="control-group">
            <label>Food Energy: <span id="val-food">60</span></label>
            <input type="range" id="param-food" min="10" max="200" value="60">
          </div>
          <div class="control-group">
            <label>Poison Loss: <span id="val-poison">100</span></label>
            <input type="range" id="param-poison" min="10" max="200" value="100">
          </div>
          <div class="control-group">
            <label>Move Cost: <span id="val-move">2</span></label>
            <input type="range" id="param-move" min="1" max="50" value="2">
          </div>
        </div>
        <div class="params-column">
          <div class="control-group">
            <label>Repro Cost: <span id="val-repro">50</span></label>
            <input type="range" id="param-repro" min="10" max="200" value="50">
          </div>
          <div class="control-group">
            <label>Food Spawn: <span id="val-food-spawn">5</span></label>
            <input type="range" id="param-food-spawn" min="0" max="50" value="5">
          </div>
          <div class="control-group">
            <label>Poison Spawn: <span id="val-poison-spawn">1</span></label>
            <input type="range" id="param-poison-spawn" min="0" max="50" value="1">
          </div>
        </div>
      </div>

      <!-- Evolution Tab -->
      <div id="tab-evolution" class="panel-content">
        <div class="control-group">
          <label>Initial Population: <span id="val-init-pop">50</span></label>
          <input type="range" id="init-pop" min="10" max="500" value="50">
        </div>
        <div class="control-group">
          <label>
            <input type="checkbox" id="use-custom-dna"> Override Initial DNA
          </label>
          <div id="custom-dna-controls" style="display: none; margin-top: 10px;">
            <p style="font-size: 0.75rem; color: #888; margin-bottom: 8px;">Drag to prioritize behavior:</p>
            <ul id="dna-priority-list" class="priority-list">
              <li draggable="true" data-type="1">Search for Food</li>
              <li draggable="true" data-type="4">Find Partner (Diff Gender)</li>
              <li draggable="true" data-type="0">Move to Empty Space</li>
              <li draggable="true" data-type="3">Find Partner (Same Gender)</li>
              <li draggable="true" data-type="2">Avoid Poison</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

const canvas = document.getElementById('sim-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const stopBtn = document.getElementById('stop-btn') as HTMLButtonElement;
const restartBtn = document.getElementById('restart-btn') as HTMLButtonElement;

let width = 0;
let height = 0;
const CELL_SIZE = 5; // Zoom factor

// Offscreen buffer for pixel-perfect rendering
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d', { alpha: false })!;

// Initialize worker
worker.postMessage({ type: 'INIT' });

worker.onmessage = (e) => {
  const { type, width: w, height: h, cells, agents } = e.data;

  if (type === 'INIT') {
    width = w;
    height = h;

    // Setup main canvas
    canvas.width = width * CELL_SIZE;
    canvas.height = height * CELL_SIZE;

    // Setup offscreen canvas (1 pixel per cell)
    offscreen.width = width;
    offscreen.height = height;

    console.log(`Simulation initialized: ${width}x${height}`);

    // Start automatically for demo? No, user button.
    startBtn.disabled = false;
  } else if (type === 'UPDATE') {
    render(cells, agents);
    if (e.data.stats) {
      updateStats(e.data.stats);
    }
  }
};

// Params Handling

function bindParam(id: string, type: string) {
  const el = document.getElementById(`param-${id}`) as HTMLInputElement;
  const disp = document.getElementById(`val-${id}`) as HTMLSpanElement;
  el.addEventListener('input', () => {
    disp.textContent = el.value;
    worker.postMessage({ type: 'SET_PARAM', param: type, value: parseInt(el.value) });
  });
}

bindParam('food', 'food_energy_gain');
bindParam('poison', 'poison_energy_loss');
bindParam('move', 'move_energy_cost');
bindParam('repro', 'repro_energy_cost');
bindParam('food-spawn', 'food_spawn_amount');
bindParam('poison-spawn', 'poison_spawn_amount');

// Speed control
const speedEl = document.getElementById('param-speed') as HTMLInputElement;
const speedDisp = document.getElementById('val-speed') as HTMLSpanElement;
speedEl.addEventListener('input', () => {
  speedDisp.textContent = speedEl.value;
  worker.postMessage({ type: 'SET_SPEED', value: parseInt(speedEl.value) });
});

function updateStats(stats: any) {
  document.getElementById('stats-population')!.textContent = `Population: ${stats.population}`;

  if (stats.avgGenes) {
    const updateStat = (id: string, val: number, barId: string) => {
      document.getElementById(id)!.textContent = val.toFixed(0);
      const pct = (val / 255) * 100;
      document.getElementById(barId)!.style.width = `${pct}%`;

      // Color coding based on intensity
      const bar = document.getElementById(barId)!;
      bar.style.backgroundColor = `hsl(${pct * 1.2}, 70%, 50%)`; // Gradient Red -> Greenish
    };

    updateStat('dna-empty', stats.avgGenes[0], 'bar-empty');
    updateStat('dna-food', stats.avgGenes[1], 'bar-food');
    updateStat('dna-poison', stats.avgGenes[2], 'bar-poison');
    updateStat('dna-same', stats.avgGenes[3], 'bar-same');
    updateStat('dna-diff', stats.avgGenes[4], 'bar-diff');
  }
}

function render(cells: Uint8Array, agents?: Uint32Array) {
  const imgData = offCtx.createImageData(width, height);
  const data = imgData.data;

  for (let i = 0; i < cells.length; i++) {
    const type = cells[i];
    const offset = i * 4;

    // Colors equivalent to CellType
    // 0 = Empty, 1 = Food, 2 = Poison
    if (type === 1) { // Food (Neon Green)
      data[offset] = 50;
      data[offset + 1] = 255;
      data[offset + 2] = 50;
      data[offset + 3] = 255;
    } else if (type === 2) { // Poison (Blue Violet)
      data[offset] = 138;
      data[offset + 1] = 43;
      data[offset + 2] = 226; // Blue Violet
      data[offset + 3] = 255;
    } else { // Empty (Translucent Black/Dark Blue)
      data[offset] = 5;
      data[offset + 1] = 5;
      data[offset + 2] = 10;
      data[offset + 3] = 255;
    }
  }

  // Draw Agents directly onto pixel buffer
  if (agents) {
    for (let i = 0; i < agents.length; i += 3) {
      const x = agents[i];
      const y = agents[i + 1];
      const gender = agents[i + 2]; // 0 = Male, 1 = Female

      const idx = (y * width + x) * 4;

      if (gender === 0) { // Male = Intense Cyan
        data[idx] = 0;
        data[idx + 1] = 212;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else { // Female = Hot Pink
        data[idx] = 255;
        data[idx + 1] = 105;
        data[idx + 2] = 180;
        data[idx + 3] = 255;
      }
    }
  }

  // Draw pixels to offscreen
  offCtx.putImageData(imgData, 0, 0);

  // Draw scaled to main canvas
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

// Tab Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.panel-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab')!;

    // Update buttons
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === tabId) content.classList.add('active');
    });
  });
});

startBtn.addEventListener('click', () => {
  worker.postMessage({ type: 'START' });
});

stopBtn.addEventListener('click', () => {
  worker.postMessage({ type: 'STOP' });
});

// Initial Settings Binding
const initPopEl = document.getElementById('init-pop') as HTMLInputElement;
const initPopDisp = document.getElementById('val-init-pop') as HTMLSpanElement;
initPopEl.addEventListener('input', () => initPopDisp.textContent = initPopEl.value);

const useCustomDnaEl = document.getElementById('use-custom-dna') as HTMLInputElement;
const customDnaPanel = document.getElementById('custom-dna-controls') as HTMLDivElement;
useCustomDnaEl.addEventListener('change', () => {
  customDnaPanel.style.display = useCustomDnaEl.checked ? 'block' : 'none';
});

// Drag and Drop Logic
const list = document.getElementById('dna-priority-list')!;
let draggedItem: HTMLElement | null = null;

list.addEventListener('dragstart', (e) => {
  draggedItem = e.target as HTMLElement;
  e.dataTransfer!.effectAllowed = 'move';
  // Add opacity to show it's being dragged
  setTimeout(() => (e.target as HTMLElement).style.opacity = '0.5', 0);
});

list.addEventListener('dragend', (e) => {
  (e.target as HTMLElement).style.opacity = '1';
  draggedItem = null;
});

list.addEventListener('dragover', (e) => {
  e.preventDefault(); // Necessary to allow dropping
  const target = e.target as HTMLElement;
  if (target && target !== draggedItem && target.tagName === 'LI') {
    const bounding = target.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);
    if (e.clientY - offset > 0) {
      target.style.borderBottom = '2px solid #646cff';
      target.style.borderTop = '';
    } else {
      target.style.borderTop = '2px solid #646cff';
      target.style.borderBottom = '';
    }
  }
});

list.addEventListener('dragleave', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'LI') {
    target.style.borderTop = '';
    target.style.borderBottom = '';
  }
});

list.addEventListener('drop', (e) => {
  e.preventDefault();
  const target = e.target as HTMLElement;
  if (target.tagName === 'LI' && draggedItem) {
    target.style.borderTop = '';
    target.style.borderBottom = '';

    const bounding = target.getBoundingClientRect();
    const offset = bounding.y + (bounding.height / 2);
    if (e.clientY - offset > 0) {
      target.after(draggedItem);
    } else {
      target.before(draggedItem);
    }
  }
});

restartBtn.addEventListener('click', () => {
  // Gather Config
  const population = parseInt(initPopEl.value);
  let dna: number[] | undefined = undefined;

  if (useCustomDnaEl.checked) {
    // Map order to values: Top = 255, Bottom = 55 (steps of 50)
    // 255, 205, 155, 105, 55
    dna = [0, 0, 0, 0, 0]; // Empty, Food, Poison, Same, Diff

    const items = list.querySelectorAll('li');
    items.forEach((item, index) => {
      const type = parseInt(item.getAttribute('data-type')!);
      const value = 255 - (index * 50); // Highest priority first
      dna![type] = value;
    });
  }

  worker.postMessage({ type: 'RESTART', config: { population, dna } });

  // Re-apply params
  for (const [key, type] of Object.entries({
    food: 'food_energy_gain',
    poison: 'poison_energy_loss',
    move: 'move_energy_cost',
    repro: 'repro_energy_cost',
    'food-spawn': 'food_spawn_amount',
    'poison-spawn': 'poison_spawn_amount'
  })) {
    const el = document.getElementById(`param-${key}`) as HTMLInputElement;
    worker.postMessage({ type: 'SET_PARAM', param: type, value: parseInt(el.value) });
  }
});
