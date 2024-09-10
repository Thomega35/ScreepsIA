import { ErrorMapper } from "utils/ErrorMapper";
import { roleHarvester } from "role.harvester";

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
    room: string;
    working: boolean;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
      [key: string]: any; // Add index signature
    }
  }
}

function cleanMemory() {
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }
}

function spawnCreeps(creepsByRole: { [role: string]: Creep[] }, satic_name: string) {
  for (const spawnName in Game.spawns) {
    const spawn = Game.spawns[spawnName];
    if (spawn.spawning === null) {
      const harvesters = creepsByRole["harvester"] || [];
      if (harvesters.length < 2) {
        spawn.spawnCreep([MOVE, WORK, WORK, CARRY], `${satic_name}☄${Game.time}`, {
          memory: { room: spawn.room.toString(), role: "harvester", working: false }
        });
      } else {
        const upgraders = creepsByRole["upgrader"] || [];
        if (upgraders.length < 1) {
          spawn.spawnCreep([WORK, CARRY, MOVE], `Upgrader${Game.time}`, {
            memory: { room: spawn.room.toString(), role: "upgrader", working: false }
          });
        }
      }
    }
  }
}

function updateCreeps(roles: string[] = ["harvester", "upgrader", "builder"]) {
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;
    // if (roles.includes(role)) {
    //   global["role." + role]["run"](creep);
    // }
    if (role === "harvester") {
      roleHarvester.run(creep);
    }
  }
}

function generatePixel() {
  let pix = "";
  if (pix != "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%") {
    pix = "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%";
    console.log(pix);
  }
  if (Game.cpu.bucket == 10000) {
    Game.cpu.generatePixel();
  }
}

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  global.harvester = require("role.harvester");
  console.log(`Current game tick is ${Game.time}`);
  const satic_name = "ESCALATOR";
  const roles = ["harvester", "upgrader", "builder"];

  cleanMemory();

  // Group creeps by role
  const creepsByRole = _.groupBy(Object.values(Game.creeps), creep => creep.memory.role);
  for (const role in creepsByRole) {
    console.log(`Role ${role}: ${creepsByRole[role].length} creeps`);
  }

  spawnCreeps(creepsByRole, satic_name);

  generatePixel();

  updateCreeps(roles);
});
