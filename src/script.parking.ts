const PARK_RANGE = 5;

// Idle creeps step off roads, construction sites and spawn access tiles onto the closest free tile
export function park(creep: Creep) {
  const spawns = creep.room.find(FIND_MY_SPAWNS);
  const nearSpawn = (px: number, py: number) =>
    spawns.some(s => Math.max(Math.abs(s.pos.x - px), Math.abs(s.pos.y - py)) <= 1);
  const onRoad = creep.pos.lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_ROAD);
  if (!onRoad && creep.pos.lookFor(LOOK_CONSTRUCTION_SITES).length === 0 && !nearSpawn(creep.pos.x, creep.pos.y)) {
    return;
  }
  const { x, y } = creep.pos;
  const taken = new Set<number>();
  const area = creep.room.lookAtArea(
    Math.max(1, y - PARK_RANGE),
    Math.max(1, x - PARK_RANGE),
    Math.min(48, y + PARK_RANGE),
    Math.min(48, x + PARK_RANGE),
    true
  );
  for (const item of area) {
    if (item.type !== LOOK_TERRAIN || item.terrain === "wall") {
      taken.add(item.y * 50 + item.x);
    }
  }
  for (let range = 1; range <= PARK_RANGE; range++) {
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const px = x + dx;
        const py = y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== range || px < 1 || px > 48 || py < 1 || py > 48) {
          continue;
        }
        if (!taken.has(py * 50 + px) && !nearSpawn(px, py)) {
          creep.moveTo(px, py);
          return;
        }
      }
    }
  }
}
