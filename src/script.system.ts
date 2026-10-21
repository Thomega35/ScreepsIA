import _ from "lodash";

// Scripts annex
const REPAIR_CACHE_TTL = 5;
export const LINK_SEND_THRESHOLD = 400;

export interface RoomLinks {
  hub?: StructureLink;
  controller?: StructureLink;
  sources: StructureLink[];
}
const linksCache = new Map<string, { tick: number; links: RoomLinks }>();
// Heap-only cache, lost on global reset (fine, it is rebuilt next tick)
const towerRepairCache = new Map<Id<StructureTower>, { targetId: Id<Structure>; tick: number }>();
const SAFE_MODE_GUARDED: string[] = [STRUCTURE_SPAWN, STRUCTURE_TOWER];

// Name-based ally whitelist is intentional: spares creeps named "*scala*" (spoofable, accepted risk)
function isAlly(creep: Creep): boolean {
  return creep.name.toLowerCase().includes("scala");
}

function needsTowerRepair(structure: Structure): boolean {
  return (
    structure.hits < structure.hitsMax &&
    structure.structureType !== STRUCTURE_WALL &&
    ((structure.structureType === STRUCTURE_RAMPART && structure.hits < 30000) ||
      (structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax / 3) ||
      (structure.structureType !== STRUCTURE_RAMPART && structure.structureType !== STRUCTURE_ROAD))
  );
}

