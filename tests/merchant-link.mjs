import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [source,container,merchant,editor]=await Promise.all([
 "scripts/h0d-merchant-link.js","scripts/h0d-container.js",
 "scripts/h0d-merchant.js","scripts/h0d-merchant-editor.js"
].map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));

const copy=v=>structuredClone(v);
const world={user:{isGM:true},actors:{contents:[]}};
const foundry={utils:{deepClone:copy,escapeHTML:v=>String(v)}};
const link=new Function("game","foundry","console",
 source.replace(/^export /gm,"")+";return {isContainerActor,linkedMerchantUuid,resolveMerchantStockOwner,eligibleMerchantActors,assignContainerMerchant};"
)(world,foundry,{error:()=>{}});
let count=0;
const make=(name,type="vendor",offers=[],extra={})=>{
 const id="TEST"+(++count);
 const actor={
  id,uuid:"Actor."+id,name,documentName:"Actor",
  system:{template:type==="coffre"?"H0DContActor0001":"H0DCreatActor001",props:type==="coffre"?{H0D_Conteneur_Mode:"Marchand"}:{}},
  flags:{"h0d-loot":{merchant:{enabled:true,offers:copy(offers),paymentMode:"resources-only",valueBarterEnabled:true,...extra}}},
  writes:[],
  getFlag(ns,k){return copy(this.flags?.[ns]?.[k])??null;},
  async setFlag(ns,key,value){
   if(this.failLink&&key==="linkedMerchantUuid")throw new Error("Écriture refusée");
   if(this.failMerchant&&key==="merchant")throw new Error("Écriture vendeur refusée");
   this.flags[ns]??={};this.flags[ns][key]=copy(value);
   this.writes.push({key,value:copy(value)});
  }
 };
 world.actors.contents.push(actor);return actor;
};
const offer=(name,quantity)=>({reference:name,name,quantity,perPurchase:1,price:2,currency:"jetons"});
const chest=make("Coffre", "coffre", [offer("Corde",4)],{buyerId:"legacy-pj"});
const merchantActor=make("Raska", "vendor",[]);
const otherChest=make("Autre coffre","coffre",[offer("Lampe",3)]);
assert.equal(link.isContainerActor(chest),true);
assert.equal(link.isContainerActor(merchantActor),false);
assert.equal(link.resolveMerchantStockOwner(chest).owner,chest,"Ancien coffre autonome inchangé.");
assert.equal(link.eligibleMerchantActors(chest).some(x=>x.uuid===merchantActor.uuid),true);

// Liaison sans copie : le coffre archive ses offres, mais le marchand reste seul propriétaire.
let result=await link.assignContainerMerchant(chest,merchantActor.uuid);
assert.deepEqual({changed:result.changed,linked:result.linked,transferred:result.transferred},
 {changed:true,linked:true,transferred:false});
assert.equal(link.resolveMerchantStockOwner(chest).owner,merchantActor);
assert.equal(chest.getFlag("h0d-loot","merchant").offers.length,1);
assert.equal(merchantActor.getFlag("h0d-loot","merchant").offers.length,0);
assert.equal(chest.getFlag("h0d-loot","merchant").buyerId,"legacy-pj");
assert.equal(chest.writes.filter(w=>w.key==="merchant").length,0);
assert.equal(link.resolveMerchantStockOwner(chest).merchantUuid,merchantActor.uuid);

// Deux coffres distincts peuvent pointer vers le même stock.
await link.assignContainerMerchant(otherChest,merchantActor.uuid);
assert.equal(link.resolveMerchantStockOwner(otherChest).owner,merchantActor);
assert.equal(link.resolveMerchantStockOwner(chest).owner,merchantActor);
assert.equal(link.eligibleMerchantActors(otherChest).filter(x=>x.uuid===merchantActor.uuid).length,1);

