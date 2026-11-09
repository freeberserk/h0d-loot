import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {H0D_TOOL_ORDER} from "../scripts/h0d-tool-order.js";

const raw=await readFile(new URL("../scripts/h0d-merchant-tiles.js",import.meta.url),"utf8");
const code=raw.replace('import {merchantAPI} from "./h0d-merchant.js";',
  'const merchantAPI=globalThis.__merchantAPITest;')
  .replace('import {H0D_TOOL_ORDER} from "./h0d-tool-order.js";',
    'const H0D_TOOL_ORDER=globalThis.__h0dToolOrderTest;');
globalThis.__h0dToolOrderTest=H0D_TOOL_ORDER;

globalThis.foundry={utils:{
  deepClone: v=>structuredClone(v),
  escapeHTML: v=>String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;")
},applications:{api:{DialogV2:{
  wait:async config=>{globalThis.__opened=config;return "close";},
  input:async config=>({tileId:globalThis.__choice})
}}}};
const events=new Map();
globalThis.Hooks={
  on:(name,fn)=>{events.set(name,fn);},
  once:()=>{}
};
globalThis.ui={notifications:{info:()=>{},error:()=>{},warn:()=>{}}};
globalThis.__merchantAPITest={getMerchant:()=>{throw new Error("Player must not access NPC data");}};
const tile={
  id:"tile1",documentName:"Tile",hidden:false,name:"Stock Marchand",parent:{id:"scene1"},
  getFlag:(ns,name)=>ns==="h0d-loot"&&name==="merchantTile"?
    {version:1,enabled:true,name:"Raska Trois-Nœuds",offers:[
      {name:"Corde tressée",quantity:2,price:1,currency:"jetons",category:"Objets"}
    ]}:null
};
const obj={document:tile,isVisible:true,visible:true};
globalThis.canvas={
  ready:true,
  scene:{id:"scene1",tiles:{contents:[tile]}},
  tiles:{placeables:[obj]}
};
globalThis.game={user:{isGM:false}};
const api=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
api.registerMerchantTileHooks();
const tools={tokens:{tools:{}},tiles:{tools:{}}};
events.get("getSceneControlButtons")(tools);
assert.equal(typeof tools.tokens.tools.h0dMerchantVisit?.onChange,"function","Player token toolbar includes storefront action");
assert.equal(tools.tiles.tools.h0dMerchantTile,undefined,"Player cannot configure or link tiles");
await tools.tokens.tools.h0dMerchantVisit.onChange();
assert.match(globalThis.__opened.content,/Raska Trois-Nœuds/,"Player sees storefront header");
assert.match(globalThis.__opened.content,/Corde tressée/,"Player sees public goods");
assert.match(globalThis.__opened.content,/1 jetons/,"Player sees public price");
globalThis.__opened=null;
tile.hidden=true;
await tools.tokens.tools.h0dMerchantVisit.onChange();
assert.equal(globalThis.__opened,null,"Hidden tile storefront is not available");
console.log("OK: player storefront toolbar works without Actor or Tile control permissions");
