import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=async p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const [main,merchant,container]=await Promise.all([
  read("scripts/h0d-loot.js"),read("scripts/h0d-merchant.js"),read("scripts/h0d-container.js")
]);
const extract=(text,start,end)=>{
  const a=text.indexOf(start),b=text.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,"Section introuvable : "+start);
  return text.slice(a,b);
};

// Conservation des anciens stocks : null / vide => 1, mais 0 reste explicite.
const core=extract(merchant,"function merchantState(actor)","export async function setMerchantRole");
const {merchantState,normalizeOffer}=new Function("clone","NS","FLAG","game",
  core+";return {merchantState,normalizeOffer};")(
    value=>structuredClone(value),"h0d-loot","merchant",
    {modules:{get:id=>({active:id==="h0d-catalogue"})},
     h0dCatalogue:{getStock:key=>key==="longue-corde-senn-p03"?
       {offres:[{reference:"fleches-renforcees",quantite_par_achat:5}]}:null}}
  );
const actor={getFlag:()=>({enabled:true,offers:[
  {reference:"a",name:"A",quantity:null},
  {reference:"b",name:"B",quantity:0},
  {reference:"c",name:"C",quantity:7},
  {reference:"d",name:"D",quantity:""}
]})};
assert.deepEqual(merchantState(actor).offers.map(o=>o.quantity),[1,0,7,1]);
for(const missing of [null,undefined,""])assert.equal(normalizeOffer({reference:"a",quantity:missing}).quantity,1);
assert.equal(normalizeOffer({reference:"b",quantity:0}).quantity,0);
assert.equal(normalizeOffer({reference:"b",quantity:1,price:null}).price,null);
assert.equal(normalizeOffer({reference:"b",quantity:1,price:0}).price,0);
assert.equal(merchantState({getFlag:()=>({stockKey:"longue-corde-senn-p03",offers:[
  {reference:"fleches-renforcees",quantity:null}
]})}).offers[0].perPurchase,5,"Senn vend un lot de cinq flèches, même sur un ancien stock.");
assert.throws(()=>normalizeOffer({reference:"b",quantity:-1}),/Quantité invalide/);
assert.match(merchant,/quantity:Number\.isSafeInteger\(o\.quantite_disponible\).*:1,/);

// Accès par token : retrait sécurisé, jamais via une tuile.
assert.match(main,/isContainerToken\(token\)/);
assert.match(main,/openContainerForGM\(token\.document\)/);
assert.match(main,/openContainerForPlayer\(token\.document\)/);
assert.doesNotMatch(main,/registerMerchantTileHooks\(\)/);
assert.match(container,/export function isContainerToken/);
assert.match(container,/H0DContActor0001/);
assert.match(container,/container-open/);
assert.match(container,/container-claim/);
assert.match(container,/user\.viewedScene/);
assert.match(container,/actorOwnedByUser/);
assert.match(container,/buildItem\(offer\.reference,\{mode:"skip"\}\)/);
assert.match(container,/await transferOffer\(actor,op\.offer,op\.qty\)/);
assert.match(container,/state\.offers\[op\.index\]\.quantity -= op\.qty/);
assert.match(container,/await merchantAPI\.setMerchantOffers\(source,state\.offers\)/);
assert.match(container,/card\.mode !== 'Marchand'/);
assert.match(container,/Paiement à gérer avec le MJ/);
assert.match(container,/const units=quantity\*perPurchase/);
assert.match(container,/source\.system\.props\[quantityField\] = String\(units\)/);
assert.match(container,/source\.name = offer\.name \|\| source\.name/);
console.log("OK: H0D conteneurs sur tokens ; quantités sûres et transferts encadrés.");
