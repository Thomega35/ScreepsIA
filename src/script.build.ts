import { connectRoads, structure as drawStructure } from "@screepers/room-visual";
import { SystemScript } from "script.system";

// Scripts related with structure building
// Layout is recomputed from the current room state each cycle, so it resumes on any base at any RCL.

// Concurrent road sites per room, so roads never starve structures of the 100 sites cap
const MAX_ROAD_SITES = 10;
// Max distance of extensions from the base center
const LAYOUT_RADIUS = 10;
const ROADS_MIN_LEVEL = 3;
const RELOCATE_MIN_STORAGE = 50000;
const LAYOUT_DRAW_REFRESH = 50;

interface PlannedStructure {
  x: number;
  y: number;
  type: StructureConstant;
}

// Heap cache: planning the layout every tick just to draw it would waste CPU
const layoutDrawings = new Map<
  string,
  { tick: number; items: PlannedStructure[]; obsolete: { x: number; y: number }[] }
>();

interface Tile {
  x: number;
  y: number;
}

interface RoadPlan {
  tiles: number[];
  sourceStands: Map<Id<Source>, Tile>;
}

interface Slot extends Tile {
  // Layout road tile the filler stands on to refill this extension
  road: number;
}

interface BaseLayout {
  // Every candidate extension tile, best first
  slots: Slot[];
  // Layout road tree towards the spawn/storage (-1 = root)
  roadParent: Map<number, number>;
  // Tiles kept free for the spawns still to build
  reservedSpawns: Tile[];
}

function tileKey(x: number, y: number): number {
  return y * 50 + x;
}

function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
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

// Flower layout: diagonal road lines every 4 tiles (each road tile feeds 6 extensions), crossed by a spine every 8.
// Anchored on the spawn, so the spawn always has road exits.
function isLayoutRoad(spawn: StructureSpawn, x: number, y: number): boolean {
  return mod(x + y - spawn.pos.x - spawn.pos.y, 4) === 0 || mod(x - y - spawn.pos.x + spawn.pos.y, 8) === 0;
}

// Tiles nothing can be built on, except extensions and roads which the layout may move
function getBlockedTiles(room: Room): Set<number> {
  const movable: string[] = [STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_RAMPART, STRUCTURE_CONTAINER];
  const blocked = new Set<number>();
  const objects: { pos: RoomPosition }[] = [
    ...room.find(FIND_STRUCTURES).filter(s => !movable.includes(s.structureType)),
    ...room.find(FIND_CONSTRUCTION_SITES).filter(s => !movable.includes(s.structureType)),
    ...room.find(FIND_SOURCES),
    ...room.find(FIND_MINERALS)
  ];
  for (const object of objects) {
    blocked.add(tileKey(object.pos.x, object.pos.y));
  }
  return blocked;
}

// Existing storage, or the tile reserved for it: 1 tile away from the spawn, else next to it
function plannedStoragePos(spawn: StructureSpawn, blocked: Set<number>): Tile | null {
  const existing = findMine(spawn.room, STRUCTURE_STORAGE)[0];
  if (existing) {
    return existing.pos;
  }
  const terrain = spawn.room.getTerrain();
  for (const range of [2, 1]) {
    const spot = ring(spawn.pos, range).find(
      t =>
        inBuildArea(t.x, t.y) &&
        terrain.get(t.x, t.y) !== TERRAIN_MASK_WALL &&
        !isLayoutRoad(spawn, t.x, t.y) &&
        !blocked.has(tileKey(t.x, t.y))
    );
    if (spot) {
      return spot;
    }
  }
  return null;
}

// Extra spawns go around the storage (next to it first), closest to the first spawn
function plannedSpawnPositions(spawn: StructureSpawn, blocked: Set<number>, storage: Tile | null): Tile[] {
  const missing = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][8] - findMine(spawn.room, STRUCTURE_SPAWN).length;
  if (!storage || missing <= 0) {
    return [];
  }
  const terrain = spawn.room.getTerrain();
  return [1, 2]
    .flatMap(range => ring(storage, range).map(t => ({ ...t, range })))
    .filter(
      t =>
        inBuildArea(t.x, t.y) &&
        terrain.get(t.x, t.y) !== TERRAIN_MASK_WALL &&
        !isLayoutRoad(spawn, t.x, t.y) &&
        !blocked.has(tileKey(t.x, t.y))
    )
    .sort((a, b) => a.range - b.range || chebyshev(a, spawn.pos) - chebyshev(b, spawn.pos))
    .slice(0, missing);
}

