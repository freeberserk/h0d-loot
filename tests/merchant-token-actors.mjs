import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const code=(await readFile(new URL("../scripts/h0d-merchant-tiles.js",import.meta.url),"utf8"))
  .replace('import {merchantAPI} from "./h0d-merchant.js";',
    'const merchantAPI = globalThis.__merchantAPITest;');

globalThis.foundry={utils:{
  deepClone:value=>structuredClone(value),
  escapeHTML:value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")
}};
function actor(id,name,uuid,enabled,isToken=false) {
  return {documentName:"Actor",id,name,uuid,isToken,type:"character",
    stock:{enabled,offers:[{name:"Corde",reference:"corde",quantity:2,price:1,currency:"jetons"}]},
    getFlag(_ns,key){return key==="merchant"?structuredClone(this.stock):null;}};
}
const base=actor("same-id","Raska","Actor.same-id",false);
const tokenActor=actor("same-id","Raska","Scene.scene1.Token.token1.Actor.same-id",true,true);
const tileDoc={documentName:"Tile",name:"Stock Marchand",flags:{},
  getFlag(_ns,key){return this.flags[key]??null;},
  async setFlag(_ns,key,value){this.flags[key]=structuredClone(value);},
  async unsetFlag(_ns,key){delete this.flags[key];}
};
const tokenDocument={actor:tokenActor};
const scene={id:"scene1",name:"BAC-A-SABLE",tokens:{contents:[tokenDocument]},tiles:[tileDoc]};
const dialogs=[];
globalThis.game={
  user:{isGM:true},
  actors:{contents:[base],get:id=>id===base.id?base:null},
  scenes:{contents:[scene]},
  h0dEquipmentBuilder:{getDefinition:()=>({kind:"object"})}
};
globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};
globalThis.canvas={tiles:{controlled:[{document:tileDoc}]},scene};
globalThis.__merchantAPITest={getMerchant:a=>structuredClone(a.stock)};
globalThis.foundry.applications={api:{DialogV2:{
  input:async cfg=>{dialogs.push(cfg.content);return {actorId:tokenActor.uuid};},
  wait:async()=>null
}}};
const {linkSelectedMerchantTile,syncMerchantTiles,linkTileToMerchant,getTileStorefront}
  =await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

const linked=await linkSelectedMerchantTile();
assert.equal(linked.sourceUuid,tokenActor.uuid,"Token source is preserved uniquely");
assert.equal(linked.name,"Raska");
assert.match(dialogs[0],/token — BAC-A-SABLE/,"Unlinked token offered to GM");
assert.doesNotMatch(dialogs[0],/Aucun Marchand actif trouvé/,"Valid token merchant is detected");
assert.equal(linked.offers.length,1,"Public stock preserved");
assert.equal(linked.offers[0].category,"Objets");
tokenActor.stock.offers[0].quantity=3;
assert.equal(await syncMerchantTiles(tokenActor),1,"Token stock change syncs tile");
assert.equal(getTileStorefront(tileDoc).offers[0].quantity,3);
assert.equal(await syncMerchantTiles(base),0,"World actor with same ID cannot overwrite synthetic token storefront");

base.stock.enabled=true;
await linkTileToMerchant(tileDoc,base);
assert.equal(tileDoc.flags.merchantTile.sourceUuid,base.uuid);
assert.equal(await syncMerchantTiles(tokenActor),0,"Synthetic token cannot overwrite world Actor storefront");
console.log("OK: linked/synthetic token merchant selection and independent storefront sync");
