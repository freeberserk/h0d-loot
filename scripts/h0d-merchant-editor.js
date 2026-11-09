// H0D Commerce — présentation et interactions de l'éditeur de stock.
// Ce module ne modifie jamais un Actor. Les écritures passent par h0d-merchant.js.
const esc=value=>foundry.utils.escapeHTML(String(value??""));
const cleanText=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const priceLabel=offer=>offer.price===null||offer.price===undefined||String(offer.price)===""
  ?"Prix à définir":String(offer.price)+" "+String(offer.currency||"jetons");
const offerCount=(offers)=>offers.filter(Boolean).length;

export function merchantEditorRows(offers,startIndex=0){
 return offers.map((offer,index)=>{
   const i=startIndex+index;
   const quantity=offer.quantity??1;
   const notes=offer.notes||"";
   const pack=Number(offer.perPurchase)>1?"Lot de "+offer.perPurchase+" unités":"";
   return `<article class="h0d-merchant-offer" data-h0d-offer-index="${i}">
     <div class="h0d-merchant-offer-summary">
       <div class="h0d-merchant-offer-copy">
         <strong data-h0d-preview-name>${esc(offer.name)}</strong>
         <small data-h0d-preview-note>${esc(notes)}</small>
         ${pack?'<span class="h0d-merchant-pack">'+esc(pack)+"</span>":""}
       </div>
       <span class="h0d-merchant-quantity">Stock : <b data-h0d-preview-quantity>${esc(quantity)}</b></span>
       <strong class="h0d-merchant-price" data-h0d-preview-price>${esc(priceLabel(offer))}</strong>
       <div class="h0d-merchant-offer-actions">
         <button type="button" data-h0d-offer-action="edit" title="Modifier cette offre" aria-label="Modifier ${esc(offer.name)}"><i class="fa-solid fa-pen"></i></button>
         <button type="button" data-h0d-offer-action="duplicate" title="Dupliquer cette offre" aria-label="Dupliquer ${esc(offer.name)}"><i class="fa-solid fa-copy"></i></button>
         <button type="button" data-h0d-offer-action="remove" title="Supprimer cette offre (annulable)" aria-label="Supprimer ${esc(offer.name)}"><i class="fa-solid fa-trash"></i></button>
       </div>
     </div>
     <div class="h0d-merchant-offer-edit" data-h0d-edit hidden>
       <label>Nom de la marchandise<input name="name_${i}" value="${esc(offer.name)}"></label>
       <div class="h0d-merchant-offer-fields">
         <label>Quantité<input type="number" name="quantity_${i}" min="0" step="1" value="${esc(quantity)}" placeholder="1"></label>
         <label>Prix<input type="number" name="price_${i}" min="0" step="any" value="${offer.price===null||offer.price===undefined?"":esc(offer.price)}" placeholder="À définir"></label>
         <label>Monnaie<input name="currency_${i}" value="${esc(offer.currency||"jetons")}"></label>
       </div>
       <label>Note / description<textarea name="notes_${i}" rows="2">${esc(notes)}</textarea></label>
       <small>Référence : ${esc(offer.reference||"aucune")} · Conditionnement : ${esc(offer.perPurchase||1)} unité(s) par achat</small>
     </div>
     <input type="checkbox" name="remove_${i}" class="h0d-merchant-remove-flag" tabindex="-1" aria-hidden="true">
   </article>`;
 }).join("");
}

