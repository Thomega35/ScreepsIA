import { BuildScript } from "script.build";
import { CreepScript } from "script.creep";
import { ErrorMapper } from "utils/ErrorMapper";
import { ExpansionScript } from "script.expansion";
import type { RoomIntel } from "script.scouting";
import { SystemScript } from "script.system";
import { Traffic } from "utils/traffic";
import { roleBuilder } from "role.builder";
import { roleClaimer } from "role.claimer";
import { roleGrabber } from "role.grabber";
import { roleHarvester } from "role.harvester";
import { roleMiner } from "role.miner";
import { rolePioneer } from "role.pioneer";
import { roleScout } from "role.scout";
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
    // Set from the game console to draw the final base layout
    showLayout?: boolean;
    // Last seen owner of each room, used to route around other players' bases
    roomOwners?: Record<string, string>;
    // Room to claim and spot of its first spawn (alternative to the "claim" flag)
    claim?: { room: string; x: number; y: number; claimed?: boolean; claimers?: number };
    // What scouts saw in each room, used to pick the next colony
    intel?: Record<string, RoomIntel>;
    // Room a scout must look at before it can be claimed
    scoutTarget?: string;
    // Uploaded by scripts/seed-intel.mjs, merged into intel/roomOwners on the next tick
    intelImport?: { intel?: Record<string, RoomIntel>; owners?: Record<string, string | null> };
  }

  interface CreepMemory {
    role: string;
    working: boolean;
    spawnId: Id<StructureSpawn>;
    room?: string;
    sourceId?: Id<Source>;
    renewing?: boolean;
    // Expansion creeps: room to claim, and the next room on their route
    target?: string;
    nextRoom?: string;
    routeFrom?: string;
    scoutRoom?: string;
    scoutPicked?: number;
  }

  interface RoomMemory {
    anchorSpawnId?: Id<StructureSpawn>;
  }
}

// The base layout is anchored on the room's first spawn, so it stays stable when more spawns are built
function getAnchorSpawn(room: Room, spawns: StructureSpawn[]): StructureSpawn {
  const anchor = room.memory.anchorSpawnId && Game.getObjectById(room.memory.anchorSpawnId);
  if (anchor) {
    return anchor;
  }
  room.memory.anchorSpawnId = spawns[0].id;
  return spawns[0];
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
    } else if (role === "claimer") {
      roleClaimer.run(creep);
    } else if (role === "pioneer") {
      rolePioneer.run(creep);
    } else if (role === "scout") {
      roleScout.run(creep);
    }
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  const staticName = "ESCALATOR";

  SystemScript.cleanMemory();
  if (Game.time % 100 === 0) {
    Traffic.cleanup();
  }

  SystemScript.updateSafeMode();

  ExpansionScript.update();

  for (const room of Object.values(Game.rooms)) {
    const spawns = room.controller?.my ? room.find(FIND_MY_SPAWNS) : [];
    if (spawns.length === 0) {
      continue;
    }
    const anchor = getAnchorSpawn(room, spawns);

    // Spawns busy renewing a creep are left alone
    const idle = spawns.find(spawn => !spawn.spawning && !CreepScript.isRenewingAt(spawn));
    if (idle) {
      CreepScript.spawnCreeps(idle, staticName);
    }

    if (Game.time % 100 === 0) {
      BuildScript.run(anchor);
    }
    if (Game.time % 10 === 5) {
      BuildScript.updateExtensions(anchor);
    }
    if (Memory.showLayout) {
      BuildScript.drawLayout(anchor);
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
