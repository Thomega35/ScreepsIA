import { SystemScript } from "script.system";

// Scripts related with structure building
// Layout is recomputed from the current room state each cycle, so it resumes on any base at any RCL.

// Concurrent road sites per room, so roads never starve structures of the 100 sites cap
const MAX_ROAD_SITES = 10;
const EXTENSION_SEARCH_RANGE = 12;
// Roads avoid future extension slots unless the detour is really long
const EXTENSION_SLOT_ROAD_COST = 20;
const ROADS_MIN_LEVEL = 3;

interface Tile {
  x: number;
  y: number;
}

interface RoadPlan {
  tiles: number[];
  sourceStands: Map<Id<Source>, Tile>;
}

const ORTHOGONAL: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

function tileKey(x: number, y: number): number {
  return y * 50 + x;
}

function inBuildArea(x: number, y: number): boolean {
  return x >= 2 && x <= 47 && y >= 2 && y <= 47;
}

function chebyshev(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function ring(center: Tile, range: number): Tile[] {
  const tiles: Tile[] = [];
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === range) {
        tiles.push({ x: center.x + dx, y: center.y + dy });
      }
    }
  }
  return tiles;
}

function getOccupiedTiles(room: Room): Set<number> {
  const occupied = new Set<number>();
  const objects: { pos: RoomPosition }[] = [
    ...room.find(FIND_STRUCTURES),
    ...room.find(FIND_CONSTRUCTION_SITES),
    ...room.find(FIND_SOURCES),
    ...room.find(FIND_MINERALS)
  ];
  for (const object of objects) {
    occupied.add(tileKey(object.pos.x, object.pos.y));
  }
  return occupied;
}

function findMine<T extends StructureConstant>(room: Room, structureType: T): (AnyOwnedStructure | ConstructionSite)[] {
  return [
    ...room.find(FIND_MY_STRUCTURES, { filter: { structureType } }),
    ...room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType } })
  ];
}

// Checkerboard around the spawn (same parity as the historical spiral), closest rings first
function planExtensionSlots(spawn: StructureSpawn, occupied: Set<number>): Tile[] {
  const room = spawn.room;
  const terrain = room.getTerrain();
  const avoid: { pos: RoomPosition; range: number }[] = [
    ...room.find(FIND_SOURCES).map(source => ({ pos: source.pos, range: 2 })),
    ...room.find(FIND_MINERALS).map(mineral => ({ pos: mineral.pos, range: 1 }))
  ];
  if (room.controller) {
    avoid.push({ pos: room.controller.pos, range: 3 });
  }
  const storage = findMine(room, STRUCTURE_STORAGE)[0];
  if (storage) {
    avoid.push({ pos: storage.pos, range: 1 });
  }

  const slots: (Tile & { range: number; dist: number })[] = [];
  for (let dx = -EXTENSION_SEARCH_RANGE; dx <= EXTENSION_SEARCH_RANGE; dx++) {
    for (let dy = -EXTENSION_SEARCH_RANGE; dy <= EXTENSION_SEARCH_RANGE; dy++) {
      if ((dx + dy) % 2 !== 0 || (dx === 0 && dy === 0)) {
        continue;
      }
      const x = spawn.pos.x + dx;
      const y = spawn.pos.y + dy;
      if (!inBuildArea(x, y) || terrain.get(x, y) === TERRAIN_MASK_WALL || occupied.has(tileKey(x, y))) {
        continue;
      }
      if (avoid.some(a => chebyshev(a.pos, { x, y }) <= a.range)) {
        continue;
      }
      // Must touch at least one walkable road tile to be refillable
      if (!ORTHOGONAL.some(([ox, oy]) => terrain.get(x + ox, y + oy) !== TERRAIN_MASK_WALL)) {
        continue;
      }
      slots.push({ x, y, range: Math.max(Math.abs(dx), Math.abs(dy)), dist: Math.abs(dx) + Math.abs(dy) });
    }
  }
  slots.sort((a, b) => a.range - b.range || a.dist - b.dist);
  const remaining = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8] - SystemScript.countExtensions(spawn);
  return slots.slice(0, Math.max(0, remaining));
}

