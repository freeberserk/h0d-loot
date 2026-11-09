import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {decideSalvage,salvageYieldFallback} from "../scripts/h0d-salvage-rules.js";
const claw={
 H0D_Composant_Type:"Structure",H0D_Composant_Rendement:1,
 H0D_Composant_Rare_Pourcent:10,H0D_Composant_Rare_Catalogue_Key:"griffe-de-machine-intacte"
};
let result=decideSalvage(claw,{name:"Griffe gauche",hp:4,max:4,state:"Intact",rareAvailable:true,roll:()=>0.0999});
assert.equal(result.kind,"rare");assert.equal(result.catalogueKey,"griffe-de-machine-intacte");
assert.equal(result.quantity,1);
result=decideSalvage(claw,{name:"Griffe gauche",hp:4,max:4,state:"Intact",rareAvailable:true,roll:()=>0.11});
assert.equal(result.kind,"materials");assert.equal(result.quantity,1);
result=decideSalvage(claw,{name:"Griffe gauche",hp:4,max:4,state:"Intact",rareAvailable:false,roll:()=>0});
assert.equal(result.kind,"materials","Pas de clé Catalogue vérifiée : pas de rare inventée");
result=decideSalvage(claw,{name:"Griffe gauche",hp:2,max:4,state:"Endommage",rareAvailable:true,roll:()=>0.049});
assert.equal(result.kind,"rare");assert.equal(result.chance,5);
result=decideSalvage(claw,{name:"Griffe gauche",hp:2,max:4,state:"Endommage",rareAvailable:true,roll:()=>0.051});
assert.equal(result.kind,"materials");assert.equal(result.quantity,1);
const plates={
 H0D_Composant_Type:"Blindage",H0D_Composant_Rendement:4,
 H0D_Composant_Rare_Pourcent:100,H0D_Composant_Rare_Catalogue_Key:"fake-rare"
};
assert.equal(decideSalvage(plates,{name:"Plaques dorsales",hp:7,max:7,rareAvailable:true,roll:()=>0}).quantity,4);
assert.equal(decideSalvage(plates,{name:"Plaques dorsales",hp:7,max:7,rareAvailable:true,roll:()=>0}).kind,"materials");
assert.equal(decideSalvage(plates,{name:"Plaques dorsales",hp:3,max:7,rareAvailable:true,roll:()=>0}).quantity,2);
assert.equal(salvageYieldFallback({H0D_Composant_Type:"Blindage"},"Grand blindage dorsal"),4);
assert.deepEqual(decideSalvage(claw,{name:"Griffe",hp:0,max:4,state:"Détruit",rareAvailable:true,roll:()=>0}),{kind:"none",quantity:0});
assert.deepEqual(decideSalvage(claw,{name:"Griffe",hp:0,max:4,state:"Détaché",rareAvailable:true,roll:()=>0}),{kind:"none",quantity:0});
const js=readFileSync(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
assert.match(js,/addLoot\(lootMap, part\.resource, part\.quantity/,"Les quantités de PM sont transmises");
assert.match(js,/exactRareCatalogueDefinition\(rareKey\)/,"Identité rare exacte du Catalogue");
assert.match(js,/entry\.kind === "catalogue-resource"/,"Les pièces rares sont transférables");
assert.match(js,/addExactCatalogueRareToActor\(actor,entry\.catalogueKey,quantity,entry\.sourceCharge\)/,"Transfert rare avec charge de la pièce source");
assert.match(js,/Number\(p\.H0D_Composant_Charge_Entiere\)\|\|null/,"La charge entière suit le composant");
assert.match(js,/chargeFromSourceComponent/,"Traçabilité de la charge rare par composant");
assert.match(js,/source\.system\.props=\{\.\.\.source\.system\.props,\.\.\.foundry\.utils\.deepClone\(canonical\.definition\.props\)\}/,
 "Les propriétés de template sont conservées et non remplacées");
assert.match(js,/syncResourceChargesForActor/);
assert.match(js,/charge_statut==="a-valider-piece-speciale"/);
console.log("Butin H0D : rare ou matériaux, rendement, charges et ancien inventaire protégé.");