// Une association invalide ne doit jamais réactiver les anciennes offres locales.
merchantActor.flags["h0d-loot"].merchant.enabled=false;
assert.throws(()=>link.resolveMerchantStockOwner(chest),/désactivé/);
merchantActor.flags["h0d-loot"].merchant.enabled=true;
await chest.setFlag("h0d-loot","linkedMerchantUuid","Actor.INEXISTANT");
assert.throws(()=>link.resolveMerchantStockOwner(chest),/introuvable/);
await chest.setFlag("h0d-loot","linkedMerchantUuid",merchantActor.uuid);

// Annulation explicite : retour vers le stock historique non modifié.
result=await link.assignContainerMerchant(chest,"");
assert.equal(result.linked,false);
assert.equal(link.resolveMerchantStockOwner(chest).owner,chest);
assert.equal(chest.getFlag("h0d-loot","merchant").offers[0].quantity,4);

// Transfert d'ancien stock vers un marchand strictement vide.
const empty=make("Marchand neuf","vendor",[]);
result=await link.assignContainerMerchant(chest,empty.uuid,{transferLegacyStock:true});
assert.equal(result.transferred,true);
assert.equal(link.resolveMerchantStockOwner(chest).owner,empty);
assert.equal(empty.getFlag("h0d-loot","merchant").offers[0].reference,"Corde");
assert.equal(empty.getFlag("h0d-loot","merchant").paymentMode,"resources-only");
assert.equal(chest.getFlag("h0d-loot","merchant").offers[0].reference,"Corde");
assert.equal(chest.getFlag("h0d-loot","merchant").buyerId,"legacy-pj");

// Refuser tout transfert susceptible d'écraser une vente ou un historique.
const occupied=make("Marchand existant","vendor",[offer("Piège",9)]);
await assert.rejects(()=>link.assignContainerMerchant(chest,occupied.uuid,{transferLegacyStock:true}),/stock ou un historique/);
assert.equal(link.resolveMerchantStockOwner(chest).owner,empty);
assert.equal(occupied.getFlag("h0d-loot","merchant").offers[0].quantity,9);
const historical=make("Marchand avec reçus","vendor",[],{barterReceipts:[{price:2}]});
await assert.rejects(()=>link.assignContainerMerchant(chest,historical.uuid,{transferLegacyStock:true}),/stock ou un historique/);

// Si l'écriture du lien échoue après transfert, restaurer le marchand.
const partialChest=make("Coffre refusé","coffre",[offer("Flèches",5)]);
const rollbackMerchant=make("Marchand restauré","vendor",[]);
partialChest.failLink=true;
await assert.rejects(()=>link.assignContainerMerchant(partialChest,rollbackMerchant.uuid,{transferLegacyStock:true}),/Écriture refusée/);
assert.equal(rollbackMerchant.getFlag("h0d-loot","merchant").offers.length,0);
assert.equal(link.linkedMerchantUuid(partialChest),"");

// Les comptes joueurs n'écrivent aucun flag.
world.user.isGM=false;
await assert.rejects(()=>link.assignContainerMerchant(otherChest,occupied.uuid),/réservée au MJ/);
world.user.isGM=true;
// Références non éligibles, pas de boucle de liaison ni de coffre marchand.
await assert.rejects(()=>link.assignContainerMerchant(chest,otherChest.uuid),/absent, inactif/);
assert.match(container,/const link=resolveMerchantStockOwner\(source\)/);
assert.match(container,/const actor=link\.owner/);
assert.match(container,/const mode=link\.linked\?"Marchand"/);
assert.match(container,/const key=String\(ownerUuid\|\|data\.tokenUuid/);
assert.match(container,/data\.merchantActorUuid!==vendor\.uuid/);
assert.match(container,/previous\.merchantActorUuid!==card\.merchantActorUuid/);
assert.match(merchant,/function merchantOf\(value\)/);
assert.match(merchant,/const actor=merchantOf\(actorValue\),state=merchantState\(actor\)/);
assert.match(merchant,/importCatalogueStock/);
assert.match(editor,/Configurer la liaison/);
assert.match(editor,/Ouvrir la fiche du marchand/);
console.log("OK : liaison coffre-marchand, stock unique, 2 coffres, aucun fallback, transfert contrôlé, rollback.");
