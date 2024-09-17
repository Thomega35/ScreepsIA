const controllerLvlToRoads: { [key: number]: number } = {
  1: 0,
  2: 0,
  3: 12,
  4: 25,
  5: 33,
  6: 33,
  7: 33,
  8: 33
};

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

const controllerLvlToTowers: { [key: number]: number } = {
  3: 1,
  5: 2,
  7: 3,
  8: 6
};

const roadLists: Map<number, [number, number][]> = new Map([
  [
    2,
    [
      [-1, 0],
      [0, -1],
      [0, 1],
      [1, 0]
    ]
  ],
  [
    3,
    [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1]
    ]
  ],
  [
    4,
    [
      [-3, 0],
      [3, 0],
      [0, -3],
      [0, 3],
      [-3, -2],
      [-3, 2],
      [3, -2],
      [3, 2],
      [-2, -3],
      [-2, 3],
      [2, -3],
      [2, 3],
      [-4, 3]
    ]
  ],
  [
    5,
    [
      [-4, -1],
      [-4, 1],
      [4, -1],
      [4, 1],
      [-1, -4],
      [-1, 4],
      [1, -4],
      [1, 4],
      [-3, 4]
    ]
  ]
]);

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
  buildExtensions: function (spawn: StructureSpawn) {
    const requiredExtensions = controllerLvlToExtensions[spawn.room.controller?.level ?? 0];

    let nbExtensions =
      spawn.room.find(FIND_MY_STRUCTURES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length +
      spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: { structureType: STRUCTURE_EXTENSION }
      }).length;

    let x = 0;
    let y = 0;
    let dx = 0;
    let dy = -1;

    while (nbExtensions < requiredExtensions) {
      // Place an extension construction site on even x+y coordinates
      if ((x + y) % 2 === 0) {
        const result = spawn.room.createConstructionSite(spawn.pos.x + x, spawn.pos.y + y, STRUCTURE_EXTENSION);
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
  },
  buildBaseRoads: function (spawn: StructureSpawn) {
    //Roads (not before tower to repair)
    if (!spawn.room.controller || spawn.room.controller.level < 3) {
      return;
    }
    for (let ctrlLvlIterator = 2; ctrlLvlIterator <= spawn.room.controller.level; ctrlLvlIterator++) {
      const roadListLvl = roadLists.get(ctrlLvlIterator);
      if (roadListLvl) {
        for (const [dx, dy] of roadListLvl) {
          if (spawn.room.lookAt(spawn.pos.x + dx, spawn.pos.y + dy)[0].terrain !== "wall")
            spawn.room.createConstructionSite(spawn.pos.x + dx, spawn.pos.y + dy, STRUCTURE_ROAD);
        }
      }
    }
    if (spawn.room.controller.level < 4) {
      return;
    }
    //Storage
    spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y + 5, STRUCTURE_STORAGE);
  },
  buildUpgradeRoads: function (spawn: StructureSpawn) {
    if (spawn.room.controller) {
      const controller = spawn.room.controller;
      if (controller.level < 4) {
        return;
      }
      const path = spawn.pos.findPathTo(controller.pos, { ignoreCreeps: true });
      for (const point of path) {
        if (
          spawn.room.lookAt(point.x, point.y)[0].terrain !== "wall" &&
          //More than 3 tiles from spawn
          (point.x < spawn.pos.x - 3 ||
            point.x > spawn.pos.x + 3 ||
            point.y < spawn.pos.y - 3 ||
            point.y > spawn.pos.y + 3) &&
          (point.x !== controller.pos.x || point.y !== controller.pos.y)
        ) {
          spawn.room.createConstructionSite(point.x, point.y, STRUCTURE_ROAD);
        }
      }
    }
  },
  buildMinerRoads: function (spawn: StructureSpawn) {
    if (spawn.room.controller) {
      if (spawn.room.controller.level < 4) {
        return;
      }
    }
    const sources = spawn.room.find(FIND_SOURCES);
    for (const source of sources) {
      const path = spawn.pos.findPathTo(source.pos, { ignoreCreeps: true });
      for (const point of path) {
        if (
          spawn.room.lookAt(point.x, point.y)[0].terrain !== "wall" &&
          //More than 3 tiles from spawn
          (point.x < spawn.pos.x - 3 ||
            point.x > spawn.pos.x + 3 ||
            point.y < spawn.pos.y - 3 ||
            point.y > spawn.pos.y + 3) &&
          (point.x !== source.pos.x || point.y !== source.pos.y)
        ) {
          spawn.room.createConstructionSite(point.x, point.y, STRUCTURE_ROAD);
        }
      }
    }
  },
  buildTowers: function (spawn: StructureSpawn) {
    const towers = spawn.room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    if (spawn.room.controller && towers.length < controllerLvlToTowers[spawn.room.controller.level]) {
      if (spawn.room.controller.level < 4) {
        return;
      }
      spawn.room.createConstructionSite(spawn.pos.x - 5, spawn.pos.y - 5, STRUCTURE_TOWER);
      if (spawn.room.controller.level < 5) {
        return;
      }
      spawn.room.createConstructionSite(spawn.pos.x - 5, spawn.pos.y + 5, STRUCTURE_TOWER);
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
        }
      }
    }
  }
};