function planRoads(spawn: StructureSpawn, extensionSlots: Tile[]): RoadPlan {
  const room = spawn.room;
  const terrain = room.getTerrain();
  const costs = new PathFinder.CostMatrix();
  for (const slot of extensionSlots) {
    costs.set(slot.x, slot.y, EXTENSION_SLOT_ROAD_COST);
  }
  const blocking = (structureType: StructureConstant, my: boolean) =>
    structureType !== STRUCTURE_ROAD &&
    structureType !== STRUCTURE_CONTAINER &&
    !(structureType === STRUCTURE_RAMPART && my);
  for (const structure of room.find(FIND_STRUCTURES)) {
    const my = (structure as OwnedStructure).my ?? false;
    if (structure.structureType === STRUCTURE_ROAD) {
      costs.set(structure.pos.x, structure.pos.y, 1);
    } else if (blocking(structure.structureType, my)) {
      costs.set(structure.pos.x, structure.pos.y, 255);
    }
  }
  for (const site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
    if (site.structureType === STRUCTURE_ROAD) {
      costs.set(site.pos.x, site.pos.y, 1);
    } else if (blocking(site.structureType, true)) {
      costs.set(site.pos.x, site.pos.y, 255);
    }
  }
  for (const object of [...room.find(FIND_SOURCES), ...room.find(FIND_MINERALS)]) {
    costs.set(object.pos.x, object.pos.y, 255);
  }

  const origin = room.storage ? room.storage.pos : spawn.pos;
  const targets: { pos: RoomPosition; range: number; sourceId?: Id<Source> }[] = [];
  if (room.storage) {
    targets.push({ pos: spawn.pos, range: 1 });
  }
  for (const source of room.find(FIND_SOURCES)) {
    targets.push({ pos: source.pos, range: 1, sourceId: source.id });
  }
  if (room.controller) {
    targets.push({ pos: room.controller.pos, range: 3 });
  }
  for (const tower of findMine(room, STRUCTURE_TOWER)) {
    targets.push({ pos: tower.pos, range: 1 });
  }

  const tiles: number[] = [];
  const seen = new Set<number>();
  const addTile = (x: number, y: number) => {
    const key = tileKey(x, y);
    if (x >= 1 && x <= 48 && y >= 1 && y <= 48 && !seen.has(key)) {
      seen.add(key);
      tiles.push(key);
    }
  };
  const sourceStands = new Map<Id<Source>, Tile>();

  // Each path reuses previous ones (cost 1), so the network merges instead of running in parallel
  for (const target of targets) {
    const result = PathFinder.search(
      origin,
      { pos: target.pos, range: target.range },
      { plainCost: 2, swampCost: 4, maxRooms: 1, roomCallback: () => costs }
    );
    if (result.incomplete) {
      continue;
    }
    for (const pos of result.path) {
      costs.set(pos.x, pos.y, 1);
      addTile(pos.x, pos.y);
    }
    const last = result.path[result.path.length - 1];
    if (target.sourceId && last) {
      sourceStands.set(target.sourceId, { x: last.x, y: last.y });
    }
  }

  // Access roads on the checkerboard gaps around extensions
  for (const extension of findMine(room, STRUCTURE_EXTENSION)) {
    for (const [ox, oy] of ORTHOGONAL) {
      const x = extension.pos.x + ox;
      const y = extension.pos.y + oy;
      if (terrain.get(x, y) !== TERRAIN_MASK_WALL && costs.get(x, y) !== 255) {
        addTile(x, y);
      }
    }
  }

  return { tiles, sourceStands };
}

