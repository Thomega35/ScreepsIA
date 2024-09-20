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
  const droppedRessource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: resource => {
      return resource.amount > 100;
    }
  });

  if (ruin) {
    if (creep.withdraw(ruin, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(ruin);
    }
  } else if (tombstone) {
    let storedResources = _.filter(
      Object.keys(tombstone.store),
      resource => tombstone.store[resource as ResourceConstant] > 0
    );
    if (creep.withdraw(tombstone, storedResources[0] as ResourceConstant) == ERR_NOT_IN_RANGE) {
      creep.moveTo(tombstone);
    }
  } else if (droppedRessource) {
    if (creep.pickup(droppedRessource) == ERR_NOT_IN_RANGE) {
      creep.moveTo(droppedRessource);
    }
  }
}

export const roleGrabber = {
  getTarget: function (creep: Creep) {
    // Extension otherwiese tower otherwise spawn
    // First, try to find the closest extension
    let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: structure => {
        return structure.structureType === STRUCTURE_EXTENSION && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
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
          return structure.structureType === STRUCTURE_TOWER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 250;
        }
      });
    }

    // If no tower is found, try to find the closest storage
    if (!target) {
      target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_STORAGE && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
      });
    }
    return target;
  },
  updateWorking: function (creep: Creep) {
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
  },
  run: function (creep: Creep) {
    roleGrabber.updateWorking(creep);
    if (!creep.memory.working) {
      pickup(creep);
      return;
    }
    // IF contain other ressources than energy, drop them to storage
    let storedResources = _.filter(
      Object.keys(creep.store),
      resource => creep.store[resource as ResourceConstant] > 0
    );
    if (storedResources.length > 1) {
      const storage = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: structure => {
          return structure.structureType === STRUCTURE_STORAGE;
        }
      });
      if (!storage) {
        creep.drop(storedResources[0] as ResourceConstant);
      } else if (creep.transfer(storage, storedResources[1] as ResourceConstant) == ERR_NOT_IN_RANGE) {
        creep.moveTo(storage);
      }
      return;
    }
    const target = roleGrabber.getTarget(creep);
    if (!target) {
      return;
    }

    if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};
