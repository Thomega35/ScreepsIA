import _ from "lodash";

// Array defining relative positions for checking around an entity (e.g., for road building)
const around: number[][] = [
  [-1, 0], [0, -1], [0, 1], [1, 0], // Orthogonal
  // [-1, -1], [-1, 1], [1, -1], [1, 1] // Optional: Diagonal
];

export const SystemScript = {
  /**
   * Attempts to generate a pixel if the CPU bucket is full.
   * Also logs bucket status.
   */
  generatePixel: function () {
    // Basic logging of bucket status, avoiding excessive console spam.
    if (Game.time % 100 === 0) { // Log every 100 ticks
      console.log(`CPU Bucket: ${Game.cpu.bucket}`);
    }
    if (Game.cpu.bucket >= 10000) { // Check if bucket is full (10000 is the max)
      const result = Game.cpu.generatePixel();
      if (result === OK) {
        console.log("Successfully generated a pixel!");
      } else {
        console.log(`Failed to generate pixel, error: ${result}`);
      }
    }
  },

  /**
   * Prints comprehensive information about a room's status and creep distribution.
   * @param {Room} room - The room object to display information about.
   * @param {{ [role: string]: Creep[] }} creepsByRole - An object grouping creeps by their role,
   *                                                    expected to be filtered for the given room or a specific spawn's responsibility.
   */
  printInfo: function (room: Room, creepsByRole: { [role: string]: Creep[] }) {
    console.log(`--- Room Info: ${room.name} (Tick: ${Game.time}) ---`);
    console.log(`RCL: ${room.controller ? room.controller.level : "N/A"}, Progress: ${room.controller ? room.controller.progress : 0}/${room.controller ? room.controller.progressTotal : 0}, Energy: ${room.energyAvailable}/${room.energyCapacityAvailable}`);

    const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
    console.log(`Towers: ${towers.length} (Energy: ${_.sum(towers, t => (t as StructureTower).store.getUsedCapacity(RESOURCE_ENERGY))})`);

    const storage = room.storage;
    if (storage) {
      console.log(`Storage: ${storage.store[RESOURCE_ENERGY]} energy / ${storage.store.getCapacity()} capacity`);
    } else {
      console.log("Storage: None");
    }

    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
    console.log(`Construction Sites: ${constructionSites.length}`);

    console.log("--- Creep Info ---");
    if (Object.keys(creepsByRole).length === 0) {
        console.log("No creeps found for the specified grouping in this room.");
    } else {
        for (const role in creepsByRole) {
          let roleInfo = `Role ${role}: ${creepsByRole[role].length} creeps`;
          if (role === "miner") {
            const miners = creepsByRole[role];
            if (miners.length > 0) {
                const minerBySource = _.groupBy(miners, creep => creep.memory.sourceId); // Assuming sourceId is stored
                let sourcesDetails: string[] = [];
                Object.keys(minerBySource).forEach((sourceId, index) => {
                    const sourceObj = Game.getObjectById(sourceId as Id<Source>);
                    const sourcePos = sourceObj ? `(${sourceObj.pos.x},${sourceObj.pos.y})` : `[ID: ${sourceId ? sourceId.slice(-3) : 'unknown'}]`;
                    sourcesDetails.push(`S${index}${sourcePos}: ${minerBySource[sourceId].length}`);
                });
                if (sourcesDetails.length > 0) {
                    roleInfo += ` (${sourcesDetails.join(", ")})`;
                }
            }
          }
          console.log(roleInfo);
        }
    }
    console.log("--- End Info ---");
  },

  /**
   * Cleans up memory by deleting entries for creeps that no longer exist in the game.
   */
  cleanMemory: function () {
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
        // console.log(`Cleaned memory for missing creep: ${name}`); // Optional: for debugging
      }
    }
    // Consider also cleaning Memory.structures if a structure is destroyed
    for (const id in Memory.structures) {
        if (!Game.getObjectById(id as Id<Structure>)) {
            delete Memory.structures[id];
            // console.log(`Cleaned memory for destroyed structure: ${id}`); // Optional
        }
    }
  },

  /**
   * Counts the number of existing and under-construction extensions in a spawn's room.
   * @param {StructureSpawn} spawn - The spawn whose room will be checked.
   * @returns {number} The total count of extensions (built and construction sites).
   */
  countExtensions: function (spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length
    );
  },

  /**
   * Counts the number of existing and under-construction storages in a spawn's room.
   * @param {StructureSpawn} spawn - The spawn whose room will be checked.
   * @returns {number} The total count of storages (built and construction sites).
   */
  countStorage: function (spawn: StructureSpawn): number { // Note: Usually only one storage per room.
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length
    );
  },

  /**
   * Creates construction sites for roads around a list of structures or construction sites.
   * @param {(AnyOwnedStructure | ConstructionSite)[]} elements - An array of structures/sites to build roads around.
   */
  buildRoadAroundlistElement: function (elements: (AnyOwnedStructure | ConstructionSite)[]) {
    for (const element of elements) {
      if (!element.room) continue;
      for (const posDelta of around) { // Using the 'around' constant
        const x = element.pos.x + posDelta[0];
        const y = element.pos.y + posDelta[1];

        // Basic boundary check
        if (x < 0 || x > 49 || y < 0 || y > 49) continue;

        const lookResult = element.room.lookAt(x, y);
        let canBuild = true;
        for (const item of lookResult) {
          if (item.type === "terrain" && item.terrain === "wall") {
            canBuild = false;
            break;
          }
          if (item.type === "structure" && item.structure?.structureType !== STRUCTURE_ROAD) {
            // Allow building road over existing road (for decay repair) but not other structures
            canBuild = false;
            break;
          }
          if (item.type === "constructionSite" && item.constructionSite?.structureType !== STRUCTURE_ROAD) {
            canBuild = false;
            break;
          }
        }
        if (canBuild) {
          element.room.createConstructionSite(x, y, STRUCTURE_ROAD);
        }
      }
    }
  },

  /**
   * Counts the number of existing and under-construction towers in a spawn's room.
   * @param {StructureSpawn} spawn - The spawn whose room will be checked.
   * @returns {number} The total count of towers (built and construction sites).
   */
  countTowers: function (spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length
    );
  },

  /**
   * Attempts to create a construction site for a specified structure type (Tower or Storage)
   * within a defined rectangular area relative to a spawn.
   * It places the site at the first available position it finds.
   * @param {StructureSpawn} spawn - The reference spawn.
   * @param {number} startX - The starting X offset from the spawn.
   * @param {number} startY - The starting Y offset from the spawn.
   * @param {number} endX - The ending X offset (width of the area to check).
   * @param {number} endY - The ending Y offset (height of the area to check).
   * @param {STRUCTURE_TOWER | STRUCTURE_STORAGE} structureType - The type of structure to create.
   */
  createStructure: function (
    spawn: StructureSpawn,
    startX: number,
    startY: number,
    endX: number, // Represents width if startX is top-left
    endY: number, // Represents height if startY is top-left
    structureType: STRUCTURE_TOWER | STRUCTURE_STORAGE
  ) {
    // Iterates from startX/Y up to startX/Y + endX/Y (or down if endX/Y is negative)
    for (let dx = 0; (endX > 0 ? dx < endX : dx > endX); dx += (endX > 0 ? 1 : -1)) {
      for (let dy = 0; (endY > 0 ? dy < endY : dy > endY); dy += (endY > 0 ? 1 : -1)) {
        const x = spawn.pos.x + startX + dx;
        const y = spawn.pos.y + startY + dy;

        if (x < 0 || x > 49 || y < 0 || y > 49) continue; // Boundary check

        const lookPosItems = spawn.room.lookAt(x, y);
        let canBuild = true;
        for (const item of lookPosItems) {
            if (item.type === 'terrain' && item.terrain === 'wall') {
                canBuild = false;
                break;
            }
            if (item.type === 'structure' || item.type === 'constructionSite') {
                canBuild = false;
                break;
            }
        }

        if (canBuild) {
          console.log(`Creating ${structureType} at ${x},${y}`);
          const result = spawn.room.createConstructionSite(x, y, structureType);
          if (result === OK) {
            return; // Successfully created site, exit
          } else {
            console.log(`Failed to create ${structureType} at ${x},${y}, error: ${result}`);
            // Potentially continue to try other spots if desired, but current logic returns.
          }
        }
      }
    }
  },

  /**
   * Flattens a 2D array into a 1D array.
   * @param {any[][]} arr - The array to flatten.
   * @returns {any[]} The flattened array.
   * @deprecated _.flattenDeep from lodash is generally preferred if available and already a dependency.
   */
  flat: function (arr: any[][]): any[] { // Type hint for 2D array
    return arr.reduce((acc, val) => acc.concat(val), []);
  },

  /**
   * Manages tower actions within all rooms: attacking hostiles or repairing structures.
   * Caches repair targets to save CPU.
   */
  updateTower: function () {
    const REPAIR_CACHE_TTL = 4; // Cache repair target for 4 ticks for less frequent searches.
    const RAMPART_LOW_HP_THRESHOLD = 30000; // Specific threshold for ramparts.
    const ROAD_REPAIR_THRESHOLD_FACTOR = 0.33; // Repair roads below 33% of hitsMax.

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      const towers = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_TOWER
      }) as StructureTower[];

      if (!towers.length) continue;

      if (!Memory.structures) { // Initialize global structures memory if not present
        Memory.structures = {};
      }

      for (const tower of towers) {
        if (!Memory.structures[tower.id]) { // Initialize memory for this specific tower
          Memory.structures[tower.id] = {} as any; // Cast to any to allow adding custom properties
        }
        const towerMemory = Memory.structures[tower.id];

        // PRIORITY 1: ATTACK HOSTILES (Real-time, no caching for hostiles)
        // Consider adding a filter for non-allied players if needed.
        const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);

        if (closestHostile) {
          tower.attack(closestHostile);
          // Clear repair cache if attacking, as situation might change.
          delete towerMemory.repairTargetId;
          delete towerMemory.repairTargetTick;
          continue; // Skip to next tower if attacking this tick.
        }

        // PRIORITY 2: REPAIR STRUCTURES (with caching)
        let repairTarget: Structure | null = null;

        // Try to get from cache
        if (towerMemory.repairTargetId && Game.time < towerMemory.repairTargetTick + REPAIR_CACHE_TTL) {
          const cachedTarget = Game.getObjectById(towerMemory.repairTargetId as Id<Structure>);
          if (cachedTarget && cachedTarget.hits < cachedTarget.hitsMax) {
            // Validate if the cached target still meets repair conditions
            const isRampartLow = cachedTarget.structureType === STRUCTURE_RAMPART && cachedTarget.hits < RAMPART_LOW_HP_THRESHOLD;
            const isRoadDamaged = cachedTarget.structureType === STRUCTURE_ROAD && cachedTarget.hits < cachedTarget.hitsMax * ROAD_REPAIR_THRESHOLD_FACTOR;
            const isOtherStructure = ![STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_ROAD].includes(cachedTarget.structureType);

            if (isRampartLow || isRoadDamaged || isOtherStructure) {
              repairTarget = cachedTarget;
            } else { // Cache invalid due to specific condition no longer met
              delete towerMemory.repairTargetId;
              delete towerMemory.repairTargetTick;
            }
          } else { // Cache invalid (target gone or fully repaired)
            delete towerMemory.repairTargetId;
            delete towerMemory.repairTargetTick;
          }
        }

        // If no valid cached target, find a new one
        if (!repairTarget) {
          const newRepairTarget = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s: Structure) =>
              s.hits < s.hitsMax &&
              s.structureType !== STRUCTURE_WALL && // Standard exclusion of walls for towers
              (
                (s.structureType === STRUCTURE_RAMPART && s.hits < RAMPART_LOW_HP_THRESHOLD) ||
                (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * ROAD_REPAIR_THRESHOLD_FACTOR) ||
                (![STRUCTURE_RAMPART, STRUCTURE_ROAD].includes(s.structureType)) // Other structures not walls/ramparts/roads
              )
          });

          if (newRepairTarget) {
            repairTarget = newRepairTarget;
            towerMemory.repairTargetId = newRepairTarget.id;
            towerMemory.repairTargetTick = Game.time;
          }
        }

        // Perform repair if a target is found
        if (repairTarget) {
          tower.repair(repairTarget);
        }
      }
    }
  }
};
