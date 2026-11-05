// H0D Commerce — Stock marchand optionnel, indépendant des Items embarqués.
// Aucun achat ni prélèvement automatique dans cette première étape.
const NS="h0d-loot", FLAG="merchant";
const clone=v=>foundry.utils.deepClone(v);
const esc=v=>foundry.utils.escapeHTML(String(v??""));
function ensureGM(){if(!game.user?.isGM)throw new Error("H0D Commerce : réservé au MJ.");}
function actorOf(value){const actor=typeof value==="string"?game.actors.get(value):value;if(!actor||actor.documentName!=="Actor")throw new Error("Actor marchand introuvable.");return actor;}
function merchantState(actor){return clone(actor.getFlag(NS,FLAG)||{enabled:false,offers:[],buyerId:null});}
function normalizeOffer(o){
 const quantity=o.quantity===null?null:Number(o.quantity);
 if(quantity!==null&&(!Number.isSafeInteger(quantity)||quantity<0))throw new Error("Quantité invalide.");
 return {reference:String(o.reference||""),name:String(o.name||o.reference||"Article"),quantity,
 price:Number.isFinite(Number(o.price))&&Number(o.price)>=0?Number(o.price):null,currency:String(o.currency||"jetons"),
 notes:String(o.notes||"")};
}
export async function setMerchantRole(actorValue,enabled){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 state.enabled=!!enabled;await actor.setFlag(NS,FLAG,state);return clone(state);
}
export function getMerchant(actorValue){return merchantState(actorOf(actorValue));}
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
   // Une quantité inconnue reste inconnue, jamais un stock illimité.
   quantity:Number.isSafeInteger(o.quantite_disponible)&&o.quantite_disponible>=0?o.quantite_disponible:null,
   price:typeof o.prix_jetons==="number"?o.prix_jetons:null,currency:"jetons",notes:o.notes||""
 }));
 const actor=actorOf(actorValue),state=merchantState(actor);
 state.enabled=true;state.offers=offers;state.stockKey=key;
 await actor.setFlag(NS,FLAG,state);return clone(state);
}

