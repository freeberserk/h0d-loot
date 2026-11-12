import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
const slice=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,"Fonctions absentes");return source.slice(i,j)};
const catalog={getStatus:()=>({ready:true})};
const resources=new Map([
 ["pm",{id:"pm",name:"Plaques métalliques"}],
 ["bad",{id:"bad",name:"Ressource inconnue"}]
]);
const catalogueApi=()=>catalog;
const resolveCatalogueResource=r=>r.name==="Plaques métalliques"
 ? {status:"canonique",key:"plaques-metalliques",definition:{kind:"resource"}}
 : {status:"missing",definition:null};
const exactRareCatalogueDefinition=key=>key==="valid-rare"?{key}:null;
const canonicalMachinePartResource=(p,name)=>p?.H0D_Composant_Loot==="Plaques métalliques"?resources.get("pm"):null;
const game={items:{get:key=>key==="objet-template"?{id:key}:null}};
const preflight=new Function("catalogueApi","game","resourceLibrary","resolveCatalogueResource",
 "exactRareCatalogueDefinition","canonicalMachinePartResource","OBJECT_TEMPLATE_ID",
 slice("function preflightBulkTransfers","async function processClaimSerialized")+
 ";return preflightBulkTransfers;")(
 catalogueApi,game,resources,resolveCatalogueResource,exactRareCatalogueDefinition,
 canonicalMachinePartResource,"objet-template");
preflight([{kind:"resource",resourceId:"pm"}]);
assert.throws(()=>preflight([{kind:"resource",resourceId:"pm"},{kind:"resource",resourceId:"bad"}]),/non référencée/);
assert.throws(()=>preflight([{kind:"catalogue-resource",catalogueKey:"missing"}]),/Référence rare absente/);
preflight([{kind:"catalogue-resource",catalogueKey:"valid-rare"}]);
preflight([{kind:"machine-piece",name:"Griffe",partProps:{H0D_Composant_Loot:"Plaques métalliques"},sourceHp:4}]);
assert.throws(()=>preflight([{kind:"embedded",name:"Sabre",sourceItemId:"absent"}],{actor:{items:{get:()=>null}}}),/source introuvable/);
const msgs=[],transfers=[],saved=[],loot={
 lootId:"loot",items:[
 {entryId:"one",kind:"resource",resourceId:"pm",name:"Plaques métalliques",quantity:2},
 {entryId:"two",kind:"resource",resourceId:"bad",name:"Ressource inconnue",quantity:1}
 ],claims:[]
};
const player={id:"P",isGM:false},actor={id:"A",name:"PJ",items:[]};
const localGame={user:{id:"GM",isGM:true},users:{get:id=>id==="P"?player:null},
 messages:{get:()=>null},socket:{emit:(_c,data)=>msgs.push(data)}};
const handler=new Function(
 "game","ui","MODULE_ID","SOCKET","resolveRecipientActor","actorOwnedByUser",
 "resolveTokenDocument","getTokenLoot","migrateLoot","isTransferable",
 "transferEntryToActor","persistLoot","claimRecord","preflightBulkTransfers","console",
 slice("async function processClaimSerialized","function claimRecord")+";return processClaimSerialized;"
)(localGame,{notifications:{}}, "h0d-loot","module.h0d-loot",
 async()=>actor,()=>true,async()=>({uuid:"Scene.S.Token.T"}),
 async()=>loot,()=>null,e=>e.kind==="resource",
 async(_actor,entry,qty)=>{transfers.push([entry.name,qty]);},
 async()=>{saved.push(loot.items.map(e=>e.quantity));},
 (_user,_actor,entry,qty)=>({entryId:entry.entryId,quantity:qty}),preflight,{error:()=>{}});
await handler({userId:"P",tokenUuid:"Scene.S.Token.T",lootId:"loot",quantity:"all-card"});
assert.equal(transfers.length,0,"Une ressource inconnue doit interdire le lot entier");
assert.equal(saved.length,0,"Aucun enregistrement ne doit être fait en préflight");
assert.equal(loot.items[0].quantity,2);
assert.equal(msgs.at(-1).ok,false);
loot.items[1]={entryId:"two",kind:"resource",resourceId:"pm",name:"Plaques métalliques",quantity:1};
await handler({userId:"P",tokenUuid:"Scene.S.Token.T",lootId:"loot",quantity:"all-card"});
assert.equal(transfers.length,2);
assert.deepEqual(saved,[[0,1],[0,0]],"Chaque ligne confirmée est sauvegardée immédiatement");
assert.equal(msgs.at(-1).ok,true);

// Régression : l'échec d'une deuxième ligne ne remet jamais la première au butin.
const partialLoot={
 lootId:"partial",items:[
  {entryId:"first",kind:"resource",resourceId:"pm",name:"Plaques métalliques",quantity:1},
  {entryId:"second",kind:"resource",resourceId:"pm",name:"Plaques métalliques",quantity:1}
 ],claims:[]
};
const partialMessages=[],partialSaved=[],partialTransfers=[];
const partialGame={...localGame,socket:{emit:(_channel,payload)=>partialMessages.push(payload)}};
const partialHandler=new Function(
 "game","ui","MODULE_ID","SOCKET","resolveRecipientActor","actorOwnedByUser",
 "resolveTokenDocument","getTokenLoot","migrateLoot","isTransferable",
 "transferEntryToActor","persistLoot","claimRecord","preflightBulkTransfers","console",
 slice("async function processClaimSerialized","function claimRecord")+";return processClaimSerialized;"
)(partialGame,{notifications:{}},"h0d-loot","module.h0d-loot",
 async()=>actor,()=>true,async()=>({uuid:"Scene.S.Token.T"}),
 async()=>partialLoot,()=>null,e=>e.kind==="resource",
 async(_actor,entry,qty)=>{
  if(entry.entryId==="second")throw new Error("Erreur simulée sur la seconde ligne");
  partialTransfers.push([entry.name,qty]);
 },
 async()=>partialSaved.push(partialLoot.items.map(e=>e.quantity)),
 (_user,_actor,entry,qty)=>({entryId:entry.entryId,quantity:qty}),
 preflight,{error:()=>{}});
await partialHandler({userId:"P",tokenUuid:"Scene.S.Token.T",lootId:"partial",quantity:"all-card"});
assert.equal(partialTransfers.length,1);
assert.deepEqual(partialSaved,[[0,1]],"La première prise reste acquise avant l'échec");
assert.deepEqual(partialLoot.items.map(e=>e.quantity),[0,1]);
assert.equal(partialLoot.claims.length,1);
assert.equal(partialMessages.at(-1).ok,false);
assert.match(partialMessages.at(-1).message,/1 ligne\(s\) précédente\(s\) enregistrée\(s\)/);

console.log("OK — Prévalidation du lot, sauvegarde par ligne et interruption partielle sans reprise du stock déjà pris.");
