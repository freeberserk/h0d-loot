import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [rulesSource,viewSource]=await Promise.all([
  readFile(new URL("../scripts/h0d-trade.js",import.meta.url),"utf8"),
  readFile(new URL("../scripts/h0d-trade-dialog.js",import.meta.url),"utf8")
]);
const {barterItemDetails,barterQuote,bestBarterOffer}=new Function(
  rulesSource.replace(/^export /gm,"")+";return {barterItemDetails,barterQuote,bestBarterOffer};"
)();
const makeItem=(id,value,quantity)=>({
 id,name:id,img:"icons/svg/item-bag.svg",
 system:{template:"H0DResTpl0000001",props:{
 H0D_Ressource_Valeur_Unitaire:String(value),H0D_Ressource_Quantite:String(quantity)}}
});
const actor=items=>{
 items.get=id=>items.find(item=>item.id===id);
 return {name:"Joueur",items};
};
const run=async({items,price,action,validate})=>{
 const buyer=actor(items);
 const content={className:"",innerHTML:""};
 let consent,confirm,inputs,summary,status,progress,ack,surplus,listeners,dialogResult;
 const fakeRoot={
   addEventListener(type,fn){(listeners[type]??=[]).push(fn);},
   querySelector(selector){
     if(selector.startsWith('[name="pay_')){
       return inputs[Number(selector.match(/pay_(\d+)/)?.[1])];
     }
     if(selector.startsWith("[data-h0d-trade-subtotal=")){
       return subtotals[Number(selector.match(/subtotal="(\d+)"/)?.[1])];
     }
     return {
       '[name="tradeOverpay"]':consent,
       '[data-h0d-trade-status]':status,
       '[data-h0d-trade-total]':summary,
       '[data-h0d-trade-progress]':progress,
       '[data-h0d-trade-ack-row]':ack,
       '[data-h0d-trade-overpay]':surplus
     }[selector]??null;
   }
 };
 const subtotals=items.map(()=>({textContent:""}));
 const dialog={
   element:{querySelector:selector=>selector===".h0d-trade-root"?fakeRoot:
     selector==='button[data-action="trade-confirm"]'?confirm:null}
 };
 const DialogV2={
   wait:async config=>{
     assert.ok(content.innerHTML.includes("Offre au plus juste"));
     assert.ok(content.innerHTML.includes("Valeur offerte"));
     assert.ok(content.innerHTML.includes("Possédés : "));
     inputs=items.map(()=>({value:"0",previousElementSibling:{},nextElementSibling:{}}));
     consent={checked:false};
     confirm={disabled:false,textContent:""};
     summary={textContent:""},status={textContent:"",dataset:{}};
     progress={value:0},ack={hidden:true},surplus={textContent:""};
     listeners={};
     config.render(null,dialog);
     assert.equal(confirm.disabled,price>0,"La validation doit commencer bloquée si rien n'est offert.");
     const clickAuto=()=>{
       for(const fn of listeners.click)fn({preventDefault(){},
         target:{closest:selector=>selector==="[data-h0d-trade-auto]"?{}:null}});
     };
     const setAmount=(i,value)=>{
       inputs[i].value=String(value);
       for(const fn of listeners.input)fn({
         target:{matches:()=>true}
       });
     };
     const consentOverpay=()=>{
       consent.checked=true;
       for(const fn of listeners.change)fn({target:consent});
     };
     const state=()=>({inputs,consent,confirm,summary,status,progress,ack,surplus,clickAuto,setAmount,consentOverpay});
     await action(state());
     await validate(state());
     if(confirm.disabled)return {cancelled:true};
     const button={form:{elements:{...Object.fromEntries(inputs.map((input,i)=>["pay_"+i,input])),
       tradeOverpay:consent}}};
     return config.buttons.find(x=>x.action==="trade-confirm").callback(null,button);
   }
 };
 const open=new Function("barterItemDetails","barterQuote","bestBarterOffer","foundry",
   "document","ui",viewSource.replace(/^import.*\n/gm,"").replace(/^export /gm,"")+
   "\nreturn openValueTradeDialog;"
 )(barterItemDetails,barterQuote,bestBarterOffer,{
   utils:{escapeHTML:value=>String(value)},
   applications:{api:{DialogV2}}
 },{createElement:()=>content},{notifications:{warn:()=>{}}});
 dialogResult=await open({actor:buyer,vendorName:"Marchand",offer:{name:"Corde",price}});
 return dialogResult;
};
{
 const result=await run({
   items:[makeItem("pm",1,5),makeItem("cell",5,2)],price:6,
   action:async ui=>{
     ui.clickAuto();
     assert.equal(ui.summary.textContent,"6 / 6 jetons");
     assert.equal(ui.status.dataset.status,"exact");
     assert.equal(ui.confirm.disabled,false);
     assert.equal(ui.progress.value,6);
   },
   validate:async ui=>{
     assert.equal(ui.inputs[0].value,"1");
     assert.equal(ui.inputs[1].value,"1");
   }
 });
 assert.deepEqual(result.barterItems,[{itemId:"pm",quantity:1},{itemId:"cell",quantity:1}]);
 assert.equal(result.ackOverpay,false);
 assert.equal(result.quotedPrice,6);
}
{
 const result=await run({
   items:[makeItem("cell",5,1)],price:4,
   action:async ui=>{
     ui.clickAuto();
     assert.equal(ui.status.dataset.status,"overpay");
     assert.equal(ui.confirm.disabled,true,"Le surplus est refusé tant qu'il n'est pas accepté.");
     assert.equal(ui.surplus.textContent,"1");
     ui.consentOverpay();
     assert.equal(ui.confirm.disabled,false);
   },validate:async ui=>assert.equal(ui.ack.hidden,false)
 });
 assert.equal(result.ackOverpay,true);
 assert.deepEqual(result.barterItems,[{itemId:"cell",quantity:1}]);
}
{
 const result=await run({
   items:[makeItem("pm",1,5)],price:3,
   action:async ui=>{
     ui.setAmount(0,8);
     assert.equal(ui.status.dataset.status,"invalid");
     assert.equal(ui.confirm.disabled,true);
     ui.setAmount(0,2);
     assert.equal(ui.status.dataset.status,"insufficient");
     assert.equal(ui.confirm.disabled,true);
   },validate:async()=>{}
 });
 assert.equal(result,null);
}
console.log("OK : dialogue interactif au clic, prévisualisation, auto-sélection, refus surplus et quantité invalide.");
