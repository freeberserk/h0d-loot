import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {catalogueApi,resolveCatalogueResource,merchantCatalogueDefinitions} from "../scripts/h0d-catalogue-link.js";
const canonical={
 key:"cellule-stable",name:"Cellule stable",kind:"resource",props:{H0D_Ressource_Qualite:"Stable"},
 catalogue:{visible_au_stock_standard:true,pret_pour_builder:true,generable_stock_aleatoire:true}
};
const restricted={...canonical,key:"prototype-heliosium",name:"Prototype HelioSium",
 catalogue:{visible_au_stock_standard:false,pret_pour_builder:true,generable_stock_aleatoire:false}};
const unfinished={...canonical,key:"plan-echo",name:"Plan incomplet",
 catalogue:{visible_au_stock_standard:false,pret_pour_builder:false}};
const api={
 getStatus:()=>({ready:true}),
 getDefinitions:()=>[canonical,restricted,unfinished],
 getStockEligibleDefinitions:()=>[canonical],
 resolveDefinition:({key,name,kind})=>{
  const values=[canonical,restricted,unfinished];
  const hit=values.find(x=>x.kind===kind&&(x.key===key||x.name===name));
  return hit?{status:key?"key":"name",definition:hit}:{status:"missing",candidates:[]};
 }};
const game={modules:new Map([["h0d-catalogue",{active:true,api}]]),h0dCatalogue:api};
assert.equal(catalogueApi(game),api);
assert.equal(resolveCatalogueResource({name:"Cellule stable"},api).key,"cellule-stable");
assert.equal(resolveCatalogueResource({name:"Inconnu"},api).status,"missing");
assert.equal(resolveCatalogueResource({name:"Cellule stable"},null).status,"catalogue-absent");
const merchant=merchantCatalogueDefinitions(game);
assert.equal(merchant.source,"H0D Catalogue");
assert.deepEqual(merchant.definitions,[canonical]);
assert(!merchant.definitions.some(d=>d.key==="prototype-heliosium"));
assert(!merchant.definitions.some(d=>d.key==="plan-echo"));
game.modules.get("h0d-catalogue").active=false;
game.h0dEquipmentBuilder={getStandardStockDefinitions:()=>[{key:"historique",name:"Objet ancien",kind:"object"}]};
assert.equal(catalogueApi(game),null);
assert.equal(merchantCatalogueDefinitions(game).source,"Equipment Builder (secours historique)");
assert.equal(merchantCatalogueDefinitions(game).definitions.length,1);
const lootSource=readFileSync(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
const merchantSource=readFileSync(new URL("../scripts/h0d-merchant.js",import.meta.url),"utf8");
assert(lootSource.includes("source.system.props=foundry.utils.deepClone(canonical.definition.props)"));
assert(lootSource.includes("catalogueKey:canon.key??null"));
assert(lootSource.includes("equipmentCatalogueAudit:()=>("));
assert(merchantSource.includes("merchantCatalogueDefinitions(game)"));
assert(merchantSource.includes("Ajouter depuis \${esc(selector.source)}"));
assert(merchantSource.includes("getStockResolved(key)"),"Le stock exact Senn reste dans le Catalogue.");
console.log("OK — Marchand Catalogue, exclus stock interdits, ressources canoniques uniquement sur nouvelles prises, stocks Senn préservés.");
