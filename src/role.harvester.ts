export const roleHarvester = {
  run: function (creep: Creep) {
    if (creep.store.getFreeCapacity() > 0) {
      const sources = creep.room.find(FIND_SOURCES);
      if (creep.harvest(sources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    } else {
      // Extension otherwiese tower otherwise spawn
      // First, try to find the closest extension
      let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return (
            structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      });

      // If no extension is found, try to find the closest tower
      if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });
      }

      // If no tower is found, try to find the closest spawn
      if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            return structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });
      }
      if (!target) {
        return;
      }
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  }
};