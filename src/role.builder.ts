import { CreepScript } from "script.creep";

export const roleBuilder = {
  /** @param {Creep} creep **/
  run: function (creep: Creep) {
    if (creep.memory.building === undefined || creep.memory.building === null) {
      creep.memory.building = false;
    }

    // Go to energy gathering mode if creep is empty
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.building = false;
    }

    // Go to building mode if creep is full
    if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
      creep.memory.building = true;
    }

    // Building mode
    if (creep.memory.building) {
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
