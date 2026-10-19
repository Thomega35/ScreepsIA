import { CreepScript } from "script.creep";

// Classic autonom ressource gathering creep
export const roleHarvester = {
  run(creep: Creep) {
    const storage = creep.room.storage;
    if (storage && creep.room.energyAvailable < 300 && storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 300) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        const target = CreepScript.getEmptyingStructure(creep);
        if (target && creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      } else if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    if (creep.store.getFreeCapacity() > 0) {
      const source =
        (creep.memory.sourceId && Game.getObjectById(creep.memory.sourceId)) ||
        creep.pos.findClosestByPath(FIND_SOURCES);
      if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }

    const emptyingStructure = CreepScript.getEmptyingStructure(creep);
    if (!emptyingStructure) {
      return;
    }
    if (creep.transfer(emptyingStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(emptyingStructure, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};