export const SystemScript = {
  generatePixel() {
    if (Game.cpu.bucket === 10000 && Game.cpu.generatePixel() === OK) {
      console.log(`[${Game.time}] 💎 Pixel generated`);
    }
  },
  // One line per owned room
  report() {
    const creepsByRoom = _.groupBy(
      Object.values(Game.creeps),
      creep => Game.getObjectById(creep.memory.spawnId)?.room.name ?? creep.room.name
    );
    for (const room of Object.values(Game.rooms)) {
      const controller = room.controller;
      if (!controller?.my) {
        continue;
      }
      const roles = _.countBy(creepsByRoom[room.name] ?? [], creep => creep.memory.role);
      const roleInfo = Object.keys(roles)
        .sort()
        .map(role => `${role}:${roles[role]}`)
        .join(" ");
      const progress =
        controller.level < 8 ? ` ${((100 * controller.progress) / controller.progressTotal).toFixed(1)}%` : "";
      const storage = room.storage
        ? ` | storage ${Math.round(room.storage.store.getUsedCapacity(RESOURCE_ENERGY) / 1000)}k`
        : "";
      const sites = room.find(FIND_MY_CONSTRUCTION_SITES).length;
      console.log(
        `[${Game.time}] ${room.name} RCL${controller.level}${progress} | energy ${room.energyAvailable}/${room.energyCapacityAvailable}${storage} | constructions ${sites} | ${roleInfo}`
      );
    }
  },
  cleanMemory() {
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  },
  countExtensions(spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length
    );
  },
  countStorage(spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length
    );
  },
  countTowers(spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length
    );
  },
  createStructure(
    spawn: StructureSpawn,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    structureType: STRUCTURE_TOWER | STRUCTURE_STORAGE
  ) {
    const terrain = spawn.room.getTerrain();
    for (let dx = 0; endX > 0 ? dx < endX : dx > endX; dx += endX > 0 ? 1 : -1) {
      for (let dy = 0; endY > 0 ? dy < endY : dy > endY; dy += endY > 0 ? 1 : -1) {
        const x = spawn.pos.x + startX + dx;
        const y = spawn.pos.y + startY + dy;
        if (x < 2 || x > 47 || y < 2 || y > 47 || terrain.get(x, y) === TERRAIN_MASK_WALL) {
          continue;
        }
        const taken = spawn.room
          .lookAt(x, y)
          .some(o => o.type === LOOK_STRUCTURES || o.type === LOOK_CONSTRUCTION_SITES || o.type === LOOK_SOURCES);
        if (!taken && spawn.room.createConstructionSite(x, y, structureType) === OK) {
          console.log(`[${Game.time}] ${spawn.room.name} 🔨 ${structureType} site at ${x},${y}`);
          return;
        }
      }
    }
  },
  // Hub = next to storage, controller = feeds upgraders, sources = filled by miners
  getLinks(room: Room): RoomLinks {
    const cached = linksCache.get(room.name);
    if (cached && cached.tick === Game.time) {
      return cached.links;
    }
    const links: RoomLinks = { sources: [] };
    const all = room.find<StructureLink>(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_LINK
    });
    for (const link of all) {
      if (!links.hub && room.storage && link.pos.inRangeTo(room.storage, 2)) {
        links.hub = link;
      } else if (!links.controller && room.controller && link.pos.inRangeTo(room.controller, 3)) {
        links.controller = link;
      } else if (link.pos.findInRange(FIND_SOURCES, 2).length > 0) {
        links.sources.push(link);
      }
    }
    linksCache.set(room.name, { tick: Game.time, links });
    return links;
  },
  updateLinks() {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.controller?.my) {
        continue;
      }
      const { hub, controller, sources } = SystemScript.getLinks(room);
      let controllerFree = controller ? controller.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
      let hubFree = hub ? hub.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
      for (const link of sources) {
        const energy = link.store.getUsedCapacity(RESOURCE_ENERGY);
        if (link.cooldown > 0 || energy < LINK_SEND_THRESHOLD) {
          continue;
        }
        if (controller && controllerFree >= LINK_SEND_THRESHOLD) {
          const amount = Math.min(energy, controllerFree);
          if (link.transferEnergy(controller, amount) === OK) {
            controllerFree -= amount;
          }
        } else if (hub && hubFree > 0) {
          const amount = Math.min(energy, hubFree);
          if (link.transferEnergy(hub, amount) === OK) {
            hubFree -= amount;
          }
        }
      }
      if (hub && controller && hub.cooldown === 0 && controllerFree >= LINK_SEND_THRESHOLD) {
        const amount = Math.min(hub.store.getUsedCapacity(RESOURCE_ENERGY), controllerFree);
        if (amount >= LINK_SEND_THRESHOLD / 2) {
          hub.transferEnergy(controller, amount);
        }
      }
    }
  },
  // Event log covers the previous tick: react to any non-ally hit on a spawn or tower
  updateSafeMode() {
    for (const room of Object.values(Game.rooms)) {
      const controller = room.controller;
      if (
        !controller?.my ||
        controller.safeMode ||
        controller.safeModeCooldown ||
        controller.upgradeBlocked ||
        controller.safeModeAvailable === 0
      ) {
        continue;
      }
      const underAttack = room.getEventLog().some(entry => {
        if (entry.event === EVENT_OBJECT_DESTROYED) {
          return SAFE_MODE_GUARDED.includes(entry.data.type);
        }
        if (entry.event !== EVENT_ATTACK) {
          return false;
        }
        const attacker = Game.getObjectById(entry.objectId as Id<Creep>);
        if (attacker instanceof Creep && (attacker.my || isAlly(attacker))) {
          return false;
        }
        const target = Game.getObjectById(entry.data.targetId as Id<Structure>);
        return target !== null && SAFE_MODE_GUARDED.includes(target.structureType);
      });
      if (underAttack) {
        const result = controller.activateSafeMode();
        console.log(
          `[${Game.time}] ${room.name} 🛡️ Spawn/tower attacked, safe mode: ${result === OK ? "activated" : result}`
        );
      }
    }
  },
  updateTower() {
    for (const room in Game.rooms) {
      const towers = Game.rooms[room].find(FIND_STRUCTURES, {
        filter(object) {
          return object.structureType === STRUCTURE_TOWER;
        }
      });
      // EACH TOWER
      for (const tower of towers) {
        // ATTACK
        const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
          filter: creep => !isAlly(creep)
        });
        if (closestHostile) {
          tower.attack(closestHostile);
        }
        // REPAIR
        const cached = towerRepairCache.get(tower.id);
        let target = cached && Game.time - cached.tick < REPAIR_CACHE_TTL ? Game.getObjectById(cached.targetId) : null;
        if (!target || !needsTowerRepair(target)) {
          target = tower.pos.findClosestByRange(FIND_STRUCTURES, { filter: needsTowerRepair });
          if (target) {
            towerRepairCache.set(tower.id, { targetId: target.id, tick: Game.time });
          }
        }
        if (target) {
          tower.repair(target);
        }
      }
    }
  }
};
