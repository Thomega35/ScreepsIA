export function myUsername(): string | undefined {
  return Object.values(Game.spawns)[0]?.owner.username;
}

// Highways are never owned and are the safest roads; other players' rooms and keeper rooms are never crossed
export function routeCost(roomName: string): number {
  const owner = Memory.roomOwners?.[roomName];
  if (owner && owner !== myUsername()) {
    return Infinity;
  }
  const match = /^[WE](\d+)[NS](\d+)$/.exec(roomName);
  if (!match) {
    return Infinity;
  }
  const h = Number(match[1]) % 10;
  const v = Number(match[2]) % 10;
  if (h === 0 || v === 0) {
    return 1;
  }
  const keeper = h >= 4 && h <= 6 && v >= 4 && v <= 6 && !(h === 5 && v === 5);
  return keeper ? Infinity : 2.5;
}
