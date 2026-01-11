use wasm_bindgen::prelude::*;
use rand::Rng;
use std::collections::HashMap;
use serde::Serialize;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CellType {
    Empty = 0,
    Food = 1,
    Poison = 2,
    Wall = 3,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Gender {
    Male,
    Female,
}

#[derive(Clone, Debug, Serialize)]
pub struct DNA {
    // Preferences for each neighbor type:
    // 0: Empty
    // 1: Food
    // 2: Poison
    // 3: Partner (Same Gender)
    // 4: Partner (Diff Gender)
    // Value is priority (higher = better). 0-255.
    pub genes: [u8; 5], 
}

impl DNA {
    pub fn random() -> DNA {
        let mut rng = rand::thread_rng();
        let mut genes = [0; 5];
        for i in 0..5 {
            genes[i] = rng.gen();
        }
        DNA { genes }
    }

    pub fn crossover(parent1: &DNA, parent2: &DNA) -> DNA {
        let mut rng = rand::thread_rng();
        let mut genes = [0; 5];
        for i in 0..5 {
            // 50/50 from each parent
            genes[i] = if rng.gen_bool(0.5) {
                parent1.genes[i]
            } else {
                parent2.genes[i]
            };
            
            // Mutation
            if rng.gen_bool(0.01) { // 1% mutation rate
                genes[i] = rng.gen(); 
            }
        }
        DNA { genes }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Agent {
    pub id: u32,
    pub x: u32,
    pub y: u32,
    pub energy: i32,
    pub gender: Gender,
    pub dna: DNA,
    pub age: u32,
}

#[wasm_bindgen]
pub struct World {
    width: u32,
    height: u32,
    cells: Vec<CellType>,
    // Map (x,y) -> AgentId for fast lookup
    position_map: HashMap<(u32, u32), u32>, 
    agents: HashMap<u32, Agent>,
    next_agent_id: u32,
    
    // Config params
    turn_energy_cost: i32,
    move_energy_cost: i32,
    food_energy_gain: i32,
    poison_energy_loss: i32,
    start_energy: i32,
    repro_energy_cost: i32,
    food_spawn_amount: u32,
    poison_spawn_amount: u32,
}

#[wasm_bindgen]
impl World {
    pub fn new(width: u32, height: u32) -> World {
        console_error_panic_hook::set_once();
        
        // Initialize cells
        let cells = (0..width * height)
            .map(|_| CellType::Empty)
            .collect();

        World {
            width,
            height,
            cells,
            position_map: HashMap::new(),
            agents: HashMap::new(),
            next_agent_id: 0,
            
            turn_energy_cost: 1,
            move_energy_cost: 2,
            food_energy_gain: 60,
            poison_energy_loss: 100,
            start_energy: 150,
            repro_energy_cost: 50,
            food_spawn_amount: 5,
            poison_spawn_amount: 1,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn cells(&self) -> *const CellType {
        self.cells.as_ptr()
    }

    pub fn spawn_agents(&mut self, count: u32) {
        self.spawn_agents_internal(count, None);
    }

    pub fn spawn_agents_with_dna(&mut self, count: u32, genes: &[u8]) {
        if genes.len() == 5 {
            let mut g = [0u8; 5];
            g.copy_from_slice(genes);
            self.spawn_agents_internal(count, Some(DNA { genes: g }));
        } else {
            // Fallback to random if invalid length
            self.spawn_agents_internal(count, None);
        }
    }

    fn spawn_agents_internal(&mut self, count: u32, specific_dna: Option<DNA>) {
        let mut rng = rand::thread_rng();
        for _ in 0..count {
            let mut x;
            let mut y;
            // Find empty spot
            // Safety break to prevent infinite loop if full
            let mut attempts = 0;
            loop {
                x = rng.gen_range(0..self.width);
                y = rng.gen_range(0..self.height);
                if !self.position_map.contains_key(&(x, y)) {
                    break;
                }
                attempts += 1;
                if attempts > 1000 { return; } // Give up
            }

            let gender = if rng.gen_bool(0.5) { Gender::Male } else { Gender::Female };
            let dna = if let Some(ref d) = specific_dna {
                d.clone()
            } else {
                DNA::random()
            };

            self.agents.insert(self.next_agent_id, Agent {
                id: self.next_agent_id,
                x,
                y,
                energy: self.start_energy,
                gender,
                dna,
                age: 0,
            });
            self.position_map.insert((x, y), self.next_agent_id);
            self.next_agent_id += 1;
        }
    }

    pub fn generate_random_objects(&mut self, food_count: u32, poison_count: u32) {
        let mut rng = rand::thread_rng();
        
        // Spawn food only on empty cells (not occupied by agents)
        for _ in 0..food_count {
            let mut attempts = 0;
            loop {
                let x = rng.gen_range(0..self.width);
                let y = rng.gen_range(0..self.height);
                let idx = (y * self.width + x) as usize;
                
                // Check if position is not occupied by an agent
                if !self.position_map.contains_key(&(x, y)) && self.cells[idx] == CellType::Empty {
                    self.cells[idx] = CellType::Food;
                    break;
                }
                
                attempts += 1;
                if attempts > 100 { break; } // Give up if map is too crowded
            }
        }

        // Spawn poison only on empty cells (not occupied by agents)
        for _ in 0..poison_count {
            let mut attempts = 0;
            loop {
                let x = rng.gen_range(0..self.width);
                let y = rng.gen_range(0..self.height);
                let idx = (y * self.width + x) as usize;
                
                // Check if position is not occupied by an agent
                if !self.position_map.contains_key(&(x, y)) && self.cells[idx] == CellType::Empty {
                    self.cells[idx] = CellType::Poison;
                    break;
                }
                
                attempts += 1;
                if attempts > 100 { break; } // Give up if map is too crowded
            }
        }
    }

    pub fn tick(&mut self) {
        let mut to_remove = Vec::new();
        let mut to_spawn = Vec::new(); // New agents from reproduction: (x, y, dna, energy)

        // Copy IDs to iterate safely
        let agent_ids: Vec<u32> = self.agents.keys().cloned().collect();

        for id in agent_ids {
            // Check if agent still alive (might have been killed in this turn by previously moved agent)
            if !self.agents.contains_key(&id) {
                continue;
            }

            let mut agent = self.agents.get(&id).unwrap().clone();
            
            // 1. Basic Turn Costs
            agent.energy -= self.turn_energy_cost;
            agent.age += 1;

            if agent.energy <= 0 {
                to_remove.push(id);
                // Also remove from map immediately so others can move there
                self.position_map.remove(&(agent.x, agent.y));
                self.agents.remove(&id);
                continue;
            }

            // 2. Decide Move
            let best_move = self.decide_move(&agent);
            
            if let Some((nx, ny)) = best_move {
                let current_pos = (agent.x, agent.y);
                let target_pos = (nx, ny);
                
                // Handle different target contents
                let cell_idx = (ny * self.width + nx) as usize;
                
                // Check for other agent
                if let Some(&other_id) = self.position_map.get(&target_pos) {
                     if other_id != id {
                         let other_agent = self.agents.get(&other_id).unwrap().clone();
                         
                         if agent.gender == other_agent.gender {
                             // Fight!
                             if agent.energy > other_agent.energy {
                                 // We win
                                 agent.energy += other_agent.energy; // Consume energy
                                 self.agents.remove(&other_id); // Kill other
                                 self.position_map.remove(&target_pos);
                                 
                                 // Move into spot
                                 self.position_map.remove(&current_pos);
                                 agent.x = nx;
                                 agent.y = ny;
                                 self.position_map.insert(target_pos, id);
                             } else {
                                 // We lose (die)
                                 let winner_new_energy = other_agent.energy + agent.energy;
                                 if let Some(winner) = self.agents.get_mut(&other_id) {
                                     winner.energy = winner_new_energy;
                                 }
                                 agent.energy = 0; // Mark as dead
                                 to_remove.push(id);
                                 self.position_map.remove(&current_pos);
                                 self.agents.remove(&id);
                                 continue; 
                             }
                         } else {
                             // Reproduce - check CURRENT energy of other agent, not cached copy
                             let other_current_energy = self.agents.get(&other_id).map(|a| a.energy).unwrap_or(0);
                             
                             if agent.energy > self.repro_energy_cost && other_current_energy > self.repro_energy_cost {
                                 // Both parents pay energy cost
                                 agent.energy -= self.repro_energy_cost;
                                 
                                 // Deduct energy from other parent
                                 if let Some(other) = self.agents.get_mut(&other_id) {
                                     other.energy -= self.repro_energy_cost;
                                 }
                                 
                                 // Child receives combined energy from both parents
                                 let child_energy = 2 * self.repro_energy_cost;
                                 let child_dna = DNA::crossover(&agent.dna, &other_agent.dna);
                                 to_spawn.push((agent.x, agent.y, child_dna, child_energy));
                             }
                         }
                     }
                } else {
                    // Empty, Food or Poison
                    match self.cells[cell_idx] {
                        CellType::Food => {
                            agent.energy += self.food_energy_gain;
                            self.cells[cell_idx] = CellType::Empty;
                        },
                        CellType::Poison => {
                            agent.energy -= self.poison_energy_loss;
                            self.cells[cell_idx] = CellType::Empty;
                        },
                        CellType::Empty => {} // Just move
                        _ => {}
                    }
                    
                    // Execute Move
                    agent.energy -= self.move_energy_cost;
                    self.position_map.remove(&current_pos);
                    agent.x = nx;
                    agent.y = ny;
                    self.position_map.insert(target_pos, id);
                }
            }

             // Update agent in map
             if agent.energy > 0 {
                 self.agents.insert(id, agent);
             } else {
                 to_remove.push(id);
                 self.position_map.remove(&(agent.x, agent.y));
                 self.agents.remove(&id);
             }
        }

        // Process Spawns
        let mut rng = rand::thread_rng();
        for (px, py, dna, child_energy) in to_spawn {
            // Find free spot near parent
            for dx in -1..=1 {
                for dy in -1..=1 {
                    if dx == 0 && dy == 0 { continue; }
                    let sx = (px as i32 + dx).clamp(0, self.width as i32 - 1) as u32;
                    let sy = (py as i32 + dy).clamp(0, self.height as i32 - 1) as u32;
                    
                    if !self.position_map.contains_key(&(sx, sy)) {
                         let gender = if rng.gen_bool(0.5) { Gender::Male } else { Gender::Female };
                         self.agents.insert(self.next_agent_id, Agent {
                            id: self.next_agent_id,
                            x: sx,
                            y: sy,
                            energy: child_energy, // Energy received from both parents
                            gender,
                            dna: dna.clone(),
                            age: 0,
                        });
                        self.position_map.insert((sx, sy), self.next_agent_id);
                        self.next_agent_id += 1;
                        break; // Spawned one
                    }
                }
            }
        }
        
        // Refill food randomly to keep sim going
        if rng.gen_bool(0.1) {
            self.generate_random_objects(self.food_spawn_amount, self.poison_spawn_amount); 
        }
    }
    
    fn decide_move(&self, agent: &Agent) -> Option<(u32, u32)> {
        let mut best_score = -1;
        let mut best_moves = Vec::new();
        
        for dx in -1..=1 {
            for dy in -1..=1 {
                if dx == 0 && dy == 0 { continue; }
                
                let nx = (agent.x as i32 + dx);
                let ny = (agent.y as i32 + dy);
                
                if nx < 0 || ny < 0 || nx >= self.width as i32 || ny >= self.height as i32 {
                    continue; // Out of bounds
                }
                
                let nx = nx as u32;
                let ny = ny as u32;
                
                // What is in the target?
                let score = if let Some(&other_id) = self.position_map.get(&(nx, ny)) {
                    if let Some(other) = self.agents.get(&other_id) {
                         if agent.gender == other.gender {
                             agent.dna.genes[3] as i32 // Same gender
                         } else {
                             agent.dna.genes[4] as i32 // Different gender
                         }
                    } else { 0 }
                } else {
                    let idx = (ny * self.width + nx) as usize;
                    match self.cells[idx] {
                        CellType::Empty => agent.dna.genes[0] as i32,
                        CellType::Food => agent.dna.genes[1] as i32,
                        CellType::Poison => agent.dna.genes[2] as i32,
                        _ => 0,
                    }
                };
                
                if score > best_score {
                    best_score = score;
                    best_moves.clear();
                    best_moves.push((nx, ny));
                } else if score == best_score {
                    best_moves.push((nx, ny));
                }
            }
        }
        
        if best_moves.is_empty() {
             None
        } else {
             // Pick random among best
             let idx = rand::thread_rng().gen_range(0..best_moves.len());
             Some(best_moves[idx])
        }
    }

    pub fn get_agents_render_data(&self) -> Vec<u32> {
        let mut data = Vec::with_capacity(self.agents.len() * 3);
        for agent in self.agents.values() {
            data.push(agent.x);
            data.push(agent.y);
            data.push(match agent.gender { Gender::Male => 0, Gender::Female => 1 });
        }
        data
    }
    
    // Params Setters
    pub fn set_turn_energy_cost(&mut self, val: i32) { self.turn_energy_cost = val; }
    pub fn set_move_energy_cost(&mut self, val: i32) { self.move_energy_cost = val; }
    pub fn set_food_energy_gain(&mut self, val: i32) { self.food_energy_gain = val; }
    pub fn set_poison_energy_loss(&mut self, val: i32) { self.poison_energy_loss = val; }
    pub fn set_repro_energy_cost(&mut self, val: i32) { self.repro_energy_cost = val; }
    pub fn set_food_spawn_amount(&mut self, val: u32) { self.food_spawn_amount = val; }
    pub fn set_poison_spawn_amount(&mut self, val: u32) { self.poison_spawn_amount = val; }

    // Statistics
    pub fn get_population_count(&self) -> usize {
        self.agents.len()
    }
    
    // Return average genes [empty, food, poison, partner_same, partner_diff]
    pub fn get_avg_genes(&self) -> Vec<f64> {
        if self.agents.is_empty() {
             return vec![0.0; 5];
        }
        
        let mut sums = [0.0; 5];
        for agent in self.agents.values() {
            for i in 0..5 {
                sums[i] += agent.dna.genes[i] as f64;
            }
        }
        
        let count = self.agents.len() as f64;
        sums.iter().map(|&s| s / count).collect()
    }
    
    pub fn get_agent_at(&self, x: u32, y: u32) -> JsValue {
        if let Some(&id) = self.position_map.get(&(x, y)) {
            if let Some(agent) = self.agents.get(&id) {
                return serde_wasm_bindgen::to_value(agent).unwrap();
            }
        }
        JsValue::NULL
    }
}
