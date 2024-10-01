import _ from "lodash";

const around: number[][] = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0]
];

export const SystemScript = {
  generatePixel: function () {
    let pix = "";
    if (pix != "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%") {
      pix = "Pix Loading : " + Math.trunc(Game.cpu.bucket / 100) + "%";
      console.log(pix);
    }
    if (Game.cpu.bucket == 10000) {
      Game.cpu.generatePixel();
    }
  },
  printInfo: function (creepsByRole: { [role: string]: Creep[] }) {
    for (const role in creepsByRole) {
      let minerinfo = "";
      if (role === "miner") {
        const minerBySource = _.groupBy(creepsByRole[role], creep => creep.memory.source?.id);
        Object.keys(minerBySource).forEach((source, index) => {
          minerinfo += `Source ${index}: ${minerBySource[source].length} miners `;
        });
      }
      console.log(`Role ${role}: ${creepsByRole[role].length} creeps ` + minerinfo);
    }
  },
  cleanMemory: function () {
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name];
      }
    }
  },
  countExtensions: function (spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length
    );
  },
  countStorage: function (spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_STORAGE }
      }).length
    );
  },
  buildRoadAroundlistElement: function (extensions: (AnyOwnedStructure | ConstructionSite)[]) {
    for (const extension of extensions) {
      for (const pos of around) {
        if (!extension.room) {
          continue;
        }
        const lookPos = extension.room.lookAt(extension.pos.x + pos[0], extension.pos.y + pos[1])[0];
        if (lookPos.terrain !== "wall" && lookPos.type !== "structure") {
          extension.room.createConstructionSite(extension.pos.x + pos[0], extension.pos.y + pos[1], STRUCTURE_ROAD);
        }
      }
    }
  },
  countTowers: function (spawn: StructureSpawn): number {
    return (
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_TOWER }
      }).length
    );
  },
  createStructure: function (
    spawn: StructureSpawn,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    structureType: STRUCTURE_TOWER | STRUCTURE_STORAGE
  ) {
    for (let dx = 0; endX > 0 ? dx < endX : dx > endX; dx += endX > 0 ? 1 : -1) {
      for (let dy = 0; endY > 0 ? dy < endY : dy > endY; dy += endY > 0 ? 1 : -1) {
        const x = spawn.pos.x + startX + dx;
        const y = spawn.pos.y + startY + dy;
        const lookPos = spawn.room.lookAt(x, y)[0];
        if (lookPos.terrain !== "wall" && lookPos.type !== "structure") {
          console.log(`Creating ${structureType} at ${x}, ${y}`);
          spawn.room.createConstructionSite(x, y, structureType);
          return;
        }
      }
    }
  },
  flat: function (arr: any[]) {
    return arr.reduce((acc, val) => acc.concat(val), []);
  },
  updateTower: function () {
    for (let room in Game.rooms) {
      const towers = Game.rooms[room].find(FIND_STRUCTURES, {
        filter: function (object) {
          return object.structureType === STRUCTURE_TOWER;
        }
      });
      //EACH TOWER
      for (const tower of towers) {
        //ATTACK
        const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
          filter: creep => {
            return !creep.name.toLowerCase().includes("scala");
          }
        });
        if (closestHostile) {
          tower.attack(closestHostile);
        }
        //REPAIR
        const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure =>
            structure.hits < structure.hitsMax &&
            structure.structureType != STRUCTURE_WALL &&
            ((structure.structureType === STRUCTURE_RAMPART && structure.hits < 30000) ||
              (structure.structureType === STRUCTURE_ROAD && structure.hits < structure.hitsMax / 3) ||
              (structure.structureType !== STRUCTURE_RAMPART && structure.structureType !== STRUCTURE_ROAD))
        });
        if (closestDamagedStructure) {
          tower.repair(closestDamagedStructure);
        }
      }
    }
  }
};
