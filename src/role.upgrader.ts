import { CreepScript } from "script.creep";

export const roleUpgrader = {
  run: function (creep: Creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() <= 0) {
      creep.memory.working = true;
      creep.say("⚡ upgrade");
    }

    // Upgrading mode
    if (creep.memory.working) {
      const controller = creep.room.controller;
      creep.moveTo(controller!, { visualizePathStyle: { stroke: "#ffffff" } });
      creep.upgradeController(controller!);

      // Energy gathering mode
    } else {
      CreepScript.findEnergy(creep);
    }
  }
};