export function merchantEditorContent({actorName,state,catalogueSource,builderOptions,builderAvailable}){
 const count=offerCount(state.offers||[]);
 const selection=state.paymentMode==="tokens-first"?"tokens-first":"resources-only";
 return `<div class="h0d-merchant-editor" data-h0d-merchant-editor>
   <header class="h0d-merchant-heading">
     <div><h2><i class="fa-solid fa-store"></i> ${esc(actorName)}</h2>
       <small>Gestion du stock marchand · Hors encombrement des PJ</small></div>
     <span class="h0d-merchant-activity" data-h0d-merchant-activity>
       ${state.enabled?"● Marchand actif":"○ Marchand inactif"}
     </span>
   </header>
   <nav class="h0d-merchant-tabs" aria-label="Sections du marchand">
     <button type="button" class="active" data-h0d-merchant-tab="stock" aria-selected="true"><i class="fa-solid fa-boxes-stacked"></i> Stock et marchandises</button>
     <button type="button" data-h0d-merchant-tab="config" aria-selected="false"><i class="fa-solid fa-sliders"></i> Configuration</button>
   </nav>
   <section data-h0d-merchant-panel="stock" class="h0d-merchant-panel">
     <div class="h0d-merchant-toolbar">
       <div class="h0d-merchant-stock-heading"><h3>Marchandises <span data-h0d-merchant-count>${count}</span></h3>
         <small>Les prix non renseignés ne sont pas des articles gratuits.</small></div>
       <button type="button" data-h0d-merchant-action="toggle-add"><i class="fa-solid fa-plus"></i> Ajouter un article</button>
     </div>
     <div class="h0d-merchant-add-panel" data-h0d-add-panel hidden>
       <div class="h0d-merchant-add-heading"><strong>Ajouter une marchandise</strong>
         <button type="button" data-h0d-merchant-action="toggle-add" title="Fermer l'ajout"><i class="fa-solid fa-xmark"></i></button></div>
       <div class="h0d-merchant-add-tabs">
         <button type="button" class="active" data-h0d-add-tab="catalogue">Depuis le Catalogue</button>
         <button type="button" data-h0d-add-tab="manual">Saisie rapide par référence</button>
       </div>
       <div data-h0d-add-panel-kind="catalogue">
         <label>Référence de ${esc(catalogueSource)}
           <select data-h0d-add-reference aria-label="Article du catalogue">
             <option value="">— Choisir une référence —</option>${builderOptions}</select>
         </label>
       </div>
       <div data-h0d-add-panel-kind="manual" hidden>
         <label>Clé exacte de la référence H0D
           <input data-h0d-add-manual-reference placeholder="Ex. : reference-de-catalogue" autocomplete="off"></label>
         <small>La référence doit exister dans H0D Catalogue / Equipment Builder. Un article sans référence ne pourra pas être livré au PJ.</small>
       </div>
       <div class="h0d-merchant-add-fields">
         <label>Quantité<input data-h0d-add-quantity type="number" min="0" step="1" value="1"></label>
         <label>Prix<input data-h0d-add-price type="number" min="0" step="any" placeholder="À définir"></label>
         <label>Monnaie<input data-h0d-add-currency value="jetons"></label>
       </div>
       <label>Nom personnalisé (facultatif)<input data-h0d-add-name placeholder="Laisser vide pour le nom canonique"></label>
       <label>Note (facultative)<textarea data-h0d-add-note rows="2"></textarea></label>
       <button type="button" data-h0d-merchant-action="add" ${builderAvailable?"":"disabled"}><i class="fa-solid fa-plus"></i> Ajouter au stock</button>
       ${builderAvailable?"":"<small>H0D Catalogue ou Equipment Builder est indisponible : ajout désactivé.</small>"}
     </div>
     <label class="h0d-merchant-filter"><i class="fa-solid fa-magnifying-glass"></i>
       <input type="search" data-h0d-merchant-search placeholder="Rechercher une marchandise…" autocomplete="off"></label>
     <div class="h0d-merchant-offer-list" data-h0d-merchant-rows>
       ${merchantEditorRows(state.offers||[])}
     </div>
     <p class="h0d-merchant-no-results" data-h0d-merchant-no-results hidden>Aucune marchandise ne correspond à cette recherche.</p>
   </section>
   <section data-h0d-merchant-panel="config" class="h0d-merchant-panel" hidden>
     <div class="h0d-merchant-setting">
       <div><strong>Rôle marchand</strong><small>Ce personnage ou conteneur propose un stock commercial aux PJ.</small></div>
       <input type="checkbox" name="enabled" data-h0d-merchant-enabled ${state.enabled?"checked":""} aria-label="Activer le rôle marchand">
     </div>
     <fieldset class="h0d-merchant-payment">
       <legend>Mode de paiement</legend>
       <label><input type="radio" name="paymentMode" value="resources-only" ${selection==="resources-only"?"checked":""}>
         Ressources uniquement</label>
       <label><input type="radio" name="paymentMode" value="tokens-first" ${selection==="tokens-first"?"checked":""}>
         Jetons de Reconnaissance prioritaires, puis ressources complémentaires</label>
       <p>Les prix ne changent pas. Les ressources sont valorisées à partir de leurs fiches, selon les règles existantes.</p>
     </fieldset>
     <div class="h0d-merchant-legacy-info">
       <strong>Association du marchand</strong>
       <p>La liaison Coffre ↔ Marchand sera ajoutée séparément. L'ancienne association « Fiche acheteur » est conservée dans les données sans être modifiée ici.</p>
     </div>
     <fieldset class="h0d-merchant-import">
       <legend>Gestion exceptionnelle du stock</legend>
       <p>Remplacer entièrement le stock par les offres canoniques de Senn. Les modifications non enregistrées dans cette fenêtre seront perdues.</p>
       <button type="button" data-h0d-merchant-action="import"><i class="fa-solid fa-rotate"></i> Remplacer par le stock de Senn</button>
     </fieldset>
   </section>
   <footer class="h0d-merchant-editor-footer">
     <label><input type="checkbox" name="publishAfterSave"> Publier aussi la vitrine aux joueurs</label>
     <small>Les modifications ne sont appliquées qu'après « Enregistrer ».</small>
   </footer>
 </div>`;
}

