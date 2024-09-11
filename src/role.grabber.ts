function pickup(creep: Creep) {
  const target = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: resource => {
      return resource.amount > 100;
    }
  });
  console.log("target", target);
  if (target) {
    if (creep.pickup(target) == ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
  }
}

export const roleGrabber = {
  run: function (creep: Creep) {
    if (creep.memory.role !== "grabber") {
      return;
    }
    if (creep.memory.emptying === undefined || creep.memory.emptying === null) {
      creep.memory.emptying = false;
    }
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25) {
      creep.memory.emptying = false;
    }
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
      creep.memory.emptying = true;
    }
    if (!creep.memory.emptying) {
      pickup(creep);
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

      if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  }
};
