import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const tradeSource=await readFile(new URL("../scripts/h0d-trade.js",import.meta.url),"utf8");
const dialogSource=await readFile(new URL("../scripts/h0d-trade-dialog.js",import.meta.url),"utf8");
const containerSource=await readFile(new URL("../scripts/h0d-container.js",import.meta.url),"utf8");

const {barterQuote,bestBarterOffer}=new Function(
  tradeSource.replace(/^export /gm,"")+";return {barterQuote,bestBarterOffer};"
)();
const start=dialogSource.indexOf("export function previewBarterOffer");
const end=dialogSource.indexOf("/**",start+10);
assert.ok(start>=0&&end>start,"La fonction de calcul instantané doit rester testable.");
const preview=new Function(dialogSource.slice(start,end).replace(/^export /m,"")+";return previewBarterOffer;")();

const make=(id,value,quantity,kind="resource")=>{
  const template=kind==="resource"?"H0DResTpl0000001":"H0DObjTpl0000001";
  const v=kind==="resource"?"H0D_Ressource_Valeur_Unitaire":"H0D_Objet_Valeur";
  const q=kind==="resource"?"H0D_Ressource_Quantite":"H0D_Objet_Quantite";
  return {id,name:id,system:{template,props:{[v]:String(value),[q]:String(quantity)}}};
};
const actor=items=>{
  const contents=items;
  contents.get=id=>contents.find(item=>item.id===id);
  return {items:contents};
};
const check=(items,price,expectedTotal,expectedUnits)=>{
  const owner=actor(items);
  const result=bestBarterOffer(owner,price);
  assert.equal(result.status,"ok",JSON.stringify({items,price,result}));
  assert.equal(result.total,expectedTotal);
  if(expectedUnits!==undefined)assert.equal(result.units,expectedUnits);
  assert.equal(barterQuote(owner,result.selection,price).total,result.total);
};
// La priorité est d'éviter le surplus, même quand un gros objet couvre plus vite le prix.
check([make("pm",1,5),make("cell",5,2)],4,4,4);
check([make("pm",1,5),make("cell",5,2)],6,6,2);
check([make("pm",3,3),make("cell",5,1)],7,8,2);
check([make("pm",3,4),make("cell",6,2)],6,6,1);
check([make("pm",3,4),make("cell",5,2)],0,0,0);
assert.equal(bestBarterOffer(actor([make("pm",1,2)]),3).status,"insufficient");
assert.equal(bestBarterOffer(actor([make("pm",100000,1)]),3).status,"too-large");
assert.equal(bestBarterOffer(actor([]),2).status,"insufficient");
assert.equal(bestBarterOffer(actor([make("pm",1,2)]),-1).status,"invalid-price");

// Oracles exhaustifs : avec quatre ressources à quantités bornées, trouver
// VRAIMENT le surplus minimal puis le moins d'unités, pas une heuristique.
function bruteForce(rows,price){
  let best=null;
  const recur=(index,total,units)=>{
    if(index===rows.length){
      if(total<price)return;
      if(!best||total<best.total||(total===best.total&&units<best.units))best={total,units};
      return;
    }
    for(let n=0;n<=rows[index].q;n++)recur(index+1,total+n*rows[index].v,units+n);
  };
  recur(0,0,0);
  return best;
}
for(let seed=1;seed<=30;seed++){
  const rows=Array.from({length:4},(_,i)=>({v:1+(seed*7+i*11)%9,q:(seed+i*3)%4}));
  const person=actor(rows.map((r,i)=>make("resource"+i,r.v,r.q,i%2?"object":"resource")));
  for(let price=0;price<=25;price++){
    const expected=bruteForce(rows,price);
    const result=bestBarterOffer(person,price);
    if(!expected){assert.equal(result.status,"insufficient");continue;}
    assert.equal(result.status,"ok");
    assert.equal(result.total,expected.total);
    assert.equal(result.units,expected.units);
    assert.equal(barterQuote(person,result.selection,price).total,expected.total);
  }
}
const items=[{id:"pm",value:1,quantity:5},{id:"cell",value:5,quantity:2}];
assert.deepEqual(preview(items,[0,0],4),{
  valid:true,total:0,subtotals:[0,0],missing:4,overpay:0,status:"insufficient"
});
assert.equal(preview(items,[4,0],4).status,"exact");
assert.equal(preview(items,[0,1],4).overpay,1);
assert.equal(preview(items,[6,0],4).status,"invalid");
assert.equal(preview(items,[1.5,0],4).status,"invalid");
assert.equal(preview(items,[-1,0],4).status,"invalid");
assert.match(dialogSource,/DialogV2\.wait\(\{/);
assert.match(dialogSource,/data-h0d-trade-auto/);
assert.match(dialogSource,/data-h0d-trade-progress/);
assert.match(dialogSource,/data-h0d-trade-subtotal/);
assert.match(dialogSource,/consent\.checked=false/);
assert.match(dialogSource,/confirm\.disabled=quote\.status==="insufficient"/);
assert.match(dialogSource,/quote\.status==="overpay"&&!consent\.checked/);
assert.match(dialogSource,/return \{barterItems:data,ackOverpay:quote\.overpay>0&&checked,quotedPrice:price,tokensUsed:tokenPlan\.used\}/);
assert.doesNotMatch(containerSource,/Vérifier le troc|Confirmer un troc avec surplus/);
assert.match(containerSource,/openValueTradeDialog\(\{/);
assert.match(containerSource,/quotedPrice!==offer\.price/);
assert.match(containerSource,/const quote=barterQuote\(actor,data\.barterItems\|\|\[\],tokens\.remaining\)/);
assert.match(containerSource,/recognitionTokenPayment\(actor,offer\.price\)/);
console.log("OK : calcul instantané, sélection optimale exacte, confirmation unique et revalidation du MJ.");
