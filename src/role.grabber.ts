function pickup(creep: Creep) {
  const ruin = creep.pos.findClosestByRange(FIND_RUINS, {
    filter: ruin => {
      return ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
    }
  });
  const tombstone = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
    filter: tombstone => {
      return tombstone.store.getUsedCapacity(undefined) > 0;
    }
  });
  const dropped_ressource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: resource => {
      return resource.amount > 100;
    }
  });

  if (ruin) {
    if (creep.withdraw(ruin, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(ruin);
    }
  } else if (tombstone) {
    let stored_resources = _.filter(
      Object.keys(tombstone.store),
      resource => tombstone.store[resource as ResourceConstant] > 0
    );
    if (creep.withdraw(tombstone, stored_resources[0] as ResourceConstant) == ERR_NOT_IN_RANGE) {
      creep.moveTo(tombstone);
    }
  } else if (dropped_ressource) {
    if (creep.pickup(dropped_ressource) == ERR_NOT_IN_RANGE) {
      creep.moveTo(dropped_ressource);
    }
  }
}

export const roleGrabber = {
  run: function (creep: Creep) {
    if (creep.memory.role !== "grabber") {
      return;
    }
    if (creep.memory.working === undefined || creep.memory.working === null) {
      creep.memory.working = false;
    }
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 25) {
      creep.memory.working = false;
    }
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
      creep.memory.working = true;
    }
    if (!creep.memory.working) {
      pickup(creep);
    } else {
      // IF contain other ressources than energy, drop them to storage
      let stored_resources = _.filter(
        Object.keys(creep.store),
        resource => creep.store[resource as ResourceConstant] > 0
      );
      if (stored_resources.length > 1) {
        const storage = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
          filter: structure => {
            return structure.structureType === STRUCTURE_STORAGE;
          }
        });
        if (!storage) {
          creep.drop(stored_resources[0] as ResourceConstant);
        } else if (creep.transfer(storage, stored_resources[1] as ResourceConstant) == ERR_NOT_IN_RANGE) {
          creep.moveTo(storage);
        }
        return;
      }
      // Extension otherwiese tower otherwise spawn
      // First, try to find the closest extension
      let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return (
            structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        }
      });

      // If no extension is found, try to find the closest spawn
      if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            return structure.structureType === STRUCTURE_SPAWN && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        });
      }

      // If no spawn is found, try to find the closest tower
      if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            return (
              structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 250
            );
          }
        });
      }

      // If no tower is found, try to find the closest storage
      if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure => {
            return (
              structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            );
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
