/**
 * Liaison optionnelle Coffre → Actor marchand.
 * Le stock lié reste UNIQUEMENT dans le flag merchant de l'Actor marchand.
 * Un ancien coffre non lié n'est jamais migré automatiquement.
 */
export const LINKED_MERCHANT_FLAG="linkedMerchantUuid";
const NS="h0d-loot",CONTAINER_ID="H0DContActor0001";
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
export const isContainerActor=actor=>!!actor&&
  (actor.system?.template===CONTAINER_ID||own(actor.system?.props,"H0D_Conteneur_Mode"));
export function linkedMerchantUuid(actor){
  return String(actor?.getFlag?.(NS,LINKED_MERCHANT_FLAG)??actor?.flags?.[NS]?.[LINKED_MERCHANT_FLAG]??"").trim();
}
const worldActors=()=>Array.from(game.actors?.contents||[]);
export function resolveMerchantStockOwner(source,actors=worldActors()){
  if(!source||source.documentName!=="Actor")throw new Error("Actor de conteneur introuvable.");
  const uuid=linkedMerchantUuid(source);
  if(!uuid)return {source,owner:source,linked:false,merchantUuid:null};
  if(!isContainerActor(source))throw new Error("Seuls les coffres/Conteneurs H0D peuvent associer un marchand.");
  const matches=actors.filter(a=>a?.uuid===uuid&&a.documentName==="Actor");
  if(matches.length!==1)throw new Error("Le marchand associé est introuvable dans ce monde : "+uuid+". Vérifie la liaison côté MJ.");
  const owner=matches[0];
  if(owner.id===source.id||isContainerActor(owner)||linkedMerchantUuid(owner))
    throw new Error("Association marchande invalide : le marchand doit être un Actor distinct, non conteneur et sans autre liaison.");
  if(owner.getFlag?.(NS,"merchant")?.enabled!==true)
    throw new Error("Le rôle Marchand est désactivé pour "+owner.name+". Réactive-le ou modifie la liaison.");
  return {source,owner,linked:true,merchantUuid:uuid};
}
export function eligibleMerchantActors(source,actors=worldActors()){
  return actors.filter(actor=>actor?.documentName==="Actor"&&actor.id!==source?.id&&
    !isContainerActor(actor)&&!linkedMerchantUuid(actor)&&
    actor.getFlag?.(NS,"merchant")?.enabled===true);
}
export async function assignContainerMerchant(source,uuid,{transferLegacyStock=false}={}){
  if(!game.user?.isGM)throw new Error("Association des marchands réservée au MJ.");
  if(!isContainerActor(source))throw new Error("Sélectionne un coffre avec le template Conteneur H0D.");
  const nextUuid=String(uuid||"").trim();
  const currentUuid=linkedMerchantUuid(source);
  if(nextUuid===currentUuid){
    if(nextUuid)resolveMerchantStockOwner(source);
    return {changed:false,linked:!!nextUuid,transferred:false};
  }
  if(!nextUuid){
    if(transferLegacyStock)throw new Error("Aucun marchand n'est sélectionné pour le transfert.");
    await source.setFlag(NS,LINKED_MERCHANT_FLAG,"");
    return {changed:true,linked:false,transferred:false};
  }
  const candidates=eligibleMerchantActors(source);
  const target=candidates.find(actor=>actor.uuid===nextUuid);
  if(!target)throw new Error("Le marchand choisi est absent, inactif ou n'est pas autorisé.");
  const previous=foundry.utils.deepClone(target.getFlag(NS,"merchant")||{});
  const local=foundry.utils.deepClone(source.getFlag(NS,"merchant")||{});
  const oldOffers=Array.isArray(local.offers)?local.offers:[];
  const targetOffers=Array.isArray(previous.offers)?previous.offers:[];
  const oldReceipts=Array.isArray(local.barterReceipts)?local.barterReceipts:[];
  const targetReceipts=Array.isArray(previous.barterReceipts)?previous.barterReceipts:[];
  if(transferLegacyStock){
    if(!oldOffers.length)throw new Error("Le coffre ne possède aucun stock local à transférer.");
    if(targetOffers.length||targetReceipts.length)
      throw new Error("Le marchand possède déjà un stock ou un historique. Transfert bloqué pour éviter un écrasement.");
    const replacement={...previous,offers:oldOffers,
      stockKey:local.stockKey??previous.stockKey??null,
      paymentMode:local.paymentMode??previous.paymentMode??null,
      valueBarterEnabled:local.valueBarterEnabled??previous.valueBarterEnabled??false,
      barterReceipts:oldReceipts};
    // Le marchand était déjà actif : ne pas toucher à son statut ni à ses autres flags.
    await target.setFlag(NS,"merchant",replacement);
  }
  try{
    await source.setFlag(NS,LINKED_MERCHANT_FLAG,nextUuid);
  }catch(error){
    if(transferLegacyStock)try{await target.setFlag(NS,"merchant",previous);}
    catch(rollbackError){
      console.error("H0D Loot — restauration du marchand après échec de liaison",rollbackError);
      throw new Error("L'association a échoué et le stock du marchand nécessite une vérification manuelle. "+String(error?.message||error));
    }
    throw error;
  }
  return {changed:true,linked:true,merchant:target,transferred:transferLegacyStock};
}

