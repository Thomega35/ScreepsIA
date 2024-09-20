import { SystemScript } from "script.system";

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

export const BuildScript = {
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
  buildStorage: function (spawn: StructureSpawn) {
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
    }
    const storage = SystemScript.countStorage(spawn);
    if (storage === 0) {
      SystemScript.createStructure(spawn, -4, 5, -10, 10, STRUCTURE_STORAGE);
    }
  },
  buildTowers: function (spawn: StructureSpawn) {
    const nbTowers = SystemScript.countTowers(spawn);
    if (!spawn.room.controller || spawn.room.controller.level < 3) {
      return;
    }
    if (nbTowers === 0) {
      SystemScript.createStructure(spawn, -5, -5, -10, -10, STRUCTURE_TOWER);
    }
    if (spawn.room.controller.level < 5) {
      return;
    }
    if (nbTowers === 1) {
      SystemScript.createStructure(spawn, 5, -5, 10, -10, STRUCTURE_TOWER);
    }
    if (spawn.room.controller.level < 7) {
      return;
    }
    if (nbTowers === 2) {
      SystemScript.createStructure(spawn, -5, 5, -10, 10, STRUCTURE_TOWER);
    }
  },
  //Roads
  buildExtensionsRoads: function (spawn: StructureSpawn) {
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
  buildStorageRoads: function (spawn: StructureSpawn) {
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
    }
    const storages = spawn.room.find(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_STORAGE }
    });
    if (!storages || storages.length === 0) {
      return;
    }
    for (const storage of storages) {
      const path = spawn.pos.findPathTo(storage.pos, { ignoreCreeps: true });
      for (const point of path) {
        if (
          spawn.room.lookAt(point.x, point.y)[0].terrain !== "wall" &&
          spawn.room.lookAt(point.x, point.y)[0].type !== "structure" &&
          //More than 3 tiles from spawn
          (point.x < spawn.pos.x - 3 ||
            point.x > spawn.pos.x + 3 ||
            point.y < spawn.pos.y - 3 ||
            point.y > spawn.pos.y + 3) &&
          (point.x !== storage.pos.x || point.y !== storage.pos.y)
        ) {
          spawn.room.createConstructionSite(point.x, point.y, STRUCTURE_ROAD);
        }
      }
    }
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
  }
};
