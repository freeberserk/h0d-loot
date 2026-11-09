/**
 * H0D — valorisation de troc explicitement choisie par le MJ pour chaque vendeur.
 * Les champs "Valeur / troc" et "Valeur unitaire" sont lus, jamais modifiés.
 * Ne pas extrapoler de valeur pour les armes, armures ou articles sans cotation.
 */
export const RECOGNITION_TOKEN_KEY="jeton-reconnaissance";
const RECOGNITION_TOKEN_NAME="jeton de reconnaissance";
const TOKEN_TEMPLATE_ID="H0DResTpl0000001";
const cleanName=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();

/** Une référence stable du Catalogue prime ; le type+nom couvre les anciennes fiches sans flags. */
export function isRecognitionToken(item){
  if(item?.system?.template!==TOKEN_TEMPLATE_ID)return false;
  const props=item.system?.props||{};
  const byBuilder=item.getFlag?.("h0d-equipment-builder","catalogKey")||
    item.flags?.["h0d-equipment-builder"]?.catalogKey;
  const byLoot=item.getFlag?.("h0d-loot","catalogueKey")||
    item.flags?.["h0d-loot"]?.catalogueKey||
    item.getFlag?.("h0d-loot","containerReference");
  if(byBuilder===RECOGNITION_TOKEN_KEY||byLoot===RECOGNITION_TOKEN_KEY)return true;
  return props.H0D_Ressource_Type==="Jeton"&&cleanName(item.name)===RECOGNITION_TOKEN_NAME;
}

/** Calcule un débit prioritaire, sans écrire sur les Items et sans conversion en matériaux. */
export function recognitionTokenPayment(actor,price){
  if(!Number.isSafeInteger(price)||price<0)throw new Error("Prix en jetons invalide.");
  let remaining=price;
  const lines=[];
  for(const item of Array.from(actor?.items||[])){
    if(!isRecognitionToken(item)||remaining===0)continue;
    const quantity=positiveInteger(item.system?.props?.H0D_Ressource_Quantite);
    if(quantity===null)throw new Error("Quantité de Jetons de Reconnaissance invalide.");
    const take=Math.min(quantity,remaining);
    if(take>0){
      lines.push({item,quantity:take,quantityField:"H0D_Ressource_Quantite",
        previous:item.system.props.H0D_Ressource_Quantite});
      remaining-=take;
    }
  }
  return {used:price-remaining,remaining,lines};
}

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
  if(isRecognitionToken(item))return null;
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


/**
 * Propose une offre couvrant le prix avec l'excédent minimal, puis le
 * moins d'unités possible à excédent égal.
 *
 * Programmation dynamique à quantités bornées (décomposition binaire).
 * Si les valeurs sortent de la limite de calcul, renvoyer "too-large"
 * plutôt qu'une approximation présentée comme optimale.
 * Aucun Item/Actor n'est modifié.
 */
export function bestBarterOffer(actor,price,{maxValue=30000}={}){
  if(!Number.isSafeInteger(price)||price<0)return {status:"invalid-price",selection:[]};
  if(price===0)return {status:"ok",selection:[],total:0,overpay:0,units:0};
  const entries=Array.from(actor?.items||[]).map(barterItemDetails).filter(Boolean);
  if(!entries.length)return {status:"insufficient",selection:[],maxAvailable:0};
  let available=0;
  let highest=0;
  for(const entry of entries){
    const possible=entry.value*entry.quantity;
    if(!Number.isSafeInteger(possible))return {status:"too-large",selection:[]};
    available+=possible;
    if(!Number.isSafeInteger(available))return {status:"too-large",selection:[]};
    highest=Math.max(highest,entry.value);
  }
  if(available<price)return {status:"insufficient",selection:[],maxAvailable:available};
  const cap=Math.min(available,price+highest-1);
  if(!Number.isSafeInteger(cap)||cap>maxValue)return {status:"too-large",selection:[]};

  // Chaque état mémorise un chemin persistant, afin qu'une amélioration
  // ultérieure de la DP ne modifie pas une solution déjà stockée.
  const states=Array(cap+1).fill(null);
  states[0]={units:0,path:null};
  for(let i=0;i<entries.length;i++){
    const {value,quantity}=entries[i];
    let remaining=Math.min(quantity,Math.floor(cap/value));
    let size=1;
    while(remaining>0){
      const take=Math.min(size,remaining),weight=take*value;
      for(let sum=cap;sum>=weight;sum--){
        const previous=states[sum-weight];
        if(!previous)continue;
        const units=previous.units+take;
        if(!states[sum]||units<states[sum].units)
          states[sum]={units,path:{index:i,quantity:take,previous:previous.path}};
      }
      remaining-=take;
      size*=2;
    }
  }
  let chosen=null;
  for(let sum=price;sum<=cap;sum++){
    if(states[sum]){chosen={sum,state:states[sum]};break;}
  }
  if(!chosen)return {status:"unavailable",selection:[]};
  const quantities=Array(entries.length).fill(0);
  for(let p=chosen.state.path;p;p=p.previous)quantities[p.index]+=p.quantity;
  return {
    status:"ok",
    selection:entries.flatMap((entry,i)=>quantities[i]?[{itemId:entry.id,quantity:quantities[i]}]:[]),
    total:chosen.sum,
    overpay:chosen.sum-price,
    units:chosen.state.units
  };
}
