import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const js=await readFile(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
const slice=(start,end)=>{
  const a=js.indexOf(start),b=js.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Functions not found: "+start+" ... "+end);
  return js.slice(a,b);
};
const extract=(start,end,returns,names,values)=>{
  const code=slice(start,end);
  return new Function(...names,code+"\nreturn "+returns+";")(...values);
};
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/[’']/g," ").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
const pm={id:"pm",name:"Plaques métalliques",source:{img:"icons/svg/item-bag.svg",
  system:{props:{H0D_Ressource_Type:"Plaque"}}}};
const genericMachineResourceByName=name=>norm(name)===norm(pm.name)?pm:null;
const randomId=()=>"entry-new";
const foundry={utils:{randomID:randomId,deepClone:obj=>structuredClone(obj)}};

const clawFn=extract("function isOrdinaryClawName","function fluidResourceFromText",
  "{isOrdinaryClawName,normalizeGenericClawLoot}",
  ["norm","genericMachineResourceByName"],[norm,genericMachineResourceByName]);
assert.equal(clawFn.isOrdinaryClawName("Griffe"),true);
assert.equal(clawFn.isOrdinaryClawName("Griffe gauche"),true);
for(const rare of ["Griffe de machine intacte","Crocs de Sawtooth","Griffe radar ELYSIUM"])
  assert.equal(clawFn.isOrdinaryClawName(rare),false,rare);

const oldLoot={source:{type:"machine"},items:[
  {entryId:"claw",kind:"machine-piece",name:"Griffe",quantity:1},
  {entryId:"rare",kind:"machine-piece",name:"Griffe de machine intacte",quantity:1}
]};
const migrated=clawFn.normalizeGenericClawLoot(structuredClone(oldLoot));
assert.equal(migrated.items[0].kind,"resource");
assert.equal(migrated.items[0].resourceId,"pm");
assert.equal(migrated.items[0].name,"Plaques métalliques");
assert.equal(migrated.items[1].kind,"machine-piece");
assert.deepEqual(oldLoot.items[0].kind,"machine-piece","No mutation of stored old card");

const funcs=extract("function findRecoverableMachineParts","function findDestroyedMachineParts",
  "findRecoverableMachineParts",
  ["foundry","norm","isOrdinaryClawName","genericMachineResourceByName",
    "machinePartIsChassis","machinePieceLootEntry","damagedMachineResource"],
  [foundry,norm,clawFn.isOrdinaryClawName,genericMachineResourceByName,
    ()=>false,(item)=>({kind:"machine-piece",name:item.name}),()=>pm]);
const part=(name,state="Intact",hp=10)=>({
  id:"id-"+name,name,system:{template:"H0DCompMach00001",props:{
    H0D_Composant_PV_Max:10,H0D_Composant_PV_Actuels:hp,
    H0D_Composant_Detachable:true,H0D_Composant_Recuperable:true,H0D_Composant_Etat:state
  }}
});
const found=funcs({items:[part("Griffe"),part("Griffe de machine intacte")]});
assert.equal(found[0].kind,"resource");
assert.equal(found[0].resource.name,"Plaques métalliques");
assert.equal(found[0].quantity,1);
assert.equal(found[1].kind,"machine-piece");
assert.deepEqual(funcs({items:[part("Griffe","Detruit",0)]}),[]);
assert.equal(funcs({items:[part("Griffe","Detache",0)]})[0].resource.name,"Plaques métalliques");

const player=slice("async function playerOpenTargetedLoot","async function generateControlled");
assert.match(player,/type:"carcass-open"/,"Player requests carcass through socket");
assert.doesNotMatch(player,/surfaceTokenLoot\(token\.document,loot/,
 "Player never attempts to publish GM-owned carcass loot");
const handler=slice("async function onSocketMessage","// Sérialisation sur une même carcasse");
assert.match(handler,/data\.type === "carcass-open"/);
assert.match(handler,/recipientUserId:user\.id/,"GM whispers card to actual player");
assert.match(handler,/user\.viewedScene/,"Scene access is verified");
assert.match(handler,/await getTokenLoot\(tokenDoc,\{migrate:true\}\)/,"GM uses canonical token loot");
const surface=slice("async function surfaceTokenLoot","async function createLootMessage");
assert.match(surface,/recipientUserId \|\| game\.user\.id/,"Recipient not confused with MJ");
const claim=slice("async function transferEntryToActor","async function addMachinePartToActor");
assert.match(claim,/isOrdinaryClawName\(entry\.name\)/,"Pre-existing old cards grant PM");
assert.match(claim,/addResourceToActor\(actor, pm\.id, quantity\)/);

// Ouverture réelle par le MJ, sans permission de lecture du flag Token sur le compte joueur.
const received=[];
const openSource=slice("async function openCarcassForPlayer","// Sérialisation sur une même carcasse");
const playerForOpen={id:"PLAYER",isGM:false,viewedScene:"SCENE"};
const openCarcass=new Function("game","SOCKET","resolveTokenDocument","getTokenLoot",
  "surfaceTokenLoot","console",openSource+";return openCarcassForPlayer;")(
  {users:{get:id=>id==="PLAYER"?playerForOpen:null},
    socket:{emit:(_channel,payload)=>received.push(payload)}},
  "module.h0d-loot",async()=>({uuid:"Scene.SCENE.Token.T",hidden:false,parent:{id:"SCENE"}}),
  async()=>({source:{type:"machine"},items:[{name:"Fibres synthétiques",quantity:2}]}),
  async(_token,_loot,options)=>received.push(options),{error:()=>{}}
);
await openCarcass({userId:"PLAYER",tokenUuid:"Scene.SCENE.Token.T"});
assert.equal(received.length,1);
assert.equal(received[0].recipientUserId,"PLAYER");
assert.equal(received[0].privateToUser,true);

// Le MJ peut traiter une prise issue d'une carte privée qui ne figure pas dans son cache Chat.
const claimSource=slice("async function processClaimSerialized","function claimRecord");
const notification=[];
const claimed=[];
const realLoot={lootId:"loot-1",items:[{entryId:"fiber",kind:"resource",resourceId:"fs",
  name:"Fibres synthétiques",quantity:2}],claims:[]};
const owner={name:"PJ",items:[]};
const playerUser={id:"PLAYER",isGM:false};
const socket=[];
const processClaim=new Function("game","ui","MODULE_ID","SOCKET","resolveRecipientActor",
  "actorOwnedByUser","resolveTokenDocument","getTokenLoot","migrateLoot",
  "isTransferable","transferEntryToActor","persistLoot","claimRecord","console",
  claimSource+";return processClaimSerialized;")(
    {user:{id:"GM",isGM:true},users:{get:id=>id==="PLAYER"?playerUser:null},
      messages:{get:()=>null},socket:{emit:(_channel,data)=>socket.push(data)}},
    {notifications:{info:x=>notification.push(x),warn:x=>notification.push(x)}},
    "h0d-loot","module.h0d-loot",
    async()=>owner,()=>true,async()=>({uuid:"Scene.S.Token.C"}),
    async()=>structuredClone(realLoot),()=>null,
    entry=>entry.kind==="resource",async(_actor,entry,qty)=>claimed.push([entry.name,qty]),
    async(_message,loot)=>{realLoot.items[0].quantity=loot.items[0].quantity;},
    (_user,_actor,entry,qty)=>({entryId:entry.entryId,quantity:qty}),
    {error:()=>{}}
);
await processClaim({userId:"PLAYER",tokenUuid:"Scene.S.Token.C",messageId:"private-card-not-in-gm-cache",
  lootId:"loot-1",actorId:"pj",entryId:"fiber",quantity:1});
assert.deepEqual(claimed,[["Fibres synthétiques",1]],"Player claim reaches real inventory transfer");
assert.equal(realLoot.items[0].quantity,1,"Canonical stock is decremented");
assert.equal(socket.at(-1)?.type,"claim-result");
assert.equal(socket.at(-1)?.ok,true,"Player receives success only after actual transfer");

console.log("OK : joueur -> carte MJ, PM pour griffe ordinaire et cartes anciennes, pièces rares conservées.");
