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
      const room = spawn.room;
      const controllerLevel = room.controller!.level;
      const requiredExtensions = controllerLvlToExtensions[controllerLevel];

      let nbExtensions =
        room.find(FIND_MY_STRUCTURES, {
          filter: { structureType: STRUCTURE_EXTENSION }
        }).length +
        room.find(FIND_MY_CONSTRUCTION_SITES, {
          filter: { structureType: STRUCTURE_EXTENSION }
        }).length;

      let x = 0;
      let y = 0;
      let dx = 0;
      let dy = -1;

      console.log("nbExtensions: " + nbExtensions);

      while (nbExtensions < requiredExtensions) {
        // Place an extension construction site on even x+y coordinates
        if ((x + y) % 2 === 0) {
          const result = room.createConstructionSite(spawn.pos.x + x, spawn.pos.y + y, STRUCTURE_EXTENSION);
          if (result === OK) {
            nbExtensions++;
          }
        }

        // Change direction in the spiral pattern
        if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
          [dx, dy] = [-dy, dx];
        }

        // Move to the next position
        x += dx;
        y += dy;
      }
    }
  },
  buildRoads: function () {
    const controllerLvlToRoads: { [key: number]: number } = {
      1: 0,
      2: 0,
      3: 12,
      4: 24,
      5: 32,
      6: 32,
      7: 32,
      8: 32
    };
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName];
      const nbRoads =
        spawn.room.find(FIND_MY_STRUCTURES, {
          filter: { structureType: STRUCTURE_ROAD }
        }).length +
        spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
          filter: { structureType: STRUCTURE_ROAD }
        }).length;
      const nbStorage =
        spawn.room.find(FIND_MY_STRUCTURES, {
          filter: { structureType: STRUCTURE_STORAGE }
        }).length +
        spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
          filter: { structureType: STRUCTURE_STORAGE }
        }).length;
      if (
        spawn.room.controller &&
        (nbRoads < controllerLvlToRoads[spawn.room.controller.level] ||
          (nbStorage === 0 && spawn.room.controller.level >= 4))
      ) {
        if (spawn.room.controller.level >= 3) {
          //Roads (not before tower to repair)
          //Lvl 2
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y - 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y + 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y, STRUCTURE_ROAD);
          //Lvl 3
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y - 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y + 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y - 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y + 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y - 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y + 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y - 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y + 1, STRUCTURE_ROAD);
        }
        if (spawn.room.controller.level >= 4) {
          //Storage
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y + 5, STRUCTURE_STORAGE);
          //Roads
          //Lvl 4
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y - 3, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x, spawn.pos.y + 3, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y - 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 3, spawn.pos.y + 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y - 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 3, spawn.pos.y + 2, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y - 3, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 2, spawn.pos.y + 3, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y - 3, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 2, spawn.pos.y + 3, STRUCTURE_ROAD);
        }
        if (spawn.room.controller.level >= 5) {
          //Roads
          //Lvl 5
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y - 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y + 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y - 4, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y - 4, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 1, spawn.pos.y + 4, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x - 1, spawn.pos.y + 4, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 4, spawn.pos.y - 1, STRUCTURE_ROAD);
          spawn.room.createConstructionSite(spawn.pos.x + 4, spawn.pos.y + 1, STRUCTURE_ROAD);
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
  flat: function (arr: any[]) {
    return arr.reduce((acc, val) => acc.concat(val), []);
  },
  updateTower: function () {
    for (let room in Game.rooms) {
      let towers = Game.rooms[room].find(FIND_STRUCTURES, {
        filter: function (object) {
          return object.structureType === STRUCTURE_TOWER;
        }
      });
      //EACH TOWER
      for (let towerIndex in towers) {
        const tower = towers[towerIndex] as StructureTower;
        //ATTACK
        let closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
          filter: creep => {
            return !creep.name.toLowerCase().includes("scala");
          }
        });
        if (closestHostile) {
          tower.attack(closestHostile);
        }
        //REPAIR
        let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: structure =>
            structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_WALL && structure.hits < 30000
        });
        if (closestDamagedStructure) {
          tower.repair(closestDamagedStructure);
        } /*else{
            //REPAIR WALL
                let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_WALL && structure.hits < 1000)
                });
                if (closestDamagedStructure && tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY)/3*2){
                    tower.repair(closestDamagedStructure);
                }
            }*/
      }
    }
  }
};