function merchantEditorRows(offers){
 return offers.map((o,i)=>`<div class="h0d-merchant-line" style="display:grid;grid-template-columns:minmax(110px,2fr) 80px 90px 90px 50px;gap:6px;align-items:center;margin-bottom:5px">
 <input aria-label="Nom" name="name_${i}" value="${esc(o.name)}" title="Article">
 <input aria-label="Quantité" name="quantity_${i}" value="${o.quantity===null?"":esc(o.quantity)}" placeholder="?" title="Quantité : vide = inconnue">
 <input aria-label="Prix" name="price_${i}" value="${o.price===null?"":esc(o.price)}" placeholder="?" title="Prix : vide = à définir">
 <input aria-label="Monnaie" name="currency_${i}" value="${esc(o.currency)}" title="Monnaie">
 <label title="Supprimer"><input type="checkbox" name="remove_${i}"> ✕</label>
 </div><input name="reference_${i}" type="hidden" value="${esc(o.reference)}">
 <input name="notes_${i}" aria-label="Notes" value="${esc(o.notes)}" placeholder="Notes (facultatif)" style="width:100%;margin-bottom:9px"> `).join("");
}
function readNumber(value,label){
 if(value===undefined||value===null||String(value).trim()==="")return null;
 const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(label+" doit être un nombre positif.");
 return n;
}
function readOffers(form,original){
 const result=[];
 for(let i=0;i<original.length;i++){
  if(form["remove_"+i]===true||form["remove_"+i]==="on")continue;
  const quantity=readNumber(form["quantity_"+i],"Quantité");
  if(quantity!==null&&!Number.isSafeInteger(quantity))throw new Error("Quantité entière attendue.");
  result.push({reference:original[i].reference,name:form["name_"+i]||original[i].name,quantity,
   price:readNumber(form["price_"+i],"Prix"),currency:form["currency_"+i]||"jetons",notes:form["notes_"+i]||""});
 }
 if(String(form.newName||"").trim()){
  const quantity=readNumber(form.newQuantity,"Quantité");
  if(quantity!==null&&!Number.isSafeInteger(quantity))throw new Error("Quantité entière attendue.");
  result.push({reference:String(form.newReference||"").trim(),name:String(form.newName).trim(),
   quantity,price:readNumber(form.newPrice,"Prix"),currency:form.newCurrency||"jetons",notes:""});
 }
 return result;
}
export async function openMerchant(actorValue){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 const buyers=game.actors.contents.filter(a=>a.id!==actor.id&&a.type!=="_template");
 const options=['<option value="">Aucun PJ associé</option>',...buyers.map(a=>`<option value="${esc(a.id)}" ${state.buyerId===a.id?"selected":""}>${esc(a.name)}</option>`)].join("");
 const choice=await foundry.applications.api.DialogV2.input({
  window:{title:"H0D — Stock marchand : "+actor.name,resizable:true},
  content:`<p>Stock commercial hors encombrement. Aucun transfert ni paiement automatique.</p>
   <div class="form-group"><label>Rôle Marchand</label><input type="checkbox" name="enabled" ${state.enabled?"checked":""}></div>
   <div class="form-group"><label>Fiche acheteur</label><select name="buyer">${options}</select></div>
   <div style="max-height:55vh;overflow-y:auto;padding:5px">
   <p><strong>Marchandises (${state.offers.length})</strong> — quantité vide = inconnue. Cocher ✕ pour retirer.</p>
   ${merchantEditorRows(state.offers)}
   <fieldset><legend>Ajouter une marchandise</legend>
   <input name="newName" placeholder="Nom de l'article" aria-label="Nouvel article">
   <input name="newReference" placeholder="Clé catalogue (facultative)" aria-label="Référence catalogue">
   <div style="display:flex;gap:6px"><input name="newQuantity" placeholder="Quantité ?" aria-label="Quantité">
   <input name="newPrice" placeholder="Prix ?" aria-label="Prix"><input name="newCurrency" value="jetons" aria-label="Monnaie"></div>
   </fieldset></div>
   <div class="form-group"><label>Action</label><select name="operation">
   <option value="save">Enregistrer les modifications</option>
   <option value="import">Remplacer par le stock Senn</option>
   </select></div>`,
  ok:{label:"Enregistrer",icon:"fa-solid fa-check"}
 });
 if(!choice)return null;
 if(choice.operation==="import"){
  const yes=await foundry.applications.api.DialogV2.confirm({window:{title:"Remplacer le stock ?"},
   content:"<p>Les offres actuelles seront remplacées par le stock de Senn. Cette action est irréversible sans sauvegarde.</p>"});
  if(!yes)return null;
  await importCatalogueStock(actor);
 }else{
  // Validation complète avant écriture pour éviter un stock partiellement modifié.
  const offers=readOffers(choice,state.offers);
  await setMerchantOffers(actor,offers);
 }
 await assignMerchantBuyer(actor,choice.buyer||null);
 await setMerchantRole(actor,choice.operation==="import"?true:choice.enabled===true||choice.enabled==="on");
 actor.sheet?.render?.(true);
 ui.notifications.info("H0D : stock marchand enregistré pour "+actor.name);
 return getMerchant(actor);
}
// Intégration non destructive à la fenêtre Actor CSB, sans toucher au template.
export function installMerchantSheetButton(app,html){
 if(!game.user?.isGM)return;
 const actor=app?.actor||app?.document;
 if(actor?.documentName!=="Actor"||!merchantState(actor).enabled)return;
 const root=typeof HTMLElement!=="undefined"&&html instanceof HTMLElement?html:html?.[0];
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
export const merchantAPI={getMerchant,setMerchantRole,assignMerchantBuyer,setMerchantOffers,importCatalogueStock,openMerchant};
