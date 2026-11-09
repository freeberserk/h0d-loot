import {merchantCatalogueDefinitions} from "./h0d-catalogue-link.js";
import {merchantEditorContent,bindMerchantEditor} from "./h0d-merchant-editor.js";
// H0D Commerce — Stock marchand optionnel, indépendant des Items embarqués.
// Aucun achat ni prélèvement automatique dans cette première étape.
const NS="h0d-loot", FLAG="merchant";
const PAYMENT_MODES=Object.freeze(["tokens-first","resources-only"]);
const clone=v=>foundry.utils.deepClone(v);
const esc=v=>foundry.utils.escapeHTML(String(v??""));
function ensureGM(){if(!game.user?.isGM)throw new Error("H0D Commerce : réservé au MJ.");}
function actorOf(value){const actor=typeof value==="string"?game.actors.get(value):value;if(!actor||actor.documentName!=="Actor")throw new Error("Actor marchand introuvable.");return actor;}
function merchantState(actor){
 const state=clone(actor.getFlag(NS,FLAG)||{enabled:false,offers:[],buyerId:null,valueBarterEnabled:false});
 // Compatibilité : un ancien vendeur actif conserve le troc en ressources uniquement.
 state.paymentMode=["tokens-first","resources-only"].includes(state.paymentMode)?state.paymentMode:
   (state.valueBarterEnabled===true?"resources-only":null);
 state.valueBarterEnabled=state.paymentMode!==null;
 // Lecture des anciens stocks : quantité non définie = 1, sans réécriture immédiate.
 // Les conditionnements historiques (Senn vend notamment un demi-lot de flèches) viennent du Catalogue exact.
 const catalogue=typeof game!=="undefined"&&game?.modules?.get("h0d-catalogue")?.active?game.h0dCatalogue:null;
 const stock=state.stockKey&&catalogue?.getStock?.(state.stockKey);
 const packs=new Map((stock?.offres||[]).map(o=>[o.reference,o.quantite_par_achat]));
 state.offers=(state.offers||[]).map(o=>{
   const perPurchase=Number.isSafeInteger(o.perPurchase)&&o.perPurchase>0?o.perPurchase:packs.get(o.reference);
   const missing=o.quantity===null||o.quantity===undefined||String(o.quantity).trim()==="";
   const numericQuantity=missing?1:Number(o.quantity);
   // Les anciennes quantités numériques textuelles restent des quantités explicites.
   return {...o,
     quantity:Number.isSafeInteger(numericQuantity)&&numericQuantity>=0?numericQuantity:o.quantity,
     perPurchase:Number.isSafeInteger(perPurchase)&&perPurchase>0?perPurchase:1};
 });
 return state;
}
function normalizeOffer(o){
 const quantity=o.quantity===null||o.quantity===undefined||String(o.quantity).trim()===""?1:Number(o.quantity);
 if(!Number.isSafeInteger(quantity)||quantity<0)throw new Error("Quantité invalide.");
 const perPurchase=o.perPurchase===undefined||o.perPurchase===null?1:Number(o.perPurchase);
 if(!Number.isSafeInteger(perPurchase)||perPurchase<1)throw new Error("Conditionnement invalide.");
 // Prix manquant ≠ prix nul : ne pas transformer une fourchette inconnue en gratuité.
 const price=o.price===null||o.price===undefined||String(o.price).trim()===""?null:Number(o.price);
 if(price!==null&&(!Number.isFinite(price)||price<0))throw new Error("Prix invalide.");
 return {reference:String(o.reference||""),name:String(o.name||o.reference||"Article"),quantity,perPurchase,
 price,currency:String(o.currency||"jetons"),
 notes:String(o.notes||"")};
}
export async function setMerchantRole(actorValue,enabled){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 state.enabled=!!enabled;await actor.setFlag(NS,FLAG,state);return clone(state);
}
export function getMerchant(actorValue){return merchantState(actorOf(actorValue));}
export async function setValueBarterEnabled(actorValue,enabled){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 state.paymentMode=enabled===true?(state.paymentMode||"resources-only"):null;
 state.valueBarterEnabled=enabled===true;await actor.setFlag(NS,FLAG,state);return clone(state);
}
export async function setPaymentMode(actorValue,mode){
 ensureGM();
 if(!PAYMENT_MODES.includes(mode))throw new Error("Mode de paiement marchand invalide.");
 const actor=actorOf(actorValue),state=merchantState(actor);
 state.paymentMode=mode;state.valueBarterEnabled=true;
 await actor.setFlag(NS,FLAG,state);return clone(state);
}
export async function assignMerchantBuyer(actorValue,buyerValue){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 const buyer=buyerValue?actorOf(buyerValue):null;
 if(buyer&&buyer.id===actor.id)throw new Error("Le vendeur ne peut pas être son propre acheteur.");
 state.buyerId=buyer?.id||null;await actor.setFlag(NS,FLAG,state);return clone(state);
}
export async function setMerchantOffers(actorValue,offers){
 ensureGM();if(!Array.isArray(offers))throw new Error("Liste d'offres attendue.");
 const actor=actorOf(actorValue),state=merchantState(actor);
 state.offers=offers.map(normalizeOffer);await actor.setFlag(NS,FLAG,state);return clone(state);
}
export async function importCatalogueStock(actorValue,key="longue-corde-senn-p03"){
 ensureGM();const catalogue=game.h0dCatalogue;
 if(!catalogue?.getStockResolved)throw new Error("H0D Catalogue doit être activé.");
 await catalogue.whenReady?.();
 const stock=catalogue.getStockResolved(key);
 if(!stock)throw new Error("Stock du catalogue introuvable : "+key);
 const offers=stock.offres.map(o=>({
   reference:o.reference,name:o.nom_pour_la_scene||o.objet?.name||o.reference,
   // Une quantité absente devient un exemplaire, sans modifier les quantités explicites.
   quantity:Number.isSafeInteger(o.quantite_disponible)&&o.quantite_disponible>=0?o.quantite_disponible:1,
   perPurchase:Number.isSafeInteger(o.quantite_par_achat)&&o.quantite_par_achat>0?o.quantite_par_achat:1,
   price:typeof o.prix_jetons==="number"?o.prix_jetons:null,currency:"jetons",notes:o.notes||""
 }));
 const actor=actorOf(actorValue),state=merchantState(actor);
 state.enabled=true;state.offers=offers;state.stockKey=key;
 // Import volontaire de Senn : jetons prioritaires ; aucune migration implicite des anciens stocks.
 state.paymentMode="tokens-first";state.valueBarterEnabled=true;
 await actor.setFlag(NS,FLAG,state);return clone(state);
}

