import { SystemScript } from "script.system";

export const CreepScript = {
  spawnHarvester: function (spawn: StructureSpawn, satic_name: string) {
    const energy_available = spawn.room.energyAvailable;
    const body_parts = SystemScript.flat(
      Array(Math.floor(energy_available / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
    ) as BodyPartConstant[];
    spawn.spawnCreep(body_parts, `${satic_name}☄${Game.time}`, {
      memory: { room: spawn.room, role: "harvester", working: false, spawn: spawn }
    });
  },

  spawnMiner: function (spawn: StructureSpawn, satic_name: string, sources: Source[]) {
    const energy_available = spawn.room.energyAvailable;
    spawn.memory.next_miner_spawn_source =
      spawn.memory.next_miner_spawn_source !== undefined && spawn.memory.next_miner_spawn_source !== null
        ? (spawn.memory.next_miner_spawn_source + 1) % sources.length
        : 0;
    const body_parts = SystemScript.flat(
      Array(Math.floor(energy_available / 250)).fill([WORK, WORK, MOVE]) as string[]
    ) as BodyPartConstant[];
    spawn.spawnCreep(body_parts, `${satic_name}⛏${Game.time}`, {
      memory: {
        room: spawn.room,
        role: "miner",
        working: false,
        source: sources[spawn.memory.next_miner_spawn_source],
        spawn: spawn
      }
    });
  },
  spawnGrabber: function (spawn: StructureSpawn, satic_name: string) {
    const energy_available = spawn.room.energyAvailable;
    const body_parts = SystemScript.flat(
      Array(Math.floor(energy_available / 100)).fill([MOVE, CARRY]) as string[]
    ) as BodyPartConstant[];
    spawn.spawnCreep(body_parts, `${satic_name}🤲${Game.time}`, {
      memory: { room: spawn.room, role: "grabber", working: false, spawn: spawn }
    });
  },
  spawnUpgrader: function (spawn: StructureSpawn, satic_name: string) {
    const energy_available = spawn.room.energyAvailable;
    const body_parts = SystemScript.flat(
      Array(Math.floor(energy_available / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
    ) as BodyPartConstant[];
    spawn.spawnCreep(body_parts, `${satic_name}🛠${Game.time}`, {
      memory: { room: spawn.room, role: "upgrader", working: false, upgrading: false, spawn: spawn }
    });
  },

  spawnBuilder: function (spawn: StructureSpawn, satic_name: string) {
    const energy_available = spawn.room.energyAvailable;
    const body_parts = SystemScript.flat(
      Array(Math.floor(energy_available / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
    ) as BodyPartConstant[];
    spawn.spawnCreep(body_parts, `${satic_name}🏗${Game.time}`, {
      memory: { room: spawn.room, role: "builder", working: false, building: false, spawn: spawn }
    });
  },
  spawnCreeps: function (spawn: StructureSpawn, satic_name: string) {
    const sources = spawn.room.find(FIND_SOURCES);
    const energy_available = spawn.room.energyAvailable;
    const energy_capacity = spawn.room.energyCapacityAvailable;
    const creepsByRole = _.groupBy(Object.values(Game.creeps), creep => creep.memory.role);

    if (spawn.spawning !== null) {
      return;
    }
    const harvesters = creepsByRole["harvester"] || [];
    const miners = creepsByRole["miner"] || [];
    const grabbers = creepsByRole["grabber"] || [];
    const upgraders = creepsByRole["upgrader"] || [];
    const builders = creepsByRole["builder"] || [];

    // Spawn Harvester
    if ((miners.length == 0 || grabbers.length == 0) && energy_available >= 300 && harvesters.length < 2) {
      CreepScript.spawnHarvester(spawn, satic_name);
    } else if (energy_available === energy_capacity) {
      // Spawn Miner
      if (miners.length <= grabbers.length && miners.length < 3) {
        CreepScript.spawnMiner(spawn, satic_name, sources);
        // Spawn Grabber
      } else if (grabbers.length < 3) {
        CreepScript.spawnGrabber(spawn, satic_name);
        // Spawn Upgrader
      } else if (upgraders.length < 6) {
        CreepScript.spawnUpgrader(spawn, satic_name);
      } else if (spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0 && builders.length < 3) {
        CreepScript.spawnBuilder(spawn, satic_name);
      }
    }
  },
  findEnergy: function (creep: Creep) {
    // First, try to findthe closest storage
    let depots = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
      filter: structure => {
        return structure.structureType == STRUCTURE_STORAGE && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
      }
    });

    // If no storage is found, try to find the closest spawn
    if (!depots) {
      depots = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: structure => {
          return structure.structureType == STRUCTURE_SPAWN && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50;
        }
      });
    }

    if (!depots) {
      const spawn = Game.getObjectById(creep.memory.spawn?.id);
      const WaitPosition = spawn
        ? new RoomPosition(spawn.pos.x + 10, spawn.pos.y + 10, spawn.pos.roomName)
        : new RoomPosition(10, 10, creep.room.name);
      creep.moveTo(WaitPosition, { visualizePathStyle: { stroke: "#ffaa00" } });
      creep.say("Au coin! 😭");
    }
    if (depots && creep.withdraw(depots, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      creep.moveTo(depots, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  }
};
