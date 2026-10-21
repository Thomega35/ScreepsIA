import { BuildScript } from "script.build";
import { CreepScript } from "script.creep";
import { ErrorMapper } from "utils/ErrorMapper";
import { SystemScript } from "script.system";
import { roleBuilder } from "role.builder";
import { roleGrabber } from "role.grabber";
import { roleHarvester } from "role.harvester";
import { roleMiner } from "role.miner";
import { roleUpgrader } from "role.upgrader";

const REPORT_INTERVAL = 20;

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
    working: boolean;
    spawnId: Id<StructureSpawn>;
    sourceId?: Id<Source>;
    renewing?: boolean;
  }

  interface SpawnMemory {
    nextMinerSpawnSource: number;
  }
}

function updateCreeps() {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (CreepScript.renew(creep)) {
      continue;
    }
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
  const staticName = "ESCALATOR";

  SystemScript.cleanMemory();

  for (const spawnName in Game.spawns) {
    const spawn = Game.spawns[spawnName];

    CreepScript.spawnCreeps(spawn, staticName);

    if (Game.time % 100 === 0) {
      BuildScript.run(spawn);
    }
  }

  updateCreeps();

  SystemScript.updateTower();

  SystemScript.updateLinks();

  SystemScript.generatePixel();

  if (Game.time % REPORT_INTERVAL === 0) {
    SystemScript.report();
  }
});

loop();
