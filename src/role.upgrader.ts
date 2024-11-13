import { CreepScript } from "script.creep";

// Simple upgrader creep
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

    if (!creep.room.controller) {
      return;
    }
    // Upgrading mode
    if (creep.memory.working) {
      creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      creep.upgradeController(creep.room.controller);

      // Energy gathering mode
    } else {
      CreepScript.findEnergy(creep);
    }
  }
};
