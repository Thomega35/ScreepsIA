import { CreepScript } from "script.creep";
import { SystemScript } from "script.system";

// Simple upgrader creep
export const roleUpgrader = {
  run(creep: Creep) {
    const controller = creep.room.controller;
    if (!controller) {
      return;
    }
    // Station next to the controller link (placed within 2 of the controller): refill and upgrade every tick
    const link = SystemScript.getLinks(creep.room).controller;
    if (link && (creep.store[RESOURCE_ENERGY] > 0 || link.store[RESOURCE_ENERGY] > 0)) {
      if (!creep.pos.isNearTo(link)) {
        creep.moveTo(link, { visualizePathStyle: { stroke: "#ffffff" } });
        return;
      }
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && link.store[RESOURCE_ENERGY] > 0) {
        creep.withdraw(link, RESOURCE_ENERGY);
      }
      creep.upgradeController(controller);
      return;
    }

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() <= 0) {
      creep.memory.working = true;
      creep.say("⚡ upgrade");
    }

    if (creep.memory.working) {
      if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    } else {
      CreepScript.findEnergy(creep);
    }
  }
};
