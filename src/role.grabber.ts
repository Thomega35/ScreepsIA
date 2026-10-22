import { CreepScript } from "script.creep";
import { LINK_SEND_THRESHOLD, SystemScript } from "script.system";
import _ from "lodash";

// Complex energy grabber creep (need miner to work)
export const roleGrabber = {
  pickup(creep: Creep) {
    // Spawn/extensions come first so spawning never waits on scavenging
    const storage = creep.room.storage;
    if (
      storage &&
      creep.room.energyAvailable < creep.room.energyCapacityAvailable &&
      storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    ) {
      if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage);
      }
      return;
    }
    // A full hub blocks the source links and makes miners overflow on the floor, so drain it before scavenging
    if (storage) {
      const { hub, controller } = SystemScript.getLinks(creep.room);
      const controllerNeeds = controller && controller.store.getFreeCapacity(RESOURCE_ENERGY) >= LINK_SEND_THRESHOLD;
      if (hub && !controllerNeeds && hub.store.getUsedCapacity(RESOURCE_ENERGY) >= LINK_SEND_THRESHOLD / 2) {
        if (creep.withdraw(hub, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(hub);
        }
        return;
      }
    }
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
      CreepScript.park(creep);
      return;
    }
    // Withdraw from the tombstone or ruin
    if (roomObject instanceof Tombstone || roomObject instanceof Ruin) {
      const storedResources = _.filter(
        Object.keys(roomObject.store) as ResourceConstant[],
        // This assertion is unnecessary but TypeScript is not smart enough to understand it
        resource => roomObject.store[resource] > 0
      );
      if (creep.withdraw(roomObject, storedResources[0]) === ERR_NOT_IN_RANGE) {
        creep.moveTo(roomObject);
      }
    } else if (creep.pickup(roomObject) === ERR_NOT_IN_RANGE) {
      creep.moveTo(roomObject);
    }
  },
  emptyMinerals(creep: Creep): boolean {
    const storedResources = _.filter(
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
      } else if (creep.transfer(storage, storedResources[1] as ResourceConstant) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage);
      }
      return true;
    }
    return false;
  },
  updateWorking(creep: Creep) {
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
  run(creep: Creep) {
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
      CreepScript.park(creep);
      return;
    }

    if (creep.transfer(emptyingStructure, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(emptyingStructure, { visualizePathStyle: { stroke: "#ffffff" } });
    }
  }
};
