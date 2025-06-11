import { CreepScript } from "script.creep";

// Simple builder creep
export const roleBuilder = {
  CONSTRUCTION_PRIORITY: [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_TOWER,
    STRUCTURE_STORAGE,
    STRUCTURE_CONTAINER,
    STRUCTURE_ROAD,
    STRUCTURE_WALL,
    STRUCTURE_RAMPART
  ],
  getConstructionSite: function (creep: Creep): ConstructionSite | null {
    for (const structureType of this.CONSTRUCTION_PRIORITY) {
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES, {
        filter: site => site.structureType === structureType
      });
      if (constructionSite) {
        return constructionSite;
      }
    }
    // If no prioritized sites are found, try to find any other construction site.
    const anyConstructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
    return anyConstructionSite || null;
  },
  run: function (creep: Creep) {
    if (creep.memory.working === undefined || creep.memory.working === null) {
      creep.memory.working = false;
    }

    // Go to energy gathering mode if creep is empty
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }

    // Go to building mode if creep is full
    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
      creep.say("🚧 build");
    }

    // Building mode
    if (creep.memory.working) {
      const constructionSite = this.getConstructionSite(creep); // Use 'this'
      if (constructionSite) {
        if (creep.build(constructionSite) == ERR_NOT_IN_RANGE) {
          creep.moveTo(constructionSite, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else {
        // No construction sites, try to upgrade controller
        if (creep.room.controller && creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#48ff00" } }); // Green for upgrade
        } else if (creep.room.controller) {
            creep.say("⚡ upgrade");
        } else {
            creep.say("❓idle");
            // Consider a fallback like CreepScript.doNotDisturb(creep) if no controller
        }
      }
    }
    // Energy gathering mode
    else {
      CreepScript.findEnergy(creep);
    }
  }
};
