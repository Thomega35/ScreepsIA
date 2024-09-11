export const roleBuilder = {
  /** @param {Creep} creep **/
  run: function (creep: Creep) {
    if (creep.memory.building === undefined || creep.memory.building === null) {
      creep.memory.building = false;
    }

    // Go to energy gathering mode if creep is empty
    if (creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
      creep.memory.building = false;
    }

    // Go to building mode if creep is full
    if (!creep.memory.building && creep.store.getFreeCapacity() == 0) {
      creep.memory.building = true;
    }

    // Building mode
    if (creep.memory.building) {
      const construction_site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (construction_site && creep.build(construction_site) == ERR_NOT_IN_RANGE) {
        creep.moveTo(construction_site, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
    // Energy gathering mode
    else {
      roleBuilder.findEnergy(creep);
    }
  },
  findEnergy: function (creep: Creep) {
    const depots = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: structure => {
        return (structure.structureType == STRUCTURE_SPAWN || structure.structureType == STRUCTURE_STORAGE) && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
      }
    });
    if (!depots) {
      const spawn = Game.getObjectById(creep.memory.spawn?.id);
      const WaitPosition = spawn? new RoomPosition(spawn.pos.x + 10, spawn.pos.y + 10, spawn.pos.roomName) : new RoomPosition(10, 10, creep.room.name);
      creep.moveTo(WaitPosition, { visualizePathStyle: { stroke: "#ffaa00" } });
      creep.say("Au coin! 😭");
    }
    if (depots && creep.withdraw(depots, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(depots, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  }
};
module.exports = roleBuilder;
