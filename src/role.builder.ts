import { CreepScript } from "script.creep";
import { ExpansionScript } from "script.expansion";

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
    // Former pioneers of a cancelled expansion walk back home
    if (creep.memory.room && ExpansionScript.travelTo(creep, creep.memory.room)) {
      return;
    }
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
        // Can't build an obstacle under ourselves: step off the site first
        if (creep.pos.isEqualTo(constructionSite.pos)) {
          const { path } = PathFinder.search(creep.pos, { pos: constructionSite.pos, range: 1 }, { flee: true });
          if (path.length > 0) {
            creep.move(creep.pos.getDirectionTo(path[0]));
          }
        } else if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
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
