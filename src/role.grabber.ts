import { CreepScript } from "script.creep";

export const roleGrabber = {
  pickup: function (creep: Creep) {
    let roomObject: Tombstone | Ruin | Resource | null = null;
    roomObject = creep.pos.findClosestByRange(FIND_RUINS, {
      filter: ruin => {
        return ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    });
    if (!roomObject) {
      roomObject = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
        filter: tombstone => {
          return tombstone.store.getUsedCapacity(undefined) > 0;
        }
      });
    }
    if (!roomObject) {
      roomObject = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
        filter: resource => {
          return resource.amount > 100;
        }
      });
    }
    if (!roomObject) {
      return;
    }
    // Pickup the resource
    if (roomObject instanceof Resource) {
      if (creep.pickup(roomObject) == ERR_NOT_IN_RANGE) {
        creep.moveTo(roomObject);
      }
      // Withdraw from the tombstone or ruin
    } else {
      let storedResources = _.filter(
        Object.keys(roomObject.store),
        resource => roomObject.store[resource as ResourceConstant] > 0
      );
      if (creep.withdraw(roomObject, storedResources[0] as ResourceConstant) == ERR_NOT_IN_RANGE) {
        creep.moveTo(roomObject);
      }
    }
  },
  emptyMinerals: function (creep: Creep): boolean {
    let storedResources = _.filter(Object.keys(creep.store), resource => creep.store[resource as ResourceConstant] > 0);
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
      return true;
    }
    return false;
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
    // Energy gathering mode
    if (!creep.memory.working) {
      roleGrabber.pickup(creep);
      return;
    }
    // If contain other ressources than energy, drop them to storage
    if (roleGrabber.emptyMinerals(creep)) {
      return;
    }

    // Send energy to emptying structure
    const emptyingStructure = CreepScript.getEmptyingStructure(creep);
    if (!emptyingStructure) {
      return;
    }

    if (creep.transfer(emptyingStructure, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(emptyingStructure, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};
