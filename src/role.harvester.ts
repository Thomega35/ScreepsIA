import { CreepScript } from "script.creep";

// Classic autonom ressource gathering creep
export const roleHarvester = {
  run: function (creep: Creep) {
    if (creep.store.getFreeCapacity() > 0) {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
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