const esc=value=>foundry.utils.escapeHTML(String(value??""));
export async function openMerchantLinkDialog(source){
  if(!game.user?.isGM)throw new Error("Association réservée au MJ.");
  if(!isContainerActor(source))throw new Error("Seul un coffre H0D peut être associé à un marchand.");
  const options=eligibleMerchantActors(source);
  const current=linkedMerchantUuid(source);
  const missingCurrent=current&&!options.some(actor=>actor.uuid===current);
  const local=foundry.utils.deepClone(source.getFlag(NS,"merchant")||{});
  const localOffers=Array.isArray(local.offers)?local.offers:[];
  const definitions=options.map(actor=>{
    const merchant=actor.getFlag(NS,"merchant")||{};
    return {uuid:actor.uuid,name:actor.name,
      stock:Array.isArray(merchant.offers)?merchant.offers.length:0,
      receipts:Array.isArray(merchant.barterReceipts)?merchant.barterReceipts.length:0};
  });
  // DialogV2.input refuse tout attribut sur l'élément content lui-même.
  // Le style doit être porté par un enfant, pas par le conteneur transmis.
  const content=document.createElement("div");
  content.innerHTML=`<div class="h0d-merchant-link-dialog"><p>Ce coffre est un <strong>point d'interaction</strong> : le stock, les prix et les paiements seront gérés sur l'Actor marchand associé.</p>
    <label><strong>Marchand associé</strong>
      <select name="linkedMerchantUuid">
        <option value="">— Aucun : conserver le stock du coffre —</option>
        ${missingCurrent?'<option selected value="'+esc(current)+'">Marchand actuellement introuvable : '+esc(current)+'</option>':""}
        ${definitions.map(entry=>'<option value="'+esc(entry.uuid)+'" '+(entry.uuid===current?"selected":"")+">"+
          esc(entry.name)+" ("+entry.stock+" offre(s))</option>").join("")}
      </select>
    </label>
    <p data-h0d-link-summary class="h0d-merchant-link-summary"></p>
    <label class="h0d-merchant-link-transfer"><input type="checkbox" name="transferLegacyStock">
      <span>Transférer le stock actuel de ce coffre (${localOffers.length} offre(s)) et ses paramètres de paiement au marchand choisi</span>
    </label>
    <p><small>Le transfert est autorisé uniquement si le marchand n'a aucun stock ni historique. Aucune donnée locale du coffre n'est supprimée : elle restera inactive tant que la liaison existe, pour permettre un retour en arrière.</small></p>
    <p><strong>Important :</strong> la liaison ne touche pas aux fiches PJ, aux stocks des autres marchands ni aux objets physiques. Les coffres non associés restent inchangés.</p></div>`;
  const redraw=(_event,dialog)=>{
    const root=dialog.element?.querySelector(".h0d-merchant-link-dialog");
    if(!root)return;
    const select=root.querySelector('[name="linkedMerchantUuid"]');
    const check=root.querySelector('[name="transferLegacyStock"]');
    const summary=root.querySelector("[data-h0d-link-summary]");
    const refresh=()=>{
      const chosen=definitions.find(entry=>entry.uuid===select.value);
      const possible=!!chosen&&localOffers.length>0&&chosen.stock===0&&chosen.receipts===0;
      check.disabled=!possible;
      if(!possible)check.checked=false;
      summary.textContent=!select.value?"Le coffre utilisera son stock local (historique).":
        !chosen?"Le marchand associé ne peut pas être retrouvé. Choisis un autre marchand actif.":
        "Marchand : "+chosen.name+" — "+chosen.stock+" offre(s). "+
          (possible?"Tu peux transférer les "+localOffers.length+" offres du coffre.":
            "Le stock du marchand sera utilisé sans copier les anciennes offres du coffre.");
    };
    select.addEventListener("change",refresh);
    refresh();
  };
  const choice=await foundry.applications.api.DialogV2.input({
    window:{title:"H0D — Associer un marchand à "+source.name,resizable:true},
    content,render:redraw,ok:{label:"Enregistrer l'association",icon:"fa-solid fa-link"}
  });
  if(!choice)return null;
  const uuid=String(choice.linkedMerchantUuid||"").trim();
  const transfer=choice.transferLegacyStock===true||choice.transferLegacyStock==="on";
  if(uuid===current)return {changed:false,linked:!!uuid,transferred:false};
  // Confirmation distincte : changement de source de vérité, pas une simple préférence graphique.
  const next=definitions.find(entry=>entry.uuid===uuid);
  const confirm=await foundry.applications.api.DialogV2.confirm({
    window:{title:"H0D — Confirmer la liaison"},
    content:"<p>Ce coffre utilisera désormais <strong>"+(next?esc(next.name):"son stock local")+
      "</strong> pour les achats et prélèvements.</p>"+
      (transfer?"<p><strong>Les anciennes offres du coffre seront copiées vers le marchand avant la liaison.</strong></p>":
        "<p>Les anciennes offres locales du coffre ne seront pas utilisées tant que la liaison existe.</p>")+
      "<p>Le stock existant n'est pas supprimé automatiquement.</p>"
  });
  if(!confirm)return null;
  return assignContainerMerchant(source,uuid,{transferLegacyStock:transfer});
}
