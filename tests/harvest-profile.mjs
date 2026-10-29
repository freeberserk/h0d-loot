import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  HARVEST_KINDS,harvestKind,normalizeHarvestProfile,
  tableCandidates,selectHarvestResults,reconcileHarvestLoot
} from "../scripts/h0d-harvest.js";

const table={
  replacement:true,
  results:{contents:[
    {type:"text",description:"Viande animale",weight:4,flags:{"h0d-loot":{resourceId:"meat"}}},
    {type:"text",description:"Os animal",weight:3,flags:{"h0d-loot":{resourceId:"bone"}}},
    {type:"text",description:"Peau animale",weight:2,flags:{"h0d-loot":{resourceId:"skin"}}},
    {type:"text",description:"Trophée animal rare",weight:1,flags:{"h0d-loot":{resourceId:"trophy"}}}
  ]}
};
const rules=normalizeHarvestProfile({
 mode:"directed",allowed:{meat:false,bone:true,skin:true,trophy:false,other:false},
 guaranteed:"skin",note:"Viande impropre ; peau intacte et récupérable."
});
assert.equal(HARVEST_KINDS.length,5);
assert.equal(harvestKind("Peau animale"),"skin");
assert.equal(harvestKind("Fourrure de renard"),"skin");
assert.equal(harvestKind("Os animal"),"bone");
assert.equal(harvestKind("Viande animale"),"meat");
assert.equal(harvestKind("Trophée animal rare"),"trophy");
assert.equal(tableCandidates(table,rules).length,2);
for(const random of [()=>0,()=>.39,()=>.9,()=>.9999]){
  const chosen=selectHarvestResults(table,rules,3,random);
  assert.equal(chosen.results.length,3,"Le budget existant de 3 tirages est maintenu.");
  assert(chosen.results.some(x=>x.description==="Peau animale"),"Au moins une peau après un scan validé par le MJ.");
  assert(chosen.results.every(x=>["Peau animale","Os animal"].includes(x.description)),
    "Ni viande ni trophée interdit.");
}
const one=selectHarvestResults(table,rules,1,()=>0);
assert.deepEqual(one.results.map(x=>x.description),["Peau animale"],"Une peau prend le tirage disponible.");
assert.equal(one.draws,1);
assert.throws(()=>selectHarvestResults(table,{...rules,allowed:{...rules.allowed,skin:false}},2),
  /garantie interdite/);
assert.throws(()=>selectHarvestResults({replacement:true,results:{contents:table.results.contents.slice(0,2)}},rules,2),
  /absente de la RollTable/,"Aucune peau inventée si la table n'en propose pas.");
assert.throws(()=>selectHarvestResults({...table,replacement:false},rules,2),/avec remise/);

// Cas concret : le générateur avait choisi Viande+Os ; le MJ avait annoncé Peau.
const before={
  schema:2,lootId:"persistant",source:{type:"creature"},items:[
    {entryId:"meat-1",kind:"resource",resourceId:"meat",name:"Viande animale",quantity:1},
    {entryId:"bone-1",kind:"resource",resourceId:"bone",name:"Os animal",quantity:1}
  ],claims:[],createdAt:100
};
const makeEntry=(items,tableResult)=>{
  const id=tableResult.flags["h0d-loot"].resourceId;
  items.push({entryId:"new-"+id,kind:"resource",resourceId:id,
    name:tableResult.description,quantity:1});
};
const adjusted=reconcileHarvestLoot(before,rules,table,{addResult:makeEntry,rng:()=>0});
assert.deepEqual(adjusted.loot.items.map(x=>x.name),["Os animal","Peau animale"]);
assert.deepEqual(adjusted.removed,[{name:"Viande animale",quantity:1}]);
assert.deepEqual(adjusted.added,["Peau animale"]);
assert.equal(adjusted.loot.lootId,before.lootId);
assert.equal(adjusted.loot.source.harvest.note,rules.note);
assert.deepEqual(before.items.map(x=>x.name),["Viande animale","Os animal"],"Le calcul ne modifie pas l'ancien snapshot.");
const repeated=reconcileHarvestLoot(adjusted.loot,rules,table,{addResult:makeEntry,rng:()=>0});
assert.equal(repeated.added.length,0,"Ne jamais multiplier les peaux déjà garanties.");
assert.equal(repeated.loot.items.filter(x=>x.name==="Peau animale").length,1);

// Des objets déjà prélevés sont des faits historiques, pas à effacer.
const claimed={
 ...before,items:[{...before.items[0],quantity:0},before.items[1]],
 claims:[{entryId:"meat-1",resourceId:"meat",name:"Viande animale",quantity:1}]
};
const afterClaim=reconcileHarvestLoot(claimed,rules,table,{addResult:makeEntry,rng:()=>0});
assert.deepEqual(afterClaim.loot.claims,claimed.claims);
assert.equal(afterClaim.loot.items.find(x=>x.name==="Viande animale").quantity,0);
assert.deepEqual(afterClaim.alreadyClaimed,["Viande animale"]);
assert(afterClaim.loot.items.some(x=>x.name==="Peau animale"));
const skinClaimed={
 ...before,items:[before.items[1]],
 claims:[{entryId:"old-skin",resourceId:"skin",name:"Peau animale",quantity:1}]
};
const afterSkinClaim=reconcileHarvestLoot(skinClaimed,rules,table,{addResult:makeEntry,rng:()=>0});
assert.equal(afterSkinClaim.added.length,0,"Une peau déjà prise satisfait la garantie.");

// L'ancien tirage libre reste intact.
const free=normalizeHarvestProfile({mode:"free",note:"Viande de qualité médiocre."});
assert.equal(free.mode,"free");
assert.equal(free.guaranteed,"");
assert.deepEqual(reconcileHarvestLoot(before,free,table,{addResult:makeEntry}).loot.items,before.items);

const main=await readFile(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
assert(main.includes('onChange:()=>configureHarvestForSelection()'),"Bouton MJ pour le scan.");
assert(main.includes('normalizeHarvestProfile(token.document.getFlag(MODULE_ID,HARVEST_FLAG)'),"Paramétrage propre à chaque token.");
assert(main.includes('selectHarvestResults(table,harvest,draws)'),"Filtre appliqué AVANT les résultats.");
assert(main.includes('await persistLoot(null,matched.revision.loot,token.document)'),"Le butin persistant et les cartes doivent être mis à jour.");
assert(main.includes('await token.document.setFlag(MODULE_ID,HARVEST_FLAG,profile)'),"La règle est conservée après régénération.");
assert(main.includes('Observation du scan / arbitrage MJ'),"Afficher la décision MJ sur les cartes.");
assert(main.includes('    configureHarvest: configureHarvestForSelection'),"API H0D exposée.");
assert(main.includes('mode:"directed",allowed,guaranteed:'));
assert(!main.includes('<select name="mode">'));

console.log("OK — Loot faune dirigé par scan, peau garantie, viande exclue, tirage pondéré, carcasses historiques et prélèvements préservés.");