// Mutations du formulaire uniquement, aucune écriture sur l'Actor.
// "drafts" est utilisé exclusivement au moment de valider le formulaire.
export function bindMerchantEditor(dialog,{state,definitions,drafts,importSenn,notify}){
 const root=dialog.element?.querySelector("[data-h0d-merchant-editor]");
 if(!root)return;
 const rows=root.querySelector("[data-h0d-merchant-rows]");
 const find=selector=>root.querySelector(selector);
 const all=selector=>Array.from(root.querySelectorAll(selector));
 let mode="catalogue";
 const normalizedKey=value=>cleanText(value).trim();
 const updateStats=()=>{
   const query=cleanText(find("[data-h0d-merchant-search]")?.value||"").trim();
   let shown=0,active=0;
   for(const row of all("[data-h0d-offer-index]")){
     const removed=Boolean(row.querySelector(".h0d-merchant-remove-flag")?.checked);
     if(!removed)active++;
     const visible=!query||cleanText(row.querySelector('[name^="name_"]')?.value||"").includes(query)
       ||cleanText(row.querySelector('[name^="notes_"]')?.value||"").includes(query);
     row.hidden=!visible;
     if(visible)shown++;
   }
   find("[data-h0d-merchant-count]").textContent=String(active);
   find("[data-h0d-merchant-no-results]").hidden=shown>0;
 };
 const syncPreview=row=>{
   const field=name=>row.querySelector('[name^="'+name+'_"]');
   const name=field("name")?.value||"Article";
   const notes=field("notes")?.value||"";
   const qty=field("quantity")?.value;
   const price=field("price")?.value;
   const currency=field("currency")?.value||"jetons";
   row.querySelector("[data-h0d-preview-name]").textContent=name;
   row.querySelector("[data-h0d-preview-note]").textContent=notes;
   row.querySelector("[data-h0d-preview-quantity]").textContent=qty===""?"1":qty;
   row.querySelector("[data-h0d-preview-price]").textContent=price===""?"Prix à définir":price+" "+currency;
 };
 const appendDraft=draft=>{
   const index=state.offers.length+drafts.length;
   drafts.push(draft);
   rows.insertAdjacentHTML("beforeend",merchantEditorRows([draft],index));
   updateStats();
   const row=rows.querySelector('[data-h0d-offer-index="'+index+'"]');
   const editor=row?.querySelector("[data-h0d-edit]");
   if(editor)editor.hidden=false;
   row?.scrollIntoView?.({behavior:"smooth",block:"nearest"});
 };
 const getFromRow=row=>{
   const read=n=>row.querySelector('[name^="'+n+'_"]')?.value;
   const idx=Number(row.dataset.h0dOfferIndex);
   const original=idx<state.offers.length?state.offers[idx]:drafts[idx-state.offers.length];
   return {
     ...original,name:read("name")||original?.name,
     quantity:read("quantity")===""?1:read("quantity"),
     price:read("price")===""?null:read("price"),
     currency:read("currency")||"jetons",notes:read("notes")||""
   };
 };
 const selectTab=tab=>{
   for(const button of all("[data-h0d-merchant-tab]")){
     const active=button.dataset.h0dMerchantTab===tab;
     button.classList.toggle("active",active);
     button.setAttribute("aria-selected",String(active));
   }
   for(const panel of all("[data-h0d-merchant-panel]"))
     panel.hidden=panel.dataset.h0dMerchantPanel!==tab;
 };
 const selectAddMode=next=>{
   mode=next;
   for(const button of all("[data-h0d-add-tab]"))
     button.classList.toggle("active",button.dataset.h0dAddTab===mode);
   for(const panel of all("[data-h0d-add-panel-kind]"))
     panel.hidden=panel.dataset.h0dAddPanelKind!==mode;
 };
 root.addEventListener("click",async event=>{
   const tab=event.target.closest("[data-h0d-merchant-tab]");
   if(tab){event.preventDefault();selectTab(tab.dataset.h0dMerchantTab);return;}
   const addTab=event.target.closest("[data-h0d-add-tab]");
   if(addTab){event.preventDefault();selectAddMode(addTab.dataset.h0dAddTab);return;}
   const offerAction=event.target.closest("[data-h0d-offer-action]");
   if(offerAction){
     event.preventDefault();
     const row=offerAction.closest("[data-h0d-offer-index]");
     if(!row)return;
     const type=offerAction.dataset.h0dOfferAction;
     if(type==="edit"){
       const editor=row.querySelector("[data-h0d-edit]");
       editor.hidden=!editor.hidden;
     }else if(type==="duplicate")appendDraft(getFromRow(row));
     else if(type==="remove"){
       const input=row.querySelector(".h0d-merchant-remove-flag");
       input.checked=!input.checked;
       row.classList.toggle("is-removed",input.checked);
       offerAction.title=input.checked?"Annuler la suppression":"Supprimer cette offre";
       offerAction.innerHTML=input.checked?'<i class="fa-solid fa-rotate-left"></i>':'<i class="fa-solid fa-trash"></i>';
       updateStats();
     }
     return;
   }
   const action=event.target.closest("[data-h0d-merchant-action]")?.dataset.h0dMerchantAction;
   if(!action)return;
   event.preventDefault();
   if(action==="toggle-add"){
     const panel=find("[data-h0d-add-panel]");
     panel.hidden=!panel.hidden;
   }else if(action==="add"){
     const key=String((mode==="catalogue"
       ?find("[data-h0d-add-reference]"):find("[data-h0d-add-manual-reference]"))?.value||"").trim();
     const definition=definitions.find(d=>d.key===key);
     if(!definition){
       notify("Choisis une référence exacte du Catalogue ou du Builder avant d'ajouter.");
       return;
     }
     const rawQty=find("[data-h0d-add-quantity]").value.trim()||"1";
     const rawPrice=find("[data-h0d-add-price]").value.trim();
     const quantity=Number(rawQty),price=rawPrice===""?null:Number(rawPrice);
     if(!Number.isSafeInteger(quantity)||quantity<0||(
       price!==null&&(!Number.isFinite(price)||price<0))){
       notify("La quantité doit être entière et le prix positif ou non renseigné.");
       return;
     }
     appendDraft({reference:definition.key,name:find("[data-h0d-add-name]").value.trim()||definition.name,
       quantity,perPurchase:1,price,currency:find("[data-h0d-add-currency]").value.trim()||"jetons",
       notes:find("[data-h0d-add-note]").value.trim()||"Référence de l’inventaire commun H0D"});
     find("[data-h0d-add-reference]").value="";
     find("[data-h0d-add-manual-reference]").value="";
     find("[data-h0d-add-name]").value="";
     find("[data-h0d-add-quantity]").value="1";
     find("[data-h0d-add-price]").value="";
     find("[data-h0d-add-note]").value="";
   }else if(action==="import"){
     await importSenn(dialog);
   }
 });
 root.addEventListener("input",event=>{
   const row=event.target.closest("[data-h0d-offer-index]");
   if(row)syncPreview(row);
   if(row||event.target.matches("[data-h0d-merchant-search]"))updateStats();
 });
 root.addEventListener("change",event=>{
   if(event.target.matches("[data-h0d-merchant-enabled]")){
     const enabled=event.target.checked;
     find("[data-h0d-merchant-activity]").textContent=enabled?"● Marchand actif":"○ Marchand inactif";
   }
 });
 updateStats();
}
