import { CreepScript } from "script.creep";

/**
 * @file Manages the behavior of upgrader creeps.
 * Upgraders are responsible for upgrading the room controller.
 * They will gather energy when empty and then proceed to upgrade.
 */

// Simple upgrader creep
export const roleUpgrader = {
  /**
   * The main run loop for the upgrader creep.
   * Manages state (working/harvesting) and performs actions (upgrade/gather energy).
   * @param {Creep} creep - The upgrader creep to run.
   */
  run: function (creep: Creep) {
    // Initialize working state if undefined, defaulting to not working (i.e., needs energy).
    if (typeof creep.memory.working === "undefined") {
      creep.memory.working = false;
    }

    // Transition to harvesting if working (upgrading) and out of energy.
    if (creep.memory.working && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      creep.memory.working = false;
      creep.say("🔄 harvest");
    }
    // Transition to working (upgrading) if harvesting and full of energy.
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      creep.say("⚡ upgrade");
    }

    // Ensure there's a controller to upgrade; if not, the creep can't perform its primary role.
    if (!creep.room.controller) {
      creep.say("❓No Ctrl!");
      // Consider moving to a different room or a designated idle spot.
      return;
    }

    // === Main Action Logic ===
    if (creep.memory.working) {
      // Creep is in "working" state (i.e., has energy and should upgrade).
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#48ff00" }, reusePath: 15 }); // Green for upgrade
      }
    }
    // Energy Gathering Logic
    else {
      // Creep is in "harvesting" state (i.e., needs energy).
      CreepScript.findEnergy(creep);
    }
  }
};
