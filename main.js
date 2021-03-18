global.roleHarvester = require('role.harvester');
global.roleUpgrader = require('role.upgrader');
global.roleUpgrader2 = require('role.upgrader2');
global.roleBuilder = require('role.builder');
global.roleHunter = require('role.hunter');
global.rolePrimihunter = require('role.primihunter');
global.roleMiner = require('role.miner');
global.roleClaimer = require('role.claimer');

var laps = 26388483;
var pix = '';
var roles = ['harvester', 'upgrader', 'builder', 'hunter', 'primihunter', 'upgrader2', 'miner', 'claimer'];

/**
 * @param {String} a a string not null
 * @returns a with a Majuscule on the first character
 */
function strUcFirst(a){return (a+'').charAt(0).toUpperCase()+a.substr(1);}

function GetCreepsByRole(role){
  var CreepList = [];
    for (var creepname in Game.creeps){
      if (Game.creeps[creepname].memory.role == role){
      CreepList.push(Game.creeps[creepname]);
    }
  }
  return CreepList
}

module.exports.loop = function () {

//VAR NAMENUMBER = RAND(0-100)
    if (Game.time - laps > 10){
        laps = Game.time;
    }
    var namenumber = (Game.time - laps);
    
//PIXELS
    if (pix != 'Pix Loading : ' + Math.trunc((Game.cpu.bucket/100)) + '%'){
        pix = 'Pix Loading : ' + Math.trunc((Game.cpu.bucket/100)) + '%';
        console.log(pix);
    }
    if(Game.cpu.bucket == 10000) {
        Game.cpu.generatePixel();
    }
    
//MEMOIRE
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Clearing non-existing creep memory:', name);
        }
    }

//UPDATE TOWERS
    for (room in Game.rooms){
        var towers = Game.rooms[room].find(FIND_STRUCTURES,{
                filter: function(object){
                    return (object.structureType === STRUCTURE_TOWER);
                }});
        //EACH TOWER
        for (tower in towers){
            var tower = towers[tower];
            //SOIN
            var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => (structure.hits < structure.hitsMax && structure.structureType != STRUCTURE_WALL)
            });
            if(closestDamagedStructure) {
                tower.repair(closestDamagedStructure);
            }else{
                var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType == STRUCTURE_WALL && structure.hits < 1000)
                });
                if (closestDamagedStructure && tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY)/3*2){
                    tower.repair(closestDamagedStructure);
                }
            }
            //ATTACK
            var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                filter: (creep) => {
                    return (!creep.name.toLowerCase().includes("scala"));
                }
            });
            if(closestHostile ) {
                tower.attack(closestHostile);
            }
        }
    }
    
//UPDATE CREEPS
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];
        var role = creep.memory.role;
        if(roles.indexOf(role) >= 0) {
            global['role' + strUcFirst(creep.memory.role) ]['run'](creep);
        }
    }
    
//CREATION CREEPS
    for (name in Game.spawns){
        spawn = Game.spawns[name];
    //COMPTE NB OF CREEPS
        var lesCreepsDeLaRoom = spawn.room.find(FIND_MY_CREEPS);
        // HELP     var roles = ['harvester', 'upgrader', 'builder', 'hunter', 'primihunter', 'upgrader2', 'miner'];
        var nbHarvester = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[0]).length;
        var nbUpgrader = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[1]).length;
        var nbBuilder = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[2]).length;
        // var nbHunter = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[3]).length;
        // var nbPrimihunter = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[4]).length;
        // var nbUpgrader2 = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[5]).length;
        var miners = lesCreepsDeLaRoom.filter(creep => creep.memory.role == roles[6]);
        var nbClaimer = GetCreepsByRole(roles[7]).length;
        var nbMiner = miners.length;
        var minebool = [false, false, false, false];
        for (name in miners){
            miner = miners[name];
            if (miner.memory.number <= 3){
                minebool[miner.memory.number] = true;
            }
        }
        var aconstruire = spawn.room.find(FIND_CONSTRUCTION_SITES);
    //Harvester de secours
        if (nbMiner == 0 && lesCreepsDeLaRoom.length > 0){
            lesCreepsDeLaRoom[0].memory.role = 'miner';
            lesCreepsDeLaRoom[0].memory.filon = 0;
        }
        if (nbHarvester == 0 && lesCreepsDeLaRoom.length > 1){
            lesCreepsDeLaRoom[1].memory.role = 'harvester';
        }

    //BUILD IF NOT ENOUGH
    
        var sources = spawn.room.find(FIND_SOURCES);
        var base = 'ESCALATOR'
        // HELP     var roles = ['harvester', 'upgrader', 'builder', 'hunter', 'primihunter', 'upgrader2', 'miner'];
        if (spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable){
            if (nbMiner < sources.length){
                var filon = 0;
                while(minebool[filon]){
                    filon = filon + 1;
                }
                spawn.spawnCreep([WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE], base + "⛏" + filon, {memory: {workoom : spawn.room, number : filon, role: roles[6]}});
            }else if (nbHarvester <3){
                spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🥡" + namenumber, {memory: {workroom : spawn.room, emptying:false, role: roles[0]}});
            }else if (nbBuilder <2 && aconstruire.length > 0){
                spawn.spawnCreep([WORK, WORK, WORK,  WORK,  CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🔨" + namenumber, {memory: {working: false, emptying:false, role: roles[2]}});
            }else if (nbUpgrader < 4){
                spawn.spawnCreep([WORK, WORK, WORK,  WORK,  WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE], base + "🛠" + namenumber, {memory: {working: false, emptying:false, role: roles[1]}});
            }else if (nbClaimer <1){
                spawn.spawnCreep([CLAIM, CLAIM, MOVE, MOVE], base + "🦺" + namenumber, {memory: {working: false, emptying:false, role: roles[7]}});
            }
        }
    }
}









