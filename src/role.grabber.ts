import { CreepScript } from "script.creep";
import _ from "lodash";

// Complex energy grabber creep (need miner to work)
export const roleGrabber = {
  pickup: function (creep: Creep) {
    let roomObject: Tombstone | Ruin | Resource | null = null;
    roomObject = creep.pos.findClosestByRange(FIND_RUINS, {
      filter: ruin => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    if (!roomObject) {
      roomObject = creep.pos.findClosestByRange(FIND_TOMBSTONES, {
        filter: tombstone => tombstone.store.getUsedCapacity(undefined) > 0
      });
    }
    if (!roomObject) {
      roomObject = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
        filter: resource => resource.amount > 100
      });
    }
    if (!roomObject) {
      return;
    }

    // Withdraw from the tombstone or ruin
    if (roomObject instanceof Tombstone || roomObject instanceof Ruin) {
      // Determine the first available resource type in the store
      const storedResources = _.filter(
        Object.keys(roomObject.store) as ResourceConstant[],
        resource => (roomObject.store as Store<ResourceConstant, false>)[resource] > 0 // Type assertion for store
      );

      if (storedResources.length > 0) {
        const resourceToWithdraw = storedResources[0];
        const amountAvailable = (roomObject.store as Store<ResourceConstant, false>)[resourceToWithdraw]; // Type assertion for store

        const withdrawResult = creep.withdraw(roomObject, resourceToWithdraw);

        if (withdrawResult === OK) {
          if (resourceToWithdraw === RESOURCE_ENERGY && amountAvailable > 0) {
            // console.log(`Grabber ${creep.name} picked up ${amountAvailable} energy from ${roomObject.id}`); // LOG REMOVED
          }
          // Original behavior: creep withdraws whatever storedResources[0] is.
          // Logging only happens if it's energy.
        } else if (withdrawResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(roomObject, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
      }
    }
    // Pickup from dropped resources
    else if (roomObject instanceof Resource) {
      const resourceToPickup = roomObject.resourceType;
      const amountAvailable = roomObject.amount;

      const pickupResult = creep.pickup(roomObject);

      if (pickupResult === OK) {
        if (resourceToPickup === RESOURCE_ENERGY && amountAvailable > 0) {
          // Use roomObject.id for dropped resources as they have IDs. pos is a fallback.
           // console.log(`Grabber ${creep.name} picked up ${amountAvailable} energy from ${roomObject.id}`); // LOG REMOVED
        }
        // Original behavior: creep picks up any resource type.
        // Logging only happens if it's energy.
      } else if (pickupResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(roomObject, { visualizePathStyle: { stroke: "#ffaa00" } });
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
    // If contain other resources than energy, drop them to storage
    if (roleGrabber.emptyMinerals(creep)) {
      return;
    }

    // Send energy to emptying structure
    const emptyingStructure = CreepScript.getEmptyingStructure(creep);
    if (!emptyingStructure) {
      return;
    }

    const amountToTransfer = creep.store[RESOURCE_ENERGY];
    const transferResult = creep.transfer(emptyingStructure, RESOURCE_ENERGY);
    if (transferResult == ERR_NOT_IN_RANGE) {
      creep.moveTo(emptyingStructure, { visualizePathStyle: { stroke: "#ffffff" } });
    } else if (transferResult == OK && amountToTransfer > 0) {
      // Log only if energy was transferred
       // console.log(`Grabber ${creep.name} transferred ${amountToTransfer} energy to ${emptyingStructure.id} (${emptyingStructure.structureType})`); // LOG REMOVED
    }
  }
};
