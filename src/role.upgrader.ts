import { CreepScript } from "script.creep";

export const roleUpgrader = {
  run: function (creep: Creep) {
    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.upgrading = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.upgrading && creep.store.getFreeCapacity() <= 0) {
      creep.memory.upgrading = true;
      creep.say("⚡ upgrade");
    }

    // Upgrading mode
    if (creep.memory.upgrading) {
      const controller = creep.room.controller;
      if (creep.upgradeController(controller!) == ERR_NOT_IN_RANGE) {
        creep.moveTo(controller!, { visualizePathStyle: { stroke: "#ffffff" } });
      }

      // Energy gathering mode
    } else {
      CreepScript.findEnergy(creep);
    }
  }
};
