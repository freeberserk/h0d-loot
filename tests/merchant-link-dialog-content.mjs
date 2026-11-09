import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const script=await readFile(new URL("../scripts/h0d-merchant-link.js",import.meta.url),"utf8");
const sourceCode=script.replace(/^export /gm,"");
const chest={
  id:"C",uuid:"Actor.C",name:"Coffre",documentName:"Actor",
  system:{template:"H0DContActor0001",props:{}},
  getFlag:(ns,k)=>k==="merchant"?{enabled:true,offers:[{name:"Corde"}]}:null
};
const vendor={
  id:"V",uuid:"Actor.V",name:"Négociateur arme",documentName:"Actor",
  system:{template:"H0DCreatActor001",props:{}},
  getFlag:(ns,k)=>k==="merchant"?{enabled:true,offers:[]}:null
};
let examined=false;
const foundry={
  utils:{deepClone:v=>structuredClone(v),escapeHTML:s=>String(s)},
  applications:{api:{DialogV2:{
    input:async options=>{
      examined=true;
      assert.equal(options.content.getAttributeNames().length,0,
        "Foundry VTT 14 refuse les attributs sur l'élément content de DialogV2.input.");
      assert.match(options.content.innerHTML,/<div class="h0d-merchant-link-dialog">/);
      assert.match(options.content.innerHTML,/<select name="linkedMerchantUuid">/);
      assert.match(options.content.innerHTML,/<option value="Actor.V"/);
      assert.match(options.content.innerHTML,/<\/div>\s*$/);
      assert.equal(typeof options.render,"function");
      return null;
    }
  }}}
};
const document={
  createElement:tag=>{
    assert.equal(tag,"div");
    return {
      innerHTML:"",
      attributes:[],
      getAttributeNames(){return this.attributes;},
      set className(v){this.attributes.push("class");}
    };
  }
};
const game={user:{isGM:true},actors:{contents:[chest,vendor]}};
const open=new Function("game","foundry","document","console",sourceCode+";return openMerchantLinkDialog;")(
  game,foundry,document,{error:()=>{}}
);
const result=await open(chest);
assert.equal(result,null);
assert.ok(examined,"La deuxième fenêtre doit être appelée.");
console.log("OK : la boîte de liaison transmet un élément sans attribut et un wrapper de style interne.");
