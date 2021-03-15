var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleUpgrader2 = require('role.upgrader2');
var roleBuilder = require('role.builder');
var roleHunter = require('role.hunter');
var rolePrimiHunter = require('role.primihunter');
var laps = 26388483;
//TODO harvester dep all
//TODO builder 1 seul reparateur

module.exports.loop = function () {
    // var tower = Game.getObjectById('TOWER_ID');
    // if(tower) {
    //     var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
    //         filter: (structure) => structure.hits < structure.hitsMax
    //     });
    //     if(closestDamagedStructure) {
    //         tower.repair(closestDamagedStructure);
    //     }

    //     var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    //     if(closestHostile) {
    //         tower.attack(closestHostile);
    //     }
    // }

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        if(creep.memory.role == 'harvester') {
            roleHarvester.run(creep);
        }
        if(creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep);
        }
        if(creep.memory.role == 'builder') {
            roleBuilder.run(creep);
        }
        if(creep.memory.role == 'hunter') {
            roleHunter.run(creep);
        }
        if(creep.memory.role == 'primihunter') {
            rolePrimiHunter.run(creep);
        }
        if(creep.memory.role == 'upgrader2'){
            roleUpgrader2.run(creep);
        }

    }

    //console.log(Game.spawns['Spawn1'].room.energyAvailable);
    var lesCreepsDeLaRoom = _.filter(Game.creeps, (creep)=>{return (creep.room.name == "E1N33")});
    // var ttlescreeps = Game.spawns['Spawn1'].room.find(FIND_MY_CREEPS);
    var nbHarvester = 0;
    var nbBuilder = 0;
    var nbUpgrader = 0;
    var nbUpgrader2 = 0;
    var nbprimihunter = 0;
    
    for (ID in lesCreepsDeLaRoom){
        if(lesCreepsDeLaRoom[ID].memory.role == 'harvester') {
            nbHarvester = nbHarvester + 1;
        }
        if(lesCreepsDeLaRoom[ID].memory.role == 'builder') {
            nbBuilder = nbBuilder + 1;
        }
        if(lesCreepsDeLaRoom[ID].memory.role == 'upgrader') {
            nbUpgrader = nbUpgrader + 1;
        }
        if(lesCreepsDeLaRoom[ID].memory.role == 'upgrader2') {
            nbUpgrader2 = nbUpgrader2 + 1;
        }
        if(lesCreepsDeLaRoom[ID].memory.role == 'primihunter') {
            nbprimihunter = nbprimihunter + 1;
        }
    }; 

    if (Game.time - laps > 100){
        laps = Game.time;
    }

    var namenumber = (Game.time - laps);

    if (nbHarvester == 0 && lesCreepsDeLaRoom.length != 0){
        lesCreepsDeLaRoom[0].memory.role = 'harvester';
    }

    if (Game.spawns['Spawn1'].room.energyAvailable >= 550){
        if (nbHarvester < 2){
            Game.spawns['Spawn1'].spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], "⛏" + namenumber, {memory: {harvesting: false, emptying:false, role: 'harvester'}});
        }else if (nbBuilder <2){
            Game.spawns['Spawn1'].spawnCreep([WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],  "🔨" + namenumber, {memory: {working: false, emptying:false, role: 'builder'}});
        }
        /*else if (nbprimihunter <1){
        //    Game.spawns['Spawn1'].spawnCreep([WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],  "🕶" + namenumber, {memory: {working: false, emptying:false, role: 'primihunter'}});
        }*/
        else if (nbUpgrader2 < 2){
            Game.spawns['Spawn1'].spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], "🛠2 " + namenumber, {memory: {working: false, emptying:false, role: 'upgrader2'}});
        }else if (nbUpgrader < 7){
            Game.spawns['Spawn1'].spawnCreep([WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE], "🛠" + namenumber, {memory: {working: false, emptying:false, role: 'upgrader'}});
        }/*else {
            Game.spawns['Spawn1'].spawnCreep([RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE], "🤺" + namenumber, {memory: {working: false, emptying:false, role: 'hunter'}});
        }*/
        
    }
}