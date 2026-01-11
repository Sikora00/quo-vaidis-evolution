
import init, { World } from '../simulation-wasm/pkg/simulation_wasm';

let world: World | null = null;
let timerId: any = null;
let isRunning = false;
let tickDelay = 33; // Default ~30 FPS
let wasmMemory: WebAssembly.Memory;

async function initialize(config?: { population: number, dna?: number[] }) {
    if (!wasmMemory) {
        const wasm = await init();
        wasmMemory = wasm.memory;
    }

    // Create initial world
    const width = 100;
    const height = 100;
    world = World.new(width, height);
    world.generate_random_objects(200, 50); // Initial food/poison

    // Config defaults
    const pop = config?.population ?? 50;

    if (config?.dna && config.dna.length === 5) {
        const dnaArray = new Uint8Array(config.dna);
        world.spawn_agents_with_dna(pop, dnaArray);
    } else {
        world.spawn_agents(pop);
    }

    (self as any).postMessage({
        type: 'INIT',
        width: world.width(),
        height: world.height()
    });
}

function loop() {
    if (!isRunning || !world || !wasmMemory) return;

    world.tick();

    const cellsPtr = world.cells();
    const width = world.width();
    const height = world.height();
    const len = width * height;

    // Create a view into Wasm memory
    const cellsView = new Uint8Array(wasmMemory.buffer, cellsPtr, len);

    // Create a copy to transfer to main thread (avoid detach issues with shared wasm memory if we ever used it, but mainly because we can't transfer the view directly without copy if we want to detach)
    // Actually, simple copy is enough.
    const cellsCopy = cellsView.slice();

    // Get agents data
    const agentsData = world.get_agents_render_data();
    const agentsArray = new Uint32Array(agentsData);

    // Get stats
    const stats = {
        population: world.get_population_count(),
        avgGenes: Array.from(world.get_avg_genes()) // Convert Float64Array to JS array
    };

    // Type assertion for Worker Global Scope
    (self as any).postMessage({
        type: 'UPDATE',
        cells: cellsCopy,
        agents: agentsArray,
        stats
    }, [cellsCopy.buffer, agentsArray.buffer]);

    // Schedule next tick
    timerId = setTimeout(loop, tickDelay);
}

self.onmessage = async (e) => {
    const { type, param, value, config } = e.data;

    switch (type) {
        case 'INIT':
        case 'RESTART':
            isRunning = false;
            if (timerId) clearTimeout(timerId);
            await initialize(config);
            break;
        case 'START':
            if (!isRunning) {
                isRunning = true;
                loop();
            }
            break;
        case 'STOP':
            isRunning = false;
            if (timerId) clearTimeout(timerId);
            break;
        case 'SET_SPEED':
            tickDelay = value;
            break;
        case 'SET_PARAM':
            if (world) {
                switch (param) {
                    case 'food_energy_gain': world.set_food_energy_gain(value); break;
                    case 'poison_energy_loss': world.set_poison_energy_loss(value); break;
                    case 'move_energy_cost': world.set_move_energy_cost(value); break;
                    case 'repro_energy_cost': world.set_repro_energy_cost(value); break;
                    case 'food_spawn_amount': world.set_food_spawn_amount(value); break;
                    case 'poison_spawn_amount': world.set_poison_spawn_amount(value); break;
                }
            }
            break;
    }
};
