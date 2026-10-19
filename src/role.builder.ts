import { CreepScript } from "script.creep";

const CONSTRUCTION_PRIORITY: BuildableStructureConstant[] = [
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_TOWER,
  STRUCTURE_STORAGE,
  STRUCTURE_LINK,
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD
];

// Simple builder creep
export const roleBuilder = {
  getConstructionSite(creep: Creep) {
    for (const structureType of CONSTRUCTION_PRIORITY) {
      const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: s => s.structureType === structureType
      });
      if (site) {
        return site;
      }
    }
    return creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
  },
  run(creep: Creep) {
    if (creep.memory.working === undefined || creep.memory.working === null) {
      creep.memory.working = false;
    }

    // Go to energy gathering mode if creep is empty
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    // Go to building mode if creep is full
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    // Building mode
    if (creep.memory.working) {
      const constructionSite = roleBuilder.getConstructionSite(creep);
      if (constructionSite) {
        if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSite, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else if (creep.room.controller) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    }
    // Energy gathering mode
    else {
      CreepScript.findEnergy(creep);
    }
  }
};