function planBaseLayout(spawn: StructureSpawn): BaseLayout {
  const room = spawn.room;
  const terrain = room.getTerrain();
  const blocked = getBlockedTiles(room);
  const storage = plannedStoragePos(spawn, blocked);
  if (storage) {
    blocked.add(tileKey(storage.x, storage.y));
  }
  const reservedSpawns = plannedSpawnPositions(spawn, blocked, storage);
  for (const t of reservedSpawns) {
    blocked.add(tileKey(t.x, t.y));
  }
  const center = storage ? { x: (spawn.pos.x + storage.x) / 2, y: (spawn.pos.y + storage.y) / 2 } : spawn.pos;
  const avoid: { pos: Tile; range: number }[] = [
    ...room.find(FIND_SOURCES).map(source => ({ pos: source.pos, range: 2 })),
    ...room.find(FIND_MINERALS).map(mineral => ({ pos: mineral.pos, range: 1 }))
  ];
  if (room.controller) {
    avoid.push({ pos: room.controller.pos, range: 3 });
  }
  if (storage) {
    avoid.push({ pos: storage, range: 1 });
  }
  const usable = (x: number, y: number) =>
    x >= 1 &&
    x <= 48 &&
    y >= 1 &&
    y <= 48 &&
    terrain.get(x, y) !== TERRAIN_MASK_WALL &&
    !blocked.has(tileKey(x, y)) &&
    chebyshev({ x, y }, center) <= LAYOUT_RADIUS;

  // Only layout roads connected to the spawn/storage can serve extensions
  const roadParent = new Map<number, number>();
  const queue: Tile[] = [];
  const visit = (x: number, y: number, parent: number) => {
    const key = tileKey(x, y);
    if (!roadParent.has(key) && isLayoutRoad(spawn, x, y) && usable(x, y)) {
      roadParent.set(key, parent);
      queue.push({ x, y });
    }
  };
  for (const anchor of storage ? [spawn.pos, storage] : [spawn.pos]) {
    for (const t of ring(anchor, 1)) {
      visit(t.x, t.y, -1);
    }
  }
  // The array iterator also visits tiles pushed during the loop (BFS)
  for (const tile of queue) {
    for (const t of ring(tile, 1)) {
      visit(t.x, t.y, tileKey(tile.x, tile.y));
    }
  }

  const slots: (Slot & { range: number; dist: number })[] = [];
  const minX = Math.max(2, Math.floor(center.x - LAYOUT_RADIUS));
  const minY = Math.max(2, Math.floor(center.y - LAYOUT_RADIUS));
  for (let x = minX; x <= Math.min(47, center.x + LAYOUT_RADIUS); x++) {
    for (let y = minY; y <= Math.min(47, center.y + LAYOUT_RADIUS); y++) {
      if (isLayoutRoad(spawn, x, y) || !usable(x, y) || avoid.some(a => chebyshev(a.pos, { x, y }) <= a.range)) {
        continue;
      }
      const road = ring({ x, y }, 1).find(t => roadParent.has(tileKey(t.x, t.y)));
      if (road) {
        const range = chebyshev({ x, y }, center);
        slots.push({ x, y, road: tileKey(road.x, road.y), range, dist: (x - center.x) ** 2 + (y - center.y) ** 2 });
      }
    }
  }
  slots.sort((a, b) => a.range - b.range || a.dist - b.dist);
  return { slots, roadParent, reservedSpawns };
}

// Layout roads needed to reach the first `count` extension slots, from the spawn outwards
function layoutRoads(layout: BaseLayout, count: number): number[] {
  const roads: number[] = [];
  const seen = new Set<number>();
  for (const slot of layout.slots.slice(0, count)) {
    const branch: number[] = [];
    for (let key = slot.road; key !== -1 && !seen.has(key); key = layout.roadParent.get(key) ?? -1) {
      seen.add(key);
      branch.push(key);
    }
    roads.push(...branch.reverse());
  }
  return roads;
}

