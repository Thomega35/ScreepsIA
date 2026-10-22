// Creeps blocking each other in a corridor never repath (other creeps are obstacles), so they deadlock.
// After STUCK_TICKS without moving, moveTo plans through creeps: two creeps walking into each other swap places.
const STUCK_TICKS = 2;

interface LastPosition {
  x: number;
  y: number;
  roomName: string;
  tick: number;
  stuck: number;
}

// Heap only: rebuilt after a global reset
const lastPositions = new Map<string, LastPosition>();

function stuckTicks(creep: Creep): number {
  const last = lastPositions.get(creep.name);
  if (last?.tick === Game.time) {
    return last.stuck;
  }
  const { x, y, roomName } = creep.pos;
  const samePlace = last && last.tick === Game.time - 1 && last.x === x && last.y === y && last.roomName === roomName;
  const stuck = samePlace && creep.fatigue === 0 ? last.stuck + 1 : 0;
  lastPositions.set(creep.name, { x, y, roomName, tick: Game.time, stuck });
  return stuck;
}

// eslint-disable-next-line @typescript-eslint/unbound-method -- re-applied with the creep as `this` below
const baseMoveTo = Creep.prototype.moveTo as (...args: unknown[]) => ScreepsReturnCode;

Creep.prototype.moveTo = function (this: Creep, ...args: unknown[]) {
  if (stuckTicks(this) >= STUCK_TICKS) {
    const optsIndex = typeof args[0] === "number" ? 2 : 1;
    args[optsIndex] = { ...(args[optsIndex] as MoveToOpts | undefined), ignoreCreeps: true, reusePath: 0 };
  }
  return baseMoveTo.apply(this, args);
} as typeof Creep.prototype.moveTo;

export const Traffic = {
  cleanup() {
    for (const name of lastPositions.keys()) {
      if (!Game.creeps[name]) {
        lastPositions.delete(name);
      }
    }
  }
};
