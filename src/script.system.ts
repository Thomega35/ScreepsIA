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
  buildExtensions: function (spawn: StructureSpawn) {
    const requiredExtensions = controllerLvlToExtensions[spawn.room.controller?.level ?? 0];

    let nbExtensions = SystemScript.countExtensions(spawn);

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
  buildRoadAroundlistElement: function (extensions: AnyOwnedStructure[] | ConstructionSite[]) {
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
  buildBaseRoads: function (spawn: StructureSpawn) {
    //Roads (not before tower to repair)
    if (!spawn.room.controller || spawn.room.controller.level < 3) {
      return;
    }
    //Roads around extensions
    const extensions = spawn.room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });
    SystemScript.buildRoadAroundlistElement(extensions);
    //Roads around extensions construction sites
    const extentionsConstructionSites = spawn.room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });
    SystemScript.buildRoadAroundlistElement(extentionsConstructionSites);
    if (spawn.room.controller.level < 4) {
      return;
    }
    //Storage
    spawn.room.createConstructionSite(spawn.pos.x - 4, spawn.pos.y + 5, STRUCTURE_STORAGE);
  },
  buildUpgradeRoads: function (spawn: StructureSpawn) {
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
    }
    const controller = spawn.room.controller;
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
  },
  buildMinerRoads: function (spawn: StructureSpawn) {
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
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
  buildTowerRoads: function (spawn: StructureSpawn) {
    if (spawn.room.controller && spawn.room.controller.level < 4) {
      return;
    }
    const towers = spawn.room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_TOWER }
    });
    for (const tower of towers) {
      const path = spawn.pos.findPathTo(tower.pos, { ignoreCreeps: true });
      for (const point of path) {
        if (
          spawn.room.lookAt(point.x, point.y)[0].terrain !== "wall" &&
          //More than 3 tiles from spawn
          (point.x < spawn.pos.x - 3 ||
            point.x > spawn.pos.x + 3 ||
            point.y < spawn.pos.y - 3 ||
            point.y > spawn.pos.y + 3) &&
          (point.x !== tower.pos.x || point.y !== tower.pos.y)
        ) {
          spawn.room.createConstructionSite(point.x, point.y, STRUCTURE_ROAD);
        }
      }
    }
  },
  buildTowers: function (spawn: StructureSpawn) {
    const nbTowers = SystemScript.countTowers(spawn);
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
    }
    if (nbTowers === 0) {
      SystemScript.createTower(spawn, -5, -5, -10, -10);
    }
    if (spawn.room.controller.level < 5) {
      return;
    }
    if (nbTowers === 1) {
      SystemScript.createTower(spawn, 5, -5, 10, -10);
    }
    if (spawn.room.controller.level < 7) {
      return;
    }
    if (nbTowers === 2) {
      SystemScript.createTower(spawn, -5, 5, -10, 10);
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
  createTower: function (spawn: StructureSpawn, startX: number, startY: number, endX: number, endY: number) {
    for (let dx = startX; dx > endX; dx--) {
      for (let dy = startY; dy > endY; dy--) {
        const lookPos = spawn.room.lookAt(spawn.pos.x + dx, spawn.pos.y + dy)[0];
        if (lookPos.terrain !== "wall" && lookPos.type !== "structure") {
          console.log("Creating tower at", spawn.pos.x + dx, spawn.pos.y + dy);
          spawn.room.createConstructionSite(spawn.pos.x + dx, spawn.pos.y + dy, STRUCTURE_TOWER);
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
