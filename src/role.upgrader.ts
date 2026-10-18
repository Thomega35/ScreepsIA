import { CreepScript } from "script.creep";
import { SystemScript } from "script.system";

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
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }

      // Energy gathering mode
    } else {
      const link = SystemScript.getLinks(creep.room).controller;
      if (link && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (creep.withdraw(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(link, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
      // Don't walk back to storage for a top-up while the link refills
      if (link && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        creep.memory.working = true;
        return;
      }
      CreepScript.findEnergy(creep);
    }
  }
};
