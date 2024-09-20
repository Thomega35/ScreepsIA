import { CreepScript } from "script.creep";

export const roleBuilder = {
  /** @param {Creep} creep **/
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
      const construction_site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (!construction_site) {
        creep.say("😭 No work : going kamikaze mode 💥");
        creep.suicide();
      }
      if (construction_site && creep.build(construction_site) == ERR_NOT_IN_RANGE) {
        creep.moveTo(construction_site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
    // Energy gathering mode
    else {
      CreepScript.findEnergy(creep);
    }
  },
};