function planRoads(
  spawn: StructureSpawn,
  layout: BaseLayout,
  extensionCount = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][spawn.room.controller?.level ?? 0] ?? 0
): RoadPlan {
  const room = spawn.room;
  const costs = new PathFinder.CostMatrix();
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
  // Extension slots never get roads, even where an old road still stands
  for (const slot of layout.slots.slice(0, CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8])) {
    costs.set(slot.x, slot.y, 255);
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
  // Base roads first: they are what fillers walk on
  for (const key of layoutRoads(layout, extensionCount)) {
    costs.set(key % 50, Math.floor(key / 50), 1);
    addTile(key % 50, Math.floor(key / 50));
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

  return { tiles, sourceStands };
}

export const BuildScript = {
  run(spawn: StructureSpawn) {
    const level = spawn.room.controller?.level ?? 0;
    BuildScript.buildTowers(spawn);
    BuildScript.buildStorage(spawn);

    if (level < ROADS_MIN_LEVEL) {
      return;
    }
    const layout = planBaseLayout(spawn);
    BuildScript.buildSpawns(spawn, layout);
    const occupied = getOccupiedTiles(spawn.room);
    for (const t of layout.reservedSpawns) {
      occupied.add(tileKey(t.x, t.y));
    }
    const roadPlan = planRoads(spawn, layout);
    SystemScript.setPlannedRoads(spawn.room.name, roadPlan.tiles);
    BuildScript.buildLinks(spawn, roadPlan, occupied);
    BuildScript.buildRoads(spawn.room, roadPlan);
  },
  // Ghosts the RCL 8 layout (extensions, roads, storage, spawns) and crosses out extensions/roads outside it
  drawLayout(spawn: StructureSpawn) {
    const room = spawn.room;
    let drawing = layoutDrawings.get(room.name);
    if (!drawing || Game.time - drawing.tick >= LAYOUT_DRAW_REFRESH) {
      const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8];
      const layout = planBaseLayout(spawn);
      const items: PlannedStructure[] = [
        ...planRoads(spawn, layout, maxExtensions).tiles.map(key => ({
          x: key % 50,
          y: Math.floor(key / 50),
          type: STRUCTURE_ROAD
        })),
        ...layout.slots.slice(0, maxExtensions).map(s => ({ x: s.x, y: s.y, type: STRUCTURE_EXTENSION })),
        ...layout.reservedSpawns.map(t => ({ x: t.x, y: t.y, type: STRUCTURE_SPAWN }))
      ];
      const storage = plannedStoragePos(spawn, getBlockedTiles(room));
      if (storage) {
        items.push({ x: storage.x, y: storage.y, type: STRUCTURE_STORAGE });
      }
      const planned = new Set(items.map(i => `${i.type}${tileKey(i.x, i.y)}`));
      const obsolete = room
        .find(FIND_STRUCTURES)
        .filter(
          s =>
            (s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_ROAD) &&
            !planned.has(`${s.structureType}${tileKey(s.pos.x, s.pos.y)}`)
        )
        .map(s => ({ x: s.pos.x, y: s.pos.y }));
      drawing = { tick: Game.time, items, obsolete };
      layoutDrawings.set(room.name, drawing);
    }

    const visual = room.visual;
    for (const item of drawing.items) {
      drawStructure(visual, item.x, item.y, item.type, { opacity: 0.5 });
    }
    connectRoads(visual, { opacity: 0.5 });
    for (const t of drawing.obsolete) {
      visual.line(t.x - 0.3, t.y - 0.3, t.x + 0.3, t.y + 0.3, { color: "#ff4040" });
      visual.line(t.x - 0.3, t.y + 0.3, t.x + 0.3, t.y - 0.3, { color: "#ff4040" });
    }
    visual.text("Final layout (Memory.showLayout = false to hide)", 1, 1, { align: "left", opacity: 0.8 });
  },
  buildSpawns(spawn: StructureSpawn, layout: BaseLayout) {
    const room = spawn.room;
    const max = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][room.controller?.level ?? 0] ?? 0;
    const count = findMine(room, STRUCTURE_SPAWN).length;
    const target = layout.reservedSpawns[0];
    if (count >= max || !target) {
      return;
    }
    const inTheWay = room.lookForAt(LOOK_STRUCTURES, target.x, target.y);
    // Extensions on the tile are moved away by updateExtensions first
    if (inTheWay.some(s => s.structureType === STRUCTURE_EXTENSION)) {
      return;
    }
    const road = inTheWay.find(s => s.structureType === STRUCTURE_ROAD);
    if (road) {
      road.destroy();
      return;
    }
    room.createConstructionSite(target.x, target.y, STRUCTURE_SPAWN, `${room.name}-${count + 1}`);
  },
  // Places missing extensions on the best layout slots, then moves misplaced ones one at a time:
  // the worst-placed extension is destroyed only when every extension is built and a better slot is free.
  updateExtensions(spawn: StructureSpawn) {
    const room = spawn.room;
    const max = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller?.level ?? 0] ?? 0;
    if (max === 0 || room.find(FIND_HOSTILE_CREEPS).length > 0) {
      return;
    }
    const layout = planBaseLayout(spawn);
    const plannedKeys = new Set(layout.slots.slice(0, max).map(s => tileKey(s.x, s.y)));
    const extensions = room.find<StructureExtension>(FIND_MY_STRUCTURES, {
      filter: { structureType: STRUCTURE_EXTENSION }
    });
    const sites: ConstructionSite[] = [];
    for (const site of room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } })) {
      // Left over from an older layout
      if (!plannedKeys.has(tileKey(site.pos.x, site.pos.y)) && site.progress === 0) {
        site.remove();
      } else {
        sites.push(site);
      }
    }
    const taken = new Set([...extensions, ...sites].map(o => tileKey(o.pos.x, o.pos.y)));

    let missing = max - extensions.length - sites.length;
    for (const slot of layout.slots) {
      if (missing <= 0) {
        break;
      }
      if (taken.has(tileKey(slot.x, slot.y))) {
        continue;
      }
      missing--;
      const road = room.lookForAt(LOOK_STRUCTURES, slot.x, slot.y).find(s => s.structureType === STRUCTURE_ROAD);
      if (road) {
        // The site can only be placed once the road is gone (next update)
        road.destroy();
        continue;
      }
      if (room.createConstructionSite(slot.x, slot.y, STRUCTURE_EXTENSION) === ERR_FULL) {
        return;
      }
    }

    const storageEnergy = room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0;
    if (sites.length > 0 || extensions.length < max || storageEnergy < RELOCATE_MIN_STORAGE) {
      return;
    }
    const bestFree = layout.slots.findIndex(s => !taken.has(tileKey(s.x, s.y)));
    if (bestFree < 0) {
      return;
    }
    const rank = new Map(layout.slots.map((s, i) => [tileKey(s.x, s.y), i]));
    // Extensions on a reserved spawn tile go first, then those outside the layout
    for (const t of layout.reservedSpawns) {
      rank.set(tileKey(t.x, t.y), Infinity);
    }
    let worst: StructureExtension | undefined;
    let worstRank = -1;
    for (const extension of extensions) {
      const r = rank.get(tileKey(extension.pos.x, extension.pos.y)) ?? Number.MAX_SAFE_INTEGER;
      if (r > worstRank) {
        worst = extension;
        worstRank = r;
      }
    }
    if (worst && worstRank > bestFree && worst.destroy() === OK) {
      const target = layout.slots[bestFree];
      console.log(
        `[${Game.time}] ${room.name} 🔨 moving extension ${worst.pos.x},${worst.pos.y} -> ${target.x},${target.y}`
      );
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
    if (
      !spawn.room.controller ||
      spawn.room.controller.level < 4 ||
      findMine(spawn.room, STRUCTURE_STORAGE).length > 0
    ) {
      return;
    }
    const pos = plannedStoragePos(spawn, getBlockedTiles(spawn.room));
    if (pos) {
      spawn.room.createConstructionSite(pos.x, pos.y, STRUCTURE_STORAGE);
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
