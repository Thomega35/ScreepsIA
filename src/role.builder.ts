import { CreepScript } from "script.creep";

export const roleBuilder = {
  /** @param {Creep} creep **/
  getConstructionSite: function (creep: Creep) {
    let constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
      filter: site => {
        return site.structureType === STRUCTURE_EXTENSION;
      }
    });
    if (!constructionSite) {
      constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: site => {
          return site.structureType === STRUCTURE_TOWER;
        }
      });
    }
    if (!constructionSite) {
      constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: site => {
          return site.structureType === STRUCTURE_STORAGE;
        }
      });
    }
    if (!constructionSite) {
      constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
    }
    return constructionSite;
  },
  run: function (creep: Creep) {
    if (creep.memory.working === undefined || creep.memory.working === null) {
      creep.memory.working = false;
    }

    // Go to energy gathering mode if creep is empty
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
    }

    // Go to building mode if creep is full
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
    }

    // Building mode
    if (creep.memory.working) {
      const constructionSite = roleBuilder.getConstructionSite(creep);
      if (!constructionSite) {
        creep.say("😭 No work : going kamikaze mode 💥");
        creep.suicide();
      }
      if (constructionSite && creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
        creep.moveTo(constructionSite, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
    // Energy gathering mode
    else {
      CreepScript.findEnergy(creep);
    }
  }
};
