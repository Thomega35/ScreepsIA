//TypeScript version of the role.harvester.js file

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

    if (creep.memory.upgrading) {
      const controller = creep.room.controller;
      if (creep.upgradeController(controller!) == ERR_NOT_IN_RANGE) {
        creep.moveTo(controller!, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    } else {
      const depots = creep.room.find(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType == STRUCTURE_SPAWN; /*STRUCTURE_STORAGE &&
                  structure.store.getUsedCapacity(RESOURCE_ENERGY) > 80000)*/
        }
      });
      const source = creep.pos.findClosestByRange(depots);
      if (creep.withdraw(source!, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.moveTo(source!, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      //}
    }
  }
};
