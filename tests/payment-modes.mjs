import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const tradeSource=source("scripts/h0d-trade.js");
const containerSource=source("scripts/h0d-container.js");
const merchantSource=source("scripts/h0d-merchant.js");
const {barterQuote,barterItemDetails,isRecognitionToken,recognitionTokenPayment}=new Function(
  tradeSource.replace(/^export /gm,"")+";return {barterQuote,barterItemDetails,isRecognitionToken,recognitionTokenPayment};"
)();
const clone=x=>structuredClone(x);
const item=(id,quantity,type="Plaque",value=1)=>({
 id,name:id,system:{template:"H0DResTpl0000001",props:{
 H0D_Ressource_Type:type,H0D_Ressource_Quantite:String(quantity),
 H0D_Ressource_Valeur_Unitaire:String(value)}},
 async update(patch){for(const [path,value] of Object.entries(patch))this.system.props[path.split(".").at(-1)]=value;}
});
const token=item("Jeton de Reconnaissance",2,"Jeton",0);
const inflated=item("Jeton de Reconnaissance",1,"Jeton",50);
assert(isRecognitionToken(token));
assert.equal(barterItemDetails(inflated),null,"Les jetons ne sont jamais valorisés comme matériaux.");
assert(!isRecognitionToken(item("Plaque métallique",2,"Plaque")));
const investor={items:[token,item("PM",3)]};investor.items.get=id=>investor.items.find(i=>i.id===id);
const plan=recognitionTokenPayment(investor,3);
assert.equal(plan.used,2);assert.equal(plan.remaining,1);
assert.equal(barterQuote(investor,[{itemId:"PM",quantity:1}],plan.remaining).total,1);
assert.throws(()=>barterQuote(investor,[{itemId:token.id,quantity:1}],1),/indisponible/);
const legacyMerchant=new Function("foundry","game",merchantSource.replace(/^import .*\n/gm,"").replace(/^export /gm,"")+
  ";return getMerchant;")({utils:{deepClone:clone}},{
  modules:new Map(),user:{isGM:true}
});
const legacyActor=state=>({documentName:"Actor",getFlag:()=>state});
assert.equal(legacyMerchant(legacyActor({enabled:true,valueBarterEnabled:true,offers:[]})).paymentMode,
 "resources-only","Les anciens marchands troquant gardent le mode ressources.");
assert.equal(legacyMerchant(legacyActor({enabled:true,valueBarterEnabled:false,offers:[]})).paymentMode,
 null,"Un marchand auparavant désactivé ne doit pas devenir actif sans choix MJ.");

