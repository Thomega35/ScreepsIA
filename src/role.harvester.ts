export const roleHarvester = {
  run: function (creep: Creep) {
    if (creep.store.getFreeCapacity() > 0) {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
    // Extension otherwiese tower otherwise spawn
    // First, try to find the closest extension
    let energyTank = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
      }
    });

    // If no extension is found, try to find the closest tower
    if (!energyTank) {
      energyTank = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }

    // If no tower is found, try to find the closest spawn
    if (!energyTank) {
      energyTank = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }
    if (!energyTank) {
      return;
    }
    if (creep.transfer(energyTank, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(energyTank, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};
