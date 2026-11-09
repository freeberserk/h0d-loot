import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const js=await readFile(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
const slice=(start,end)=>{const i=js.indexOf(start),j=js.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,"Missing section "+start);return js.slice(i,j);};
const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/[’']/g," ").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
const pm={id:"pm",name:"Plaques métalliques"};
const cell={id:"cell",name:"Cellule d’énergie faible"};
const byName=new Map([[norm(pm.name),pm],[norm(cell.name),cell]]);
const resourceByName=byName;
const genericMachineResourceByName=name=>byName.get(norm(name))??null;
const pure=slice("function isOrdinaryClawName","function fluidResourceFromText");
const {canonicalMachinePartResource}=new Function("norm","resourceByName","genericMachineResourceByName",
 pure+";return {canonicalMachinePartResource};")(norm,resourceByName,genericMachineResourceByName);
const pj={documentName:"Actor",name:"Coren Mille-Voix",system:{props:{H0D_PV_Actuels:12}},items:[]};
pj.items.find=predicate=>Array.prototype.find.call(pj.items,predicate);
const machinePiece={id:"machine-battery",name:"Batterie blanche instable",
 system:{template:"H0DCompMach00001",props:{H0D_Composant_Origine:"Glouton ELYS",
   H0D_Composant_Loot:"Cellule d’énergie faible"}}};
const machineActor={items:{get:id=>id===machinePiece.id?machinePiece:null}};
const world={actors:{contents:[machineActor]},user:{isGM:true},settings:{get:()=>true}};
const canvas={tokens:{placeables:[],controlled:[]}};
function isPlayerCharacterActor(actor){return !!actor?.system?.props?.H0D_PV_Actuels}
const sourceFn=new Function("isPlayerCharacterActor","OBJECT_TEMPLATE_ID","MODULE_ID","norm",
 "canonicalMachinePartResource","game","canvas","resourceByName",
 slice("function salvageResourceForReceivedItem","async function convertReceivedMachinePart")+
 ";return salvageResourceForReceivedItem;");
const salvageResourceForReceivedItem=sourceFn(isPlayerCharacterActor,"H0DObjTpl0000001","h0d-loot",
 norm,canonicalMachinePartResource,world,canvas,byName);
const direct={id:"direct-battery",name:"Batterie blanche instable",parent:pj,
 system:{template:"H0DCompMach00001",props:{H0D_Composant_Loot:"Cellule d’énergie faible"}}};
assert.equal(salvageResourceForReceivedItem(direct)?.id,"cell");
const old={
 id:"old-battery",name:"Batterie blanche instable",parent:pj,
 system:{template:"H0DObjTpl0000001",props:{H0D_Objet_Type:"PieceMachine",
  H0D_Objet_Origine:"Glouton ELYS",H0D_Objet_Quantite:1}},
 getFlag:(mod,key)=>mod==="h0d-loot"?({machinePart:true,sourceItemId:"machine-battery"})[key]:null
};
assert.equal(salvageResourceForReceivedItem(old)?.id,"cell",
 "Ancienne batterie physique liée à une pièce source unique identifiée.");
assert.equal(salvageResourceForReceivedItem({...old,getFlag:(_n,key)=>key==="machinePart"?true:"missing"}) ,null,
 "Sans provenance exacte, aucune transformation.");
const ambiguous={...direct,system:{template:"H0DCompMach00001",props:{H0D_Composant_Loot:"inconnue"}}};
assert.equal(salvageResourceForReceivedItem(ambiguous),null);
const noLoot={...old,getFlag:(n,key)=>key==="machinePart"?true:key==="sourceItemId"?"machine-battery":null,
 system:{...old.system,props:{...old.system.props,H0D_Objet_Origine:"Autre machine"}}};
assert.equal(salvageResourceForReceivedItem(noLoot),null,"Origine différente : ne pas deviner.");

let created=0,deleted=0,notices=[];
const convertFn=new Function("isPrimaryGM","startupStatus","salvageResourceForReceivedItem",
 "OBJECT_TEMPLATE_ID","RESOURCE_TEMPLATE_ID","MODULE_ID","addResourceToActor","ui","console",
 slice("async function convertReceivedMachinePart","async function convertExistingReceivedParts")+
 ";return convertReceivedMachinePart;");
const convertReceivedMachinePart=convertFn(
 ()=>true,{resourcesReady:true},salvageResourceForReceivedItem,"H0DObjTpl0000001",
 "H0DResTpl0000001","h0d-loot",
 async(actor,id,quantity)=>{created+=quantity;return{id:"created-"+id,delete:async()=>{created-=quantity}};},
 {notifications:{info:msg=>notices.push(msg),error:msg=>notices.push(msg)}},{error:()=>{}}
);
const component={...direct,async delete(){deleted++}};
assert.equal(await convertReceivedMachinePart(component,{automatic:true}),true);
assert.equal(created,1);assert.equal(deleted,1);
assert.match(notices[0],/Cellule d’énergie faible/);
assert.equal(await convertReceivedMachinePart(ambiguous),false,"Anomalie non définie : objet intact.");
// La conversion antérieure n'est pas lancée automatiquement sur tous les PJ.
assert.match(js,/convertExistingPieces:convertExistingReceivedParts/);
assert.match(js,/Hooks.on\("createItem",item=>\{/);
assert.match(js,/if\(!isPrimaryGM\(\)\|\|!startupStatus.resourcesReady/);
// L'API ouvre le butin sans passer par l'icône Foundry ; les sockets sont
// enregistrés AVANT les chargements de données pouvant échouer.
const ready=slice('Hooks.once("ready", async () => {','Hooks.on("renderActorSheet"');
assert.ok(ready.indexOf('game.socket.on(SOCKET,onSocketMessage)') <
 ready.indexOf('await loadLibrary()'));
assert.ok(ready.indexOf('registerContainerSupport(') <
 ready.indexOf('await loadCompendiumLibrary()'));
assert.match(ready,/game.h0dLoot=\{open:openLootForCurrentSelection/);
assert.match(ready,/diagnoseOpen:diagnosePlayerLoot/);
console.log("OK : conversion batterie/griffes sourcées, rattrapage ancien sûr, écouteurs avant chargement.");
