import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [trading,container,main,merchant]=await Promise.all([
 "scripts/h0d-trade.js","scripts/h0d-container.js","scripts/h0d-loot.js","scripts/h0d-merchant.js"
].map(async path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
const source=trading.replace(/^export /gm,"");
const {barterItemDetails,barterQuote}=new Function(source+";return {barterItemDetails,barterQuote};")();
const makeItem=(id,value=1,quantity=3,kind="resource")=>{
 const template=kind==="resource"?"H0DResTpl0000001":"H0DObjTpl0000001";
 const k=kind==="resource"?"H0D_Ressource_Valeur_Unitaire":"H0D_Objet_Valeur";
 const q=kind==="resource"?"H0D_Ressource_Quantite":"H0D_Objet_Quantite";
 return {id,name:id,system:{template,props:{[k]:String(value),[q]:String(quantity)}},
 updates:[],async update(obj){this.updates.push(obj);for(const [key,v] of Object.entries(obj))this.system.props[key.split(".").at(-1)]=v;}};
};
const resource=makeItem("pm",1,3),rare=makeItem("oeil",5,1),zero=makeItem("zero",0,10);
const actor={id:"BUYER",uuid:"Actor.BUYER",name:"PJ",items:[resource,rare,zero]};
actor.items.get=id=>actor.items.find(x=>x.id===id);
assert.deepEqual(barterItemDetails(resource),{id:"pm",name:"pm",value:1,quantity:3,quantityField:"H0D_Ressource_Quantite"});
assert.equal(barterItemDetails(zero),null);
assert.equal(barterItemDetails({...rare,system:{template:"O6qwtv7ozECILPHV",props:{}}}),null);
assert.equal(barterQuote(actor,[{itemId:"pm",quantity:2}],2).overpay,0);
assert.equal(barterQuote(actor,[{itemId:"pm",quantity:1},{itemId:"oeil",quantity:1}],5).overpay,1);
for(const sel of [[{itemId:"pm",quantity:4}],[{itemId:"pm",quantity:-1}],[{itemId:"missing",quantity:1}],[{itemId:"pm",quantity:1},{itemId:"pm",quantity:1}]]){
 assert.throws(()=>barterQuote(actor,sel,1),/invalide|dupliquées|insuffisante/);
}
assert.throws(()=>barterQuote(actor,[{itemId:"pm",quantity:1}],2),/Troc insuffisant/);
assert.throws(()=>barterQuote(actor,[],2),/Aucune ressource/);

assert.match(container,/actor\?\.getFlag\?\.\(NS,"merchant"\)\?\.enabled===true/,
 "Un PNJ porteur du rôle marchand doit être éligible sans template Coffre.");
assert.match(main,/if\(isContainerToken\(\{actor:tokenDoc\.actor\}\)\)return openMerchantForPlayerOnGM\(data\)/,
 "Le MJ doit router le vendeur même quand le joueur n'accède pas à ses flags.");
assert.match(container,/retrait gratuit interdit chez un marchand/);
assert.match(container,/data-h0d-container-action="trade"/);
assert.match(merchant,/setValueBarterEnabled/);
const from=container.indexOf("async function tradeSerialized("),
 to=container.indexOf("async function processOpen(",from);
assert.ok(from>=0&&to>from);
const tradeSrc=container.slice(from,to);
const makeEnv=(options={})=>{
 const seller={id:"SELLER",uuid:"Actor.SELLER",name:"Raska",state:{
   enabled:true,valueBarterEnabled:options.enabled!==false,
   offers:[{reference:"rations",name:"Rations épicées",price:2,currency:"jetons",quantity:1,perPurchase:1}]},
   async setFlag(_ns,_key,state){this.state=structuredClone(state);}
 };
 const token={uuid:"Scene.S.Token.V",hidden:false,actor:seller,parent:{id:"S"}};
 const item=makeItem("pm",1,3);
 const buyer={id:"BUYER",uuid:"Actor.BUYER",name:"PJ",items:[item],deleted:[],async deleteEmbeddedDocuments(_type,ids){this.deleted.push(...ids);}};
 buyer.items.get=id=>buyer.items.find(x=>x.id===id);
 const USER={id:"P",isGM:false,viewedScene:"S"},GM={id:"GM",isGM:true};
 let sold=0,back=0,refreshed=0;
 const replies=[];
 const game={user:GM,users:{get:id=>id==="P"?USER:GM},settings:{get:()=>true},
   socket:{emit:(_ns,data)=>replies.push(data)}};
 const merchantAPI={
   getMerchant:()=>structuredClone(seller.state),
   async setMerchantOffers(_vendor,offers){if(options.failStock)throw Error("stock update failed");seller.state.offers=structuredClone(offers);}
 };
 const helpers={resolveTokenDocument:async()=>token,resolveRecipientActor:async()=>buyer,
   actorOwnedByUser:()=>true};
 const trade=new Function("game","ui","helpers","readContainer","barterQuote","transferOffer",
  "merchantAPI","updateCards","NS","SOCKET","console",tradeSrc+"\nreturn tradeSerialized;")(
  game,{notifications:{}},helpers,()=>({actor:seller,mode:"Marchand",state:structuredClone(seller.state)}),
  barterQuote,async()=>{
    if(options.failDelivery)throw Error("Item generation failed");
    sold++;
    return {rollback:async()=>{back++;sold--;}};},
  merchantAPI,async()=>{refreshed++;},"h0d-loot","module.h0d-loot",{error:()=>{},warn:()=>{}}
 );
 const submit=(selection=[{itemId:"pm",quantity:2}],data={})=>trade({
   userId:"P",tokenUuid:token.uuid,actorId:"BUYER",offerIndex:0,
   reference:"rations",offerName:"Rations épicées",barterItems:selection,...data
 });
 return {seller,buyer,item,replies,submit,stats:()=>({sold,back,refreshed})};
};
{
 const env=makeEnv();
 await env.submit();
 assert.equal(env.item.system.props.H0D_Ressource_Quantite,"1");
 assert.equal(env.seller.state.offers[0].quantity,0);
 assert.equal(env.replies.at(-1).ok,true);
 assert.equal(env.stats().sold,1);
 assert.equal(env.seller.state.barterReceipts.length,1);
}
{
 const env=makeEnv();
 await env.submit([{itemId:"pm",quantity:1}]);
 assert.equal(env.replies.at(-1).ok,false,"Impossible de payer 2 avec 1 PM.");
 assert.equal(env.item.system.props.H0D_Ressource_Quantite,"3");
 assert.equal(env.seller.state.offers[0].quantity,1);
}
{
 const env=makeEnv({enabled:false});
 await env.submit();
 assert.equal(env.replies.at(-1).ok,false,"Refus quand le vendeur n'a pas choisi l'équivalence.");
}
{
 const env=makeEnv({failDelivery:true});
 await env.submit();
 assert.equal(env.replies.at(-1).ok,false);
 assert.equal(env.item.system.props.H0D_Ressource_Quantite,"3","Payment refunded if delivery fails.");
 assert.equal(env.seller.state.offers[0].quantity,1);
}
{
 const env=makeEnv({failStock:true});
 await env.submit();
 assert.equal(env.replies.at(-1).ok,false);
 assert.equal(env.item.system.props.H0D_Ressource_Quantite,"3");
 assert.equal(env.stats().sold,0,"Delivery rolled back when merchant stock update fails.");
 assert.equal(env.stats().back,1);
}
{
 const env=makeEnv();env.seller.state.offers[0].price=null;
 await env.submit();
 assert.equal(env.replies.at(-1).ok,false,"No free take when price is unknown.");
}
{
 const env=makeEnv();env.seller.state.offers[0].price=1;
 await env.submit([{itemId:"pm",quantity:2}]);
 assert.equal(env.replies.at(-1).ok,false,"Overpayment must be acknowledged.");
 await env.submit([{itemId:"pm",quantity:2}],{ackOverpay:true});
 assert.equal(env.replies.at(-1).ok,true);
}
console.log("OK : vendeur PJ, troc par valeur opt-in, sécurité des stocks et remboursement.");
