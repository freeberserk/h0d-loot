import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [main,containers]=await Promise.all([
  readFile(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8"),
  readFile(new URL("../scripts/h0d-container.js",import.meta.url),"utf8")
]);
const between=(s,a,b)=>{
 const start=s.indexOf(a),end=s.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,"Missing code section "+a);
 return s.slice(start,end);
};
const playerCode=between(main,"async function playerOpenTargetedLoot","async function generateControlled");
const emitted=[],warnings=[],infos=[],timers=[],pendingOpenRequests=new Map();
const ui={notifications:{warn:s=>warnings.push(s),info:s=>infos.push(s)}};
const doc={uuid:"Scene.SCENE.Token.MACHINE"};
const target={name:"Scrapper",document:doc,get actor(){throw Error("Lecture privée du token interdite");}};
const game={
 user:{id:"P",targets:new Set([target])},
 settings:{get:()=>true},
 socket:{emit:(_channel,event)=>emitted.push(event)}
};
const foundry={utils:{randomID:()=>String(emitted.length+1)}};
const primaryGM=()=>({id:"GM",active:true,isGM:true});
const run=new Function("game","canvas","ui","primaryGM","foundry","SOCKET","MODULE_ID",
 "pendingOpenRequests","OPEN_RESPONSE_TIMEOUT_MS","setTimeout","clearTimeout","openError",
 playerCode+";return playerOpenTargetedLoot;")(
 game,{tokens:{controlled:[]}},ui,primaryGM,foundry,"module.h0d-loot","h0d-loot",
 pendingOpenRequests,12000,fn=>{timers.push(fn);return timers.length;},()=>{},err=>{throw err;}
);
await run();
assert.equal(emitted.length,1,"Un joueur doit transmettre le token même sans lecture Actor.");
assert.equal(emitted[0].tokenUuid,doc.uuid);
assert.equal(emitted[0].type,"carcass-open");
assert.equal(emitted[0].userId,"P");
assert.ok(emitted[0].requestId);
assert.equal(pendingOpenRequests.size,1);
assert.equal(warnings.length,0);

// Un bouton répond toujours si le client MJ ne publie aucune carte.
timers[0]();
assert.equal(pendingOpenRequests.size,0);
assert.match(warnings.at(-1),/aucune réponse du client MJ/i);

// Sans cible, le module doit prévenir et ne pas envoyer de socket.
game.user.targets=new Set();
await run();
assert.match(warnings.at(-1),/cible une machine/i);
assert.equal(emitted.length,1);

// Le callback doit garder une voie d'erreur visible en cas de rejet asynchrone.
assert.match(main,/onChange: runLootButton/);
assert.match(main,/Promise\.resolve\(openLootForCurrentSelection\(\)\)\.catch\(openError\)/);

// Le MJ choisit le stock marchand ou le butin d'une machine, sans approval.
const serverCode=between(main,"async function openCarcassForPlayer","// Sérialisation sur une même carcasse");
const messages=[];
const user={id:"P",isGM:false,viewedScene:"SCENE"};
let type="machine";
const server=new Function("game","SOCKET","resolveTokenDocument","isContainerToken",
 "openMerchantForPlayerOnGM","getTokenLoot","surfaceTokenLoot","console",
 serverCode+";return openCarcassForPlayer;")(
 {users:{get:id=>id==="P"?user:null},socket:{emit:(_s,e)=>messages.push(e)}},
 "module.h0d-loot",async()=>({actor:{name:"Scrapper"},parent:{id:"SCENE"},hidden:false,uuid:doc.uuid}),
 ()=>type==="container",async()=>{messages.push({from:"merchant"});return true;},
 async()=>({items:[{name:"Fibres",quantity:2}]}),
 async(_token,_loot,options)=>messages.push({from:"machine",options}),
 {error:()=>{}}
);
await server({userId:"P",tokenUuid:doc.uuid,requestId:"A"});
assert.equal(messages[0].from,"machine");
assert.equal(messages[0].options.recipientUserId,"P");
assert.equal(messages[1].type,"carcass-open-result");
assert.equal(messages[1].ok,true);
assert.equal(messages[1].requestId,"A");
messages.length=0;type="container";
await server({userId:"P",tokenUuid:doc.uuid,requestId:"B"});
assert.equal(messages[0].from,"merchant");
assert.equal(messages[1].ok,true);
assert.equal(messages[1].requestId,"B");
assert.match(containers,/await publishCard\(tokenDoc,user\.id\);[\s\S]*?return true;/);
console.log("OK : bouton joueur, flags privés, timeout, machine, coffre, accusé MJ.");
