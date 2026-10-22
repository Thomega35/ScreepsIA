import { ExpansionScript } from "script.expansion";

// Walks to the target room and claims its controller
export const roleClaimer = {
  run(creep: Creep) {
    const target = creep.memory.target;
    if (!target || ExpansionScript.travelTo(creep, target)) {
      return;
    }
    const controller = creep.room.controller;
    if (!controller || controller.my) {
      return;
    }
    // Someone else's reservation must be removed before claiming
    const reservedByOther = controller.reservation && controller.reservation.username !== creep.owner.username;
    const result = reservedByOther ? creep.attackController(controller) : creep.claimController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller, { visualizePathStyle: { stroke: "#ff00ff" } });
    } else if (result !== OK && result !== ERR_TIRED) {
      creep.say(`claim ${result}`);
    }
  }
};
