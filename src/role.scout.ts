import { ExpansionScript } from "script.expansion";
import { ScoutScript } from "script.scouting";
import { routeCost } from "script.routing";

const MAX_PICKS_PER_TICK = 5;

// One MOVE part: visits rooms around its home so their intel can be used to pick the next colony, then keeps exploring
export const roleScout = {
  run(creep: Creep) {
    const home = creep.memory.room ?? creep.room.name;
    let target = creep.memory.scoutRoom;
    const seen = target && (Memory.intel?.[target]?.time ?? -1) >= (creep.memory.scoutPicked ?? 0);
    if (!target || creep.room.name === target || seen) {
      target = undefined;
      // Rooms behind other players' bases are skipped silently instead of trying to walk there
      for (let tries = 0; tries < MAX_PICKS_PER_TICK && !target; tries++) {
        const next = ScoutScript.nextScoutRoom(home, creep.room.name);
        if (!next) {
          break;
        }
        if (
          next !== creep.room.name &&
          Game.map.findRoute(creep.room.name, next, { routeCallback: routeCost }) === ERR_NO_PATH
        ) {
          ScoutScript.markUnreachable(next);
        } else {
          target = next;
        }
      }
      creep.memory.scoutRoom = target;
      creep.memory.scoutPicked = Game.time;
      delete creep.memory.nextRoom;
      delete creep.memory.routeFrom;
      if (!target) {
        return;
      }
    }
    ExpansionScript.travelTo(creep, target);
    // travelTo clears nextRoom when no safe route exists
    if (creep.room.name !== target && !creep.memory.nextRoom) {
      ScoutScript.markUnreachable(target);
    }
  }
};
