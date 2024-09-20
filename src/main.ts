import { ErrorMapper } from "utils/ErrorMapper";
import { roleHarvester } from "role.harvester";
import { roleUpgrader } from "role.upgrader";
import { roleMiner } from "role.miner";
import { roleGrabber } from "role.grabber";
import { roleBuilder } from "role.builder";
import { SystemScript } from "script.system";
import { CreepScript } from "script.creep";
import { BuildScript } from "script.build";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */
  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
  }

  interface CreepMemory {
    role: string;
    room: Room;
    working: boolean;
    spawn: StructureSpawn;
    source?: Source;
  }

  interface SpawnMemory {
    nextMinerSpawnSource: number;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
      [key: string]: any; // Add index signature
    }
  }
}

function updateCreeps() {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;
    if (role === "harvester") {
      roleHarvester.run(creep);
    } else if (role === "miner") {
      roleMiner.run(creep);
    } else if (role === "grabber") {
      roleGrabber.run(creep);
    } else if (role === "upgrader") {
      roleUpgrader.run(creep);
    } else if (role === "builder") {
      roleBuilder.run(creep);
    }
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time} ------------------------`);
  const satic_name = "ESCALATOR";

  SystemScript.cleanMemory();

  // Group creeps by role

  for (const spawnName in Game.spawns) {
    const spawn = Game.spawns[spawnName];
    console.log("Spawn: " + spawn.name);

    CreepScript.spawnCreeps(spawn, satic_name);

    if (Game.time % 100 === 0) {
      console.log("🔨Building cycle");
      // Base building
      BuildScript.buildExtensions(spawn);

      BuildScript.buildTowers(spawn);

      BuildScript.buildStorage(spawn);

      // Road building
      BuildScript.buildExtensionsRoads(spawn);

      BuildScript.buildTowerRoads(spawn);

      BuildScript.buildStorageRoads(spawn);

      // Road room
      BuildScript.buildUpgradeRoads(spawn);

      BuildScript.buildMinerRoads(spawn);
    }
  }

  updateCreeps();

  SystemScript.updateTower();

  SystemScript.generatePixel();
});

loop();
