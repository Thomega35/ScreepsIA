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
        const miner_by_source = _.groupBy(creepsByRole[role], creep => creep.memory.source?.id);
        Object.keys(miner_by_source).forEach((source, index) => {
          minerinfo += `Source ${index}: ${miner_by_source[source].length} miners `;
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
  buildExtensions: function () {
    const controllerLvlToExtensions: { [key: number]: number } = {
      1: 0,
      2: 5,
      3: 10,
      4: 20,
      5: 30,
      6: 40,
      7: 50,
      8: 60
    };

    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName];
      const nbExtensions = spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length;
      if (spawn.room.controller && nbExtensions < controllerLvlToExtensions[spawn.room.controller.level]) {
        if (spawn.room.controller.level >= 2) {
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y + 1, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y - 1, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y + 1, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y - 1, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y, STRUCTURE_EXTENSION);
        }
        if (spawn.room.controller.level >= 3) {
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y + 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y - 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y + 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y - 2, STRUCTURE_EXTENSION);
        }
        if (spawn.room.controller.level >= 4) {
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y + 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y - 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y + 3, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y - 3, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y + 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y - 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y + 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y - 2, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y, STRUCTURE_EXTENSION);
        }
        if (spawn.room.controller.level >= 5) {
          spawn.room.createConstructionSite(spawn.pos.x + 4, spawn.pos.y, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y + 4, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y - 4, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 4, spawn.pos.y + 4, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x + 4, spawn.pos.y - 4, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y + 4, STRUCTURE_EXTENSION);
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y - 4, STRUCTURE_EXTENSION);
        }
      }
    }
  },
  buildTowers: function () {
    const controllerLvlToTowers: { [key: number]: number } = {
      3: 1,
      5: 2,
      7: 3,
      8: 6
    };
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName];
      const towers = spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_TOWER }
      });
      if (spawn.room.controller && towers.length < controllerLvlToTowers[spawn.room.controller.level]) {
        if (spawn.room.controller.level >= 3) {
          spawn.room.createConstructionSite(spawn.pos.x - 5, spawn.pos.y - 5, STRUCTURE_TOWER);
        }
        if (spawn.room.controller.level >= 5) {
          spawn.room.createConstructionSite(spawn.pos.x - 5, spawn.pos.y + 5, STRUCTURE_TOWER);
        }
      }
    }
  },
  flat : function (arr: any[]) {
    return arr.reduce((acc, val) => acc.concat(val), []);
  }
};
