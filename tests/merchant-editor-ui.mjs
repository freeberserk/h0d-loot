import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [editorSource,merchantSource,css]=await Promise.all([
  "scripts/h0d-merchant-editor.js","scripts/h0d-merchant.js","styles/h0d-loot.css"
].map(path=>readFile(new URL("../"+path,import.meta.url),"utf8")));
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const editor=new Function("foundry",editorSource.replace(/^export /gm,"")+
  ";return {merchantEditorRows,merchantEditorContent,bindMerchantEditor};")({
    utils:{escapeHTML:esc}
  });
const offers=[
 {reference:"fumigene",name:"Fumigène artisanal",quantity:1,perPurchase:1,
  price:3,currency:"jetons",notes:"Stock très limité"},
 {reference:"fleches",name:"Flèches renforcées ×5",quantity:2,perPurchase:5,
  price:null,currency:"jetons",notes:"Attention <rare> & \"précieux\""}
];
const markup=editor.merchantEditorContent({
  actorName:"Coffre <Senn>",state:{enabled:true,paymentMode:"tokens-first",offers},
  catalogueSource:"H0D Catalogue",builderOptions:'<option value="fumigene">Fumigène artisanal</option>',
  builderAvailable:true
});
assert.match(markup,/data-h0d-merchant-tab="stock"/);
assert.match(markup,/data-h0d-merchant-tab="config"/);
assert.match(markup,/data-h0d-merchant-search/);
assert.match(markup,/data-h0d-add-panel/);
assert.match(markup,/data-h0d-add-tab="manual"/);
assert.match(markup,/data-h0d-merchant-action="import"/);
assert.match(markup,/name="paymentMode" value="tokens-first" checked/);
assert.match(markup,/name="publishAfterSave"/);
assert.match(markup,/name="enabled"/);
assert.doesNotMatch(markup,/name="buyer"/,"L'ancien sélecteur acheteur ne doit pas être visible.");
assert.match(markup,/Coffre &lt;Senn&gt;/);
assert.doesNotMatch(markup,/Coffre <Senn>/);
assert.match(markup,/Stock : <b data-h0d-preview-quantity>2<\/b>/);
assert.match(markup,/Lot de 5 unités/);
assert.match(markup,/Prix à définir/);
assert.match(markup,/Attention &lt;rare&gt; &amp; &quot;précieux&quot;/);
assert.doesNotMatch(markup,/Stock très limité, quantité exacte non indiquée/);
assert.match(editorSource,/root\.addEventListener\("click"/);
assert.match(editorSource,/root\.addEventListener\("input"/);
assert.match(editorSource,/data-h0d-merchant-search/);
assert.match(editorSource,/row\.hidden=!visible/);
assert.match(editorSource,/const index=state\.offers\.length\+drafts\.length/);
assert.match(editorSource,/input\.checked=!input\.checked/);
assert.match(editorSource,/merchantEditorRows\(\[draft\],index\)/);
assert.match(editorSource,/rows\.insertAdjacentHTML\("beforeend"/);
assert.match(css,/\.h0d-merchant-window \.window-content/);
assert.match(css,/\.h0d-merchant-editor-footer/);

const source=`const isContainerActor=()=>false;
const linkedMerchantUuid=()=>"";
const resolveMerchantStockOwner=actor=>({source:actor,owner:actor,linked:false});
const openMerchantLinkDialog=async()=>null;
`+merchantSource.replace(/^import[^\n]*\n/gm,"").replace(/^export /gm,"");
const makeActor=(initial)=>{
 const actor={
  id:"ACTOR1",documentName:"Actor",name:"Coffre",flags:{"h0d-loot":{merchant:structuredClone(initial)}},
  updates:[],sheet:{render:()=>{}},
  getFlag(ns,key){return structuredClone(this.flags?.[ns]?.[key]);},
  async setFlag(ns,key,value){this.updates.push(structuredClone(value));this.flags[ns][key]=structuredClone(value);}
 };
 return actor;
};
const initial={enabled:true,paymentMode:"resources-only",valueBarterEnabled:true,
 buyerId:"LEGACY-PJ",offers,barterReceipts:[{price:5}],stockKey:"longue-corde-senn-p03"};
const dialogOptions=[];
let response=null;
const actor=makeActor(initial);
const game={user:{isGM:true},actors:{get:()=>actor,contents:[actor]},
 modules:{get:()=>({active:false})}};
const foundry={
 utils:{deepClone:v=>structuredClone(v),escapeHTML:esc},
 applications:{api:{DialogV2:{
  input:async opts=>{dialogOptions.push(opts);opts.render?.(null,{element:{classList:{add(){}},querySelector:()=>null}});return typeof response==="function"?response():response;},
  confirm:async()=>false
 }}}
};
const ui={notifications:{info:()=>{},warn:()=>{}}};
const document={createElement:tag=>{
  assert.equal(tag,"div");
  return {innerHTML:"",className:""};
}};
const merchant=new Function("foundry","game","merchantCatalogueDefinitions",
 "merchantEditorContent","bindMerchantEditor","ui","document","ChatMessage",
 source+";return {openMerchant,getMerchant};")(
 foundry,game,
 ()=>({source:"H0D Catalogue",definitions:[{key:"fumigene",name:"Fumigène artisanal",kind:"object"}]}),
 editor.merchantEditorContent,()=>{},ui,document,{create:async()=>{}}
);
const payload=(changes={})=>({
 enabled:true,paymentMode:"tokens-first",publishAfterSave:false,
 name_0:"Fumigène amélioré",quantity_0:"4",price_0:"3",currency_0:"jetons",notes_0:"Nouvelle note",
 name_1:"Flèches renforcées ×5",quantity_1:"2",price_1:"",currency_1:"jetons",notes_1:"Note flèches",
 ...changes
});
response=payload();
await merchant.openMerchant(actor);
assert.equal(actor.updates.length,1,"Une seule écriture atomique du flag est permise.");
assert.equal(actor.updates[0].offers[0].name,"Fumigène amélioré");
assert.equal(actor.updates[0].offers[0].quantity,4);
assert.equal(actor.updates[0].offers[0].perPurchase,1);
assert.equal(actor.updates[0].offers[1].perPurchase,5);
assert.equal(actor.updates[0].offers[1].price,null,"Prix indéfini ≠ prix zéro.");
assert.equal(actor.updates[0].buyerId,"LEGACY-PJ","L'ancien lien est conservé.");
assert.deepEqual(actor.updates[0].barterReceipts,[{price:5}]);
assert.equal(actor.updates[0].paymentMode,"tokens-first");
assert.match(dialogOptions[0].content.innerHTML,/Stock et marchandises/);
assert.match(dialogOptions[0].content.innerHTML,/Fumigène artisanal/);
assert.equal(dialogOptions[0].position.width,925);
assert.equal(dialogOptions[0].ok.label,"Enregistrer");

// Chaque nouvelle ligne, même ajoutée après ouverture, possède son index stable
// et est normalisée exactement comme les lignes historiques.
const next=makeActor({...initial,offers});
const merchant2=new Function("foundry","game","merchantCatalogueDefinitions",
 "merchantEditorContent","bindMerchantEditor","ui","document","ChatMessage",
 source+";return {openMerchant};")(
 foundry,{...game,actors:{get:()=>next,contents:[next]}},
 ()=>({source:"H0D Catalogue",definitions:[]}),editor.merchantEditorContent,
 (_dialog,{drafts})=>drafts.push({reference:"fumigene",name:"Nouvelle marchandise",quantity:1,perPurchase:1,price:2,currency:"jetons",notes:"Ajout manuel"}),
 ui,document,{}
);
response=payload({
 name_2:"Nouvelle marchandise",quantity_2:"1",price_2:"2",
 currency_2:"jetons",notes_2:"Ajout manuel",
 remove_1:"on"
});
await merchant2.openMerchant(next);
assert.equal(next.updates.length,1);
assert.equal(next.updates[0].offers.length,2,
 "Une nouvelle ligne ajoutée avant l'enregistrement doit être incluse.");
assert.equal(next.updates[0].offers[1].name,"Nouvelle marchandise");
assert.equal(next.updates[0].offers[1].price,2);
assert.equal(next.updates[0].offers[1].reference,"fumigene");
assert.equal(next.updates[0].offers[0].name,"Fumigène amélioré");

// Les quantités fractionnaires et négatives ne doivent jamais être enregistrées.
const bad=makeActor({...initial});
const merchantBad=new Function("foundry","game","merchantCatalogueDefinitions",
 "merchantEditorContent","bindMerchantEditor","ui","document","ChatMessage",
 source+";return {openMerchant};")(
 foundry,{...game,actors:{get:()=>bad,contents:[bad]}},
 ()=>({source:"H0D Catalogue",definitions:[]}),editor.merchantEditorContent,()=>{},ui,document,{}
);
response=payload({quantity_0:"1.5"});
await assert.rejects(()=>merchantBad.openMerchant(bad),/Quantité entière/);
assert.equal(bad.updates.length,0);
response=null;
assert.equal(await merchantBad.openMerchant(bad),null);
assert.equal(bad.updates.length,0);

// Stock modifié par un joueur pendant l'édition : aucune restauration accidentelle
// des quantités vendues après l'ouverture de la fenêtre.
const concurrent=makeActor({...initial});
let warnings=[];
const merchantConcurrent=new Function("foundry","game","merchantCatalogueDefinitions",
 "merchantEditorContent","bindMerchantEditor","ui","document","ChatMessage",
 source+";return {openMerchant};")(
 foundry,{...game,actors:{get:()=>concurrent,contents:[concurrent]}},
 ()=>({source:"H0D Catalogue",definitions:[]}),editor.merchantEditorContent,()=>{},
 {notifications:{info:()=>{},warn:msg=>warnings.push(msg)}},document,{}
);
response=()=>{concurrent.flags["h0d-loot"].merchant.offers[0].quantity=0;return payload();};
assert.equal(await merchantConcurrent.openMerchant(concurrent),null);
assert.equal(concurrent.updates.length,0);
assert.match(warnings[0],/stock a changé/);

console.log("OK : éditeur 2 onglets, protection des champs, sauvegarde unique, prix inconnu, concurrence et annulation.");
