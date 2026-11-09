/**
 * H0D — valorisation de troc explicitement choisie par le MJ pour chaque vendeur.
 * Les champs "Valeur / troc" et "Valeur unitaire" sont lus, jamais modifiés.
 * Ne pas extrapoler de valeur pour les armes, armures ou articles sans cotation.
 */
export const VALUED_ITEM_TEMPLATES=Object.freeze({
  "H0DObjTpl0000001":{value:"H0D_Objet_Valeur",quantity:"H0D_Objet_Quantite"},
  "H0DResTpl0000001":{value:"H0D_Ressource_Valeur_Unitaire",quantity:"H0D_Ressource_Quantite"}
});
const positiveInteger=value=>{
  if(value===null||value===undefined||String(value).trim()==="")return null;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>=0?number:null;
};
export function barterItemDetails(item){
  const key=item?.system?.template;
  const cfg=VALUED_ITEM_TEMPLATES[key];
  if(!cfg)return null;
  const props=item?.system?.props||{};
  const value=positiveInteger(props[cfg.value]),quantity=positiveInteger(props[cfg.quantity]);
  if(value===null||value<=0||quantity===null||quantity<1)return null;
  return {id:item.id,name:String(item.name||"Article"),value,quantity,quantityField:cfg.quantity};
}
export function barterQuote(actor,selection,price){
  if(!Array.isArray(selection))throw new Error("Sélection de troc invalide.");
  if(!Number.isSafeInteger(price)||price<0)throw new Error("Prix de troc invalide.");
  const seen=new Set(),lines=[];
  let total=0;
  for(const chosen of selection){
    const id=String(chosen?.itemId||"");
    const qty=positiveInteger(chosen?.quantity);
    if(!id||seen.has(id)||qty===null||qty<1)throw new Error("Lignes de troc dupliquées ou invalides.");
    seen.add(id);
    const item=actor?.items?.get?.(id)??actor?.items?.find?.(i=>i.id===id);
    const details=barterItemDetails(item);
    if(!details||qty>details.quantity)throw new Error("La ressource proposée est indisponible ou insuffisante.");
    const lineValue=qty*details.value;
    if(!Number.isSafeInteger(lineValue)||!Number.isSafeInteger(total+lineValue))throw new Error("Valeur de troc excessive.");
    total+=lineValue;
    lines.push({item,details,quantity:qty,value:lineValue});
  }
  if(price>0&&!lines.length)throw new Error("Aucune ressource proposée en troc.");
  if(total<price)throw new Error("Troc insuffisant : "+total+" pour un prix de "+price+".");
  return {price,total,overpay:total-price,lines};
}
