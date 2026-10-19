import _ from "lodash";

// Scripts annex
const REPAIR_CACHE_TTL = 5;
const LINK_SEND_THRESHOLD = 400;
let lastPixelStatus = "";

export interface RoomLinks {
  hub?: StructureLink;
  controller?: StructureLink;
  sources: StructureLink[];
}
const linksCache = new Map<string, { tick: number; links: RoomLinks }>();
// Heap-only cache, lost on global reset (fine, it is rebuilt next tick)
const towerRepairCache = new Map<Id<StructureTower>, { targetId: Id<Structure>; tick: number }>();

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
    const pixelStatus = "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%";
    if (pixelStatus !== lastPixelStatus) {
      lastPixelStatus = pixelStatus;
      console.log(pixelStatus);
    }
    if (Game.cpu.bucket === 10000) {
      Game.cpu.generatePixel();
    }
  },
  printInfo(creepsByRole: { [role: string]: Creep[] }) {
    for (const role in creepsByRole) {
      let minerinfo = "";
      if (role === "miner") {
        const minerBySource = _.groupBy(creepsByRole[role], creep => creep.memory.sourceId);
        Object.keys(minerBySource).forEach((source, index) => {
          minerinfo += `Source ${index}: ${minerBySource[source].length} miners `;
        });
      }
      console.log(`Role ${role}: ${creepsByRole[role].length} creeps ` + minerinfo);
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
          console.log(`Creating ${structureType} at ${x}, ${y}`);
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
          filter: creep => {
            return !creep.name.toLowerCase().includes("scala");
          }
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