function readNumber(value,label){
 if(value===undefined||value===null||String(value).trim()==="")return null;
 const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(label+" doit être un nombre positif.");
 return n;
}
function readOffers(form,allOffers){
 const result=[];
 for(let i=0;i<allOffers.length;i++){
  if(form["remove_"+i]===true||form["remove_"+i]==="on")continue;
  const original=allOffers[i];
  const quantity=readNumber(form["quantity_"+i],"Quantité")??1;
  if(!Number.isSafeInteger(quantity))throw new Error("Quantité entière attendue.");
  result.push({reference:original.reference,
   name:String(form["name_"+i]||original.name),
   quantity,perPurchase:original.perPurchase||1,
   price:readNumber(form["price_"+i],"Prix"),
   currency:String(form["currency_"+i]||"jetons"),
   notes:String(form["notes_"+i]||"")});
 }
 return result;
}
export async function openMerchant(actorValue){
 ensureGM();
 if(game.modules?.get("h0d-catalogue")?.active)await game.h0dCatalogue?.whenReady?.();
 const actor=actorOf(actorValue),state=merchantState(actor);
 const selector=merchantCatalogueDefinitions(game);
 const builderDefinitions=selector.definitions.sort((a,b)=>a.name.localeCompare(b.name,"fr"));
 const categoryLabels={weapon:"Armes",armor:"Armures",ammo:"Munitions",ammunition:"Munitions",object:"Objets",resource:"Ressources"};
 const grouped=new Map();
 for(const def of builderDefinitions){
  const kind=String(def.kind||"autre").toLowerCase();
  const label=categoryLabels[kind]||("Autres — "+kind);
  if(!grouped.has(label))grouped.set(label,[]);
  grouped.get(label).push(def);
 }
 const categoryOrder=["Armes","Armures","Munitions","Objets","Ressources"];
 const builderOptions=Array.from(grouped.entries()).sort((a,b)=>{
  const ai=categoryOrder.indexOf(a[0]),bi=categoryOrder.indexOf(b[0]);
  return (ai<0?99:ai)-(bi<0?99:bi)||a[0].localeCompare(b[0],"fr");
 }).map(([label,defs])=>`<optgroup label="${esc(label)}">${defs.map(d=>`<option value="${esc(d.key)}">${esc(d.name)}</option>`).join("")}</optgroup>`).join("");
 const drafts=[];
 const content=merchantEditorContent({actorName:actor.name,state,catalogueSource:selector.source,
   builderOptions,builderAvailable:builderDefinitions.length>0});
 const choice=await foundry.applications.api.DialogV2.input({
  window:{title:"H0D — Stock marchand : "+actor.name,resizable:true},
  position:{width:925,height:715},
  content,
  render:(_event,dialog)=>{
   dialog.element?.classList.add("h0d-merchant-window");
   bindMerchantEditor(dialog,{state,definitions:builderDefinitions,drafts,
    notify:message=>ui.notifications.warn("H0D : "+message),
    importSenn:async currentDialog=>{
     const yes=await foundry.applications.api.DialogV2.confirm({
      window:{title:"Remplacer entièrement le stock ?"},
      content:"<p>Toutes les offres actuelles seront remplacées par le stock canonique de Senn.</p>"+
       "<p><strong>Les modifications non enregistrées de cette fenêtre seront perdues.</strong>"+
       " Les données déjà sauvegardées seront remplacées après confirmation.</p>"
     });
     if(!yes)return;
     try{
      await importCatalogueStock(actor);
      ui.notifications.info("H0D : stock de Senn importé pour "+actor.name);
      await currentDialog.close();
      actor.sheet?.render?.(true);
     }catch(error){
      ui.notifications.error("H0D : import impossible : "+String(error?.message||error));
     }
    }
   });
  },
  ok:{label:"Enregistrer",icon:"fa-solid fa-floppy-disk"}
 });
 if(!choice)return null;
 // Validation complète des anciennes et nouvelles lignes avant toute écriture.
 // Un seul setFlag : pas de mise à jour partielle du mode, du rôle ou des offres.
 const allOffers=[...state.offers,...drafts];
 const offers=readOffers(choice,allOffers).map(normalizeOffer);
 const mode=String(choice.paymentMode||"resources-only");
 if(!PAYMENT_MODES.includes(mode))throw new Error("Mode de paiement marchand invalide.");
 const next={...merchantState(actor),offers,
   enabled:choice.enabled===true||choice.enabled==="on",
   paymentMode:mode,valueBarterEnabled:true};
 // buyerId et toutes les autres métadonnées historiques restent inchangés.
 await actor.setFlag(NS,FLAG,next);
 if(choice.publishAfterSave===true||choice.publishAfterSave==="on")
  await publishMerchant(actor);
 actor.sheet?.render?.(true);
 ui.notifications.info("H0D : stock marchand enregistré pour "+actor.name);
 return getMerchant(actor);
}
// La vitrine est une copie publique du stock au moment de sa publication.
// Aucun accès aux données de l'Actor marchand n'est accordé aux joueurs.
export async function publishMerchant(actorValue){
 ensureGM();
 const actor=actorOf(actorValue),state=merchantState(actor);
 if(!state.enabled)throw new Error("Active le rôle Marchand avant de publier.");
 const rows=state.offers.map(o=>`<tr><td>${esc(o.name)}</td><td>${o.quantity===null?"Non précisée":esc(o.quantity)}</td><td>${o.price===null?"À définir":esc(o.price+" "+o.currency)}</td></tr>`).join("");
 const content=`<section class="h0d-merchant-public"><h2>Étal de ${esc(actor.name)}</h2>
 <p>Offres consultables — troc via le token du vendeur si le troc automatique est activé.</p>
 <table><thead><tr><th>Marchandise</th><th>Quantité</th><th>Prix</th></tr></thead>
 <tbody>${rows||'<tr><td colspan="3">Aucune marchandise disponible</td></tr>'}</tbody></table>
 <p><small>Vitrine publiée à cet instant ; les modifications ultérieures du stock ne la mettent pas à jour automatiquement.</small></p></section>`;
 return ChatMessage.create({content,speaker:{alias:actor.name},flags:{[NS]:{merchantPublic:true}}});
}
// Intégration non destructive à la fenêtre Actor CSB, sans toucher au template.
export function installMerchantSheetButton(app,html){
 if(!game.user?.isGM)return;
 const actor=app?.actor||app?.document;
 if(actor?.documentName!=="Actor"||!merchantState(actor).enabled)return;
 const root=app?.element instanceof HTMLElement?app.element:(typeof HTMLElement!=="undefined"&&html instanceof HTMLElement?html:html?.[0]);
 if(!root||root.querySelector("[data-h0d-merchant-sheet]"))return;
 const header=root.querySelector(".window-header");
 if(!header)return;
 const button=document.createElement("button");
 button.type="button";button.dataset.h0dMerchantSheet="1";
 button.className="header-control";button.title="H0D — Stock marchand (hors encombrement)";
 button.innerHTML='<i class="fa-solid fa-store"></i><span class="sr-only">Stock marchand</span>';
 button.addEventListener("click",()=>openMerchant(actor).catch(e=>ui.notifications.error(e.message)));
 header.insertBefore(button,header.querySelector(".window-close")||null);
}
export const merchantAPI={getMerchant,setMerchantRole,setValueBarterEnabled,setPaymentMode,assignMerchantBuyer,setMerchantOffers,importCatalogueStock,openMerchant,publishMerchant};