export const BuildScript = {
  run(spawn: StructureSpawn) {
    const level = spawn.room.controller?.level ?? 0;
    const occupied = getOccupiedTiles(spawn.room);
    const extensionSlots = planExtensionSlots(spawn, occupied);

    BuildScript.buildExtensions(spawn, extensionSlots, occupied);
    BuildScript.buildTowers(spawn);
    BuildScript.buildStorage(spawn);

    if (level < ROADS_MIN_LEVEL) {
      return;
    }
    const roadPlan = planRoads(spawn, extensionSlots);
    BuildScript.buildLinks(spawn, roadPlan, occupied);
    BuildScript.buildRoads(spawn.room, roadPlan);
  },
  buildExtensions(spawn: StructureSpawn, slots: Tile[], occupied: Set<number>) {
    const level = spawn.room.controller?.level ?? 0;
    let missing = (CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][level] ?? 0) - SystemScript.countExtensions(spawn);

    for (const slot of slots) {
      if (missing <= 0) {
        return;
      }
      const result = spawn.room.createConstructionSite(slot.x, slot.y, STRUCTURE_EXTENSION);
      if (result === OK) {
        missing--;
        occupied.add(tileKey(slot.x, slot.y));
      } else if (result === ERR_FULL || result === ERR_RCL_NOT_ENOUGH) {
        return;
      }
    }
  },
  // Priority: storage hub, controller, then sources (farthest first)
  buildLinks(spawn: StructureSpawn, plan: RoadPlan, occupied: Set<number>) {
    const room = spawn.room;
    const level = room.controller?.level ?? 0;
    const links = findMine(room, STRUCTURE_LINK);
    let missing = (CONTROLLER_STRUCTURES[STRUCTURE_LINK][level] ?? 0) - links.length;
    if (missing <= 0) {
      return;
    }
    const terrain = room.getTerrain();
    const roadTiles = new Set(plan.tiles);
    const hasLinkNear = (pos: RoomPosition, range: number) => links.some(link => link.pos.inRangeTo(pos, range));
    const origin = room.storage ? room.storage.pos : spawn.pos;

    const anchors: { covered: boolean; candidates: Tile[] }[] = [];
    if (room.storage) {
      anchors.push({
        covered: hasLinkNear(room.storage.pos, 2),
        candidates: [...ring(room.storage.pos, 1), ...ring(room.storage.pos, 2)]
      });
    }
    if (room.controller) {
      anchors.push({
        covered: hasLinkNear(room.controller.pos, 3),
        candidates: ring(room.controller.pos, 2).sort((a, b) => chebyshev(a, origin) - chebyshev(b, origin))
      });
    }
    const sources = room.find(FIND_SOURCES).sort((a, b) => origin.getRangeTo(b) - origin.getRangeTo(a));
    for (const source of sources) {
      const stand = plan.sourceStands.get(source.id);
      if (stand) {
        anchors.push({ covered: hasLinkNear(source.pos, 2), candidates: ring(stand, 1) });
      }
    }

    for (const anchor of anchors) {
      if (missing <= 0) {
        return;
      }
      if (anchor.covered) {
        continue;
      }
      const free = anchor.candidates.filter(
        t => inBuildArea(t.x, t.y) && terrain.get(t.x, t.y) !== TERRAIN_MASK_WALL && !occupied.has(tileKey(t.x, t.y))
      );
      const spot = free.find(t => !roadTiles.has(tileKey(t.x, t.y))) ?? free[0];
      if (!spot) {
        continue;
      }
      const result = room.createConstructionSite(spot.x, spot.y, STRUCTURE_LINK);
      if (result === OK) {
        missing--;
        occupied.add(tileKey(spot.x, spot.y));
      } else if (result === ERR_FULL) {
        return;
      }
    }
  },
  // Places road sites in plan order within budget, and drops untouched sites outside the plan
  buildRoads(room: Room, plan: RoadPlan) {
    const roads = new Set<number>();
    const blocked = new Set<number>();
    for (const structure of room.find(FIND_STRUCTURES)) {
      const key = tileKey(structure.pos.x, structure.pos.y);
      if (structure.structureType === STRUCTURE_ROAD) {
        roads.add(key);
      } else if (structure.structureType !== STRUCTURE_RAMPART && structure.structureType !== STRUCTURE_CONTAINER) {
        blocked.add(key);
      }
    }
    const roadSites = new Map<number, ConstructionSite>();
    for (const site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
      const key = tileKey(site.pos.x, site.pos.y);
      if (site.structureType === STRUCTURE_ROAD) {
        roadSites.set(key, site);
      } else {
        blocked.add(key);
      }
    }

    const planned = new Set(plan.tiles);
    for (const [key, site] of roadSites) {
      if (!planned.has(key) && site.progress === 0) {
        site.remove();
      }
    }

    let active = 0;
    for (const key of plan.tiles) {
      if (roads.has(key) || blocked.has(key)) {
        continue;
      }
      const site = roadSites.get(key);
      if (site) {
        if (active < MAX_ROAD_SITES || site.progress > 0) {
          active++;
        } else {
          site.remove();
        }
        continue;
      }
      if (active >= MAX_ROAD_SITES) {
        continue;
      }
      const result = room.createConstructionSite(key % 50, Math.floor(key / 50), STRUCTURE_ROAD);
      if (result === OK) {
        active++;
      } else if (result === ERR_FULL) {
        return;
      }
    }
  },
  buildStorage(spawn: StructureSpawn) {
    if (!spawn.room.controller || spawn.room.controller.level < 4) {
      return;
    }
    const storage = SystemScript.countStorage(spawn);
    if (storage === 0) {
      SystemScript.createStructure(spawn, -4, 5, -10, 10, STRUCTURE_STORAGE);
    }
  },
  buildTowers(spawn: StructureSpawn) {
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
  }
};
