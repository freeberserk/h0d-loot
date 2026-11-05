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
export async function openMerchant(actorValue){
 ensureGM();const actor=actorOf(actorValue),state=merchantState(actor);
 const buyers=game.actors.contents.filter(a=>a.id!==actor.id&&a.type!=="_template"&&a.system?.templateSystemUniqueVersion!==undefined);
 const options=['<option value="">Aucun PJ associé</option>',...buyers.map(a=>`<option value="${esc(a.id)}" ${state.buyerId===a.id?"selected":""}>${esc(a.name)}</option>`)].join("");
 const rows=state.offers.map((o,i)=>`<tr><td>${esc(o.name)}</td><td>${o.quantity===null?"Non précisée":o.quantity}</td><td>${o.price===null?"À définir":esc(o.price+" "+o.currency)}</td><td>${esc(o.notes)}</td></tr>`).join("");
 const choice=await foundry.applications.api.DialogV2.input({
   window:{title:"H0D — Stock marchand : "+actor.name,resizable:true},
   content:`<p>Stock commercial hors encombrement. Aucun transfert ni paiement automatique.</p>
     <div class="form-group"><label>Rôle Marchand</label><input type="checkbox" name="enabled" ${state.enabled?"checked":""}></div>
     <div class="form-group"><label>Fiche acheteur</label><select name="buyer">${options}</select></div>
     <div class="form-group"><label>Action</label><select name="operation">
       <option value="save">Enregistrer le rôle et l'acheteur</option>
       <option value="import">Charger le stock Senn (remplace les offres)</option>
     </select></div>
     <div style="max-height:320px;overflow:auto"><table><thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`,
   ok:{label:"Valider",icon:"fa-solid fa-check"}
 });
 if(!choice)return null;
 if(choice.operation==="import"){
   const yes=await foundry.applications.api.DialogV2.confirm({window:{title:"Remplacer le stock ?"},content:"<p>Les offres actuelles seront remplacées par le stock de Senn. Les quantités non précisées resteront inconnues.</p>"});
   if(!yes)return null;
   await importCatalogueStock(actor);
 }
 await assignMerchantBuyer(actor,choice.buyer||null);
 await setMerchantRole(actor,choice.operation==="import"?true:choice.enabled===true||choice.enabled==="on");
 ui.notifications.info("H0D : configuration marchande enregistrée pour "+actor.name);
 return getMerchant(actor);
}
export const merchantAPI={getMerchant,setMerchantRole,assignMerchantBuyer,setMerchantOffers,importCatalogueStock,openMerchant};
