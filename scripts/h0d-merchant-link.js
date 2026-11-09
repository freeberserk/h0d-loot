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