const start=containerSource.indexOf("async function tradeSerialized(");
const end=containerSource.indexOf("async function processOpen(",start);
assert.ok(start>=0&&end>start);
const serialized=containerSource.slice(start,end);
function env({mode="tokens-first",tokens=2,resources=3,price=3,failDelivery=false,
  failStock=false,currency="jetons",legacy=false}={}){
 const buyerToken=item("Jeton de Reconnaissance",tokens,"Jeton",0),pm=item("PM",resources);
 const buyer={id:"BUYER",uuid:"Actor.BUYER",name:"PJ",items:[buyerToken,pm],
  deleted:[],async deleteEmbeddedDocuments(_type,ids){this.deleted.push(...ids);}};
 buyer.items.get=id=>buyer.items.find(it=>it.id===id);
 const vendor={id:"SELLER",uuid:"Actor.SELLER",name:"Senn",
  state:{enabled:true,valueBarterEnabled:true,
    ...(legacy?{}:{paymentMode:mode}),
    offers:[{reference:"rations",name:"Rations",currency,price,quantity:1,perPurchase:1}]},
  async setFlag(_ns,_flag,state){this.state=clone(state);}};
 const sceneToken={uuid:"Scene.S.Token.SELLER",hidden:false,actor:vendor,parent:{id:"S"}};
 const player={id:"P",isGM:false,viewedScene:"S"};
 const messages=[];let sold=0,rolledBack=0;
 const game={user:{id:"GM",isGM:true},users:{get:id=>id==="P"?player:null},
  settings:{get:()=>true},socket:{emit:(_namespace,message)=>messages.push(message)}};
 const api={getMerchant:()=>clone(vendor.state),
  async setMerchantOffers(_actor,offers){if(failStock)throw Error("Stock refused");vendor.state.offers=clone(offers);}};
 const run=new Function("game","ui","helpers","readContainer","barterQuote",
  "recognitionTokenPayment","transferOffer","merchantAPI","updateCards","NS","SOCKET","console",
  serialized+";return tradeSerialized;")(
  game,{notifications:{}},
  {resolveTokenDocument:async()=>sceneToken,resolveRecipientActor:async()=>buyer,actorOwnedByUser:()=>true},
  ()=>({actor:vendor,mode:"Marchand",state:clone(vendor.state)}),
  barterQuote,recognitionTokenPayment,async()=>{
   if(failDelivery)throw Error("Delivery refused");
   sold++;
   return {rollback:async()=>{sold--;rolledBack++;}};
  },api,async()=>{},"h0d-loot","module.h0d-loot",{error(){},warn(){}});
 return {buyerToken,pm,vendor,messages,
  stats:()=>({sold,rolledBack}),
  async buy(barterItems=[],tokensUsed=0,extra={}){
   await run({userId:"P",tokenUuid:sceneToken.uuid,offerIndex:0,
    reference:"rations",offerName:"Rations",quotedPrice:price,barterItems,tokensUsed,...extra});
   return messages.at(-1);
  }};
}
{
 const e=env();
 assert.equal((await e.buy([{itemId:"PM",quantity:1}],2)).ok,true);
 assert.equal(e.buyerToken.system.props.H0D_Ressource_Quantite,"0");
 assert.equal(e.pm.system.props.H0D_Ressource_Quantite,"2");
 assert.equal(e.vendor.state.offers[0].quantity,0);
 assert.equal(e.vendor.state.barterReceipts[0].tokensUsed,2);
}
{
 const e=env({tokens:3});
 assert.equal((await e.buy([],3)).ok,true,"Les jetons peuvent payer l'intégralité.");
 assert.equal(e.pm.system.props.H0D_Ressource_Quantite,"3");
}
{
 const e=env({mode:"resources-only",tokens:8,currency:"ressources"});
 assert.equal((await e.buy([{itemId:"PM",quantity:3}])).ok,true);
 assert.equal(e.buyerToken.system.props.H0D_Ressource_Quantite,"8");
}
{
 const e=env({legacy:true,tokens:5});
 assert.equal((await e.buy([{itemId:"PM",quantity:3}])).ok,true);
 assert.equal(e.buyerToken.system.props.H0D_Ressource_Quantite,"5");
}
for(const options of [{failDelivery:true},{failStock:true}]){
 const e=env(options);
 assert.equal((await e.buy([{itemId:"PM",quantity:1}],2)).ok,false);
 assert.equal(e.buyerToken.system.props.H0D_Ressource_Quantite,"2");
 assert.equal(e.pm.system.props.H0D_Ressource_Quantite,"3");
 assert.equal(e.vendor.state.offers[0].quantity,1);
 assert.equal(e.stats().sold,0);
}
{
 const e=env();
 assert.equal((await e.buy([{itemId:"PM",quantity:1}],1)).ok,false,"Solde jetons obsolète.");
 assert.equal(e.buyerToken.system.props.H0D_Ressource_Quantite,"2");
}
{
 const e=env({mode:"resources-only",tokens:3});
 assert.equal((await e.buy([],3)).ok,false,"Les jetons ne paient pas chez ce marchand.");
}
{
 const e=env({mode:"tokens-first",tokens:0});
 assert.equal((await e.buy([{itemId:"PM",quantity:3}],0)).ok,true,"Le complément intégral reste possible.");
}
console.log("OK : jetons prioritaires, complément, ressources seules, migration, refus et remboursement.");
