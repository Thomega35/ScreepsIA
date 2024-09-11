import { SystemScript } from "script.system";

export const SpawnScript = {
  spawnHarvester: function (spawn: StructureSpawn, satic_name: string) {
    const energy_available = spawn.room.energyAvailable;
    const body_parts = (
      Array(Math.floor(energy_available / 250)).fill([WORK, CARRY, MOVE, MOVE]) as string[]
    ).flat() as BodyPartConstant[];
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
    const body_parts = (
      Array(Math.floor(energy_available / 150)).fill([WORK, MOVE]) as string[]
    ).flat() as BodyPartConstant[];
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
      SpawnScript.spawnHarvester(spawn, satic_name);
    } else if (energy_available === energy_capacity) {
      // Spawn Miner
      if (miners.length <= grabbers.length && miners.length < 3) {
        SpawnScript.spawnMiner(spawn, satic_name, sources);
        // Spawn Grabber
      } else if (grabbers.length < 3) {
        SpawnScript.spawnGrabber(spawn, satic_name);
        // Spawn Upgrader
      } else if (upgraders.length < 3) {
        SpawnScript.spawnUpgrader(spawn, satic_name);
      } else if (spawn.room.find(FIND_CONSTRUCTION_SITES).length > 0 && builders.length < 3) {
        SpawnScript.spawnBuilder(spawn, satic_name);
      }
    }
  }
};
