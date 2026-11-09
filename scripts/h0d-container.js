import {merchantAPI} from "./h0d-merchant.js";
import {barterQuote} from "./h0d-trade.js";
import {openValueTradeDialog} from "./h0d-trade-dialog.js";

// H0D Loot — stock des conteneurs, directement sur les tokens (sans tuile).
// L'Actor conserve le stock canonique ; les cartes de chat n'en sont que des vues filtrées.
const NS = "h0d-loot";
const SOCKET = "module.h0d-loot";
const CARD_FLAG = "containerStock";
const TEMPLATE_ID = "H0DContActor0001";
const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const clone = value => foundry.utils.deepClone(value);
let helpers = null;
const pending = new Map();

export function isContainerToken(token) {
  const actor = token?.actor || token?.document?.actor;
  const props = actor?.system?.props || {};
  return actor?.system?.template === TEMPLATE_ID || Object.hasOwn(props,"H0D_Conteneur_Mode") ||
    actor?.getFlag?.(NS,"merchant")?.enabled===true;
}

function readContainer(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor || !isContainerToken({actor})) throw new Error("Ce token ne possède aucun stock H0D.");
  const state = merchantAPI.getMerchant(actor);
  const mode = actor.system?.template===TEMPLATE_ID
    ? String(actor.system?.props?.H0D_Conteneur_Mode || "Butin")
    : state.enabled?"Marchand":"Butin";
  if (mode === "Marchand" && !state.enabled) throw new Error("Le rôle Marchand est désactivé sur ce conteneur.");
  return {actor,mode,state};
}

function stockCard(tokenDoc) {
  const {actor,mode,state} = readContainer(tokenDoc);
  const builder = game.h0dEquipmentBuilder;
  const catalogue = game.h0dCatalogue;
  return {
    tokenUuid:tokenDoc.uuid,
    name:String(actor.name),
    mode,
    valueBarterEnabled:mode==="Marchand"&&state.valueBarterEnabled===true,
    offers:(state.offers || []).map((offer,index) => {
      const def = builder?.getDefinition?.(offer.reference) || catalogue?.getDefinition?.(offer.reference) || null;
      const kind = String(def?.kind || "").toLowerCase();
      const category = {weapon:"Armes",armor:"Armures",object:"Objets",resource:"Ressources",ammo:"Munitions",ammunition:"Munitions"}[kind] || "Autres";
      const numericQuantity = Number(offer.quantity);
      return {index,reference:String(offer.reference || ""),name:String(offer.name || "Article"),
        quantity:Number.isSafeInteger(numericQuantity) && numericQuantity >= 0 ? numericQuantity : 1,
        price:offer.price === null || offer.price === undefined ? null : Number(offer.price),
        currency:String(offer.currency || "jetons"),category,
        img:String(def?.img || "icons/svg/item-bag.svg")};
    })
  };
}

function renderStockCard(card) {
  const claimable = game.settings.get(NS,"playersCanClaim");
  const groups = new Map();
  for (const offer of card.offers) {
    if (!groups.has(offer.category)) groups.set(offer.category,[]);
    groups.get(offer.category).push(offer);
  }
  const sections = Array.from(groups.entries()).map(([category,offers]) => {
    const rows = offers.map(o => {
      const q = Math.max(0,o.quantity);
      const valueBarterAllowed=card.mode==="Marchand"&&card.valueBarterEnabled===true&&
        o.currency==="jetons"&&Number.isSafeInteger(o.price)&&o.price>=0;
      const actions=card.mode==="Marchand"
        ? !q?'<span class="h0d-loot-empty">épuisé</span>'
          : valueBarterAllowed&&claimable?'<span class="h0d-loot-actions"><button type="button" data-h0d-container-action="trade" data-index="'+o.index+'" title="Échanger 1 lot contre des ressources évaluées"><i class="fa-solid fa-right-left"></i> Troquer</button></span>'
          : '<span class="h0d-loot-empty">Troc indisponible</span>'
        : q&&claimable?'<span class="h0d-loot-actions">'+
          '<button type="button" data-h0d-container-action="take-one" data-index="'+o.index+'" title="Prendre 1"><i class="fa-solid fa-hand"></i> 1</button>'+
          '<button type="button" data-h0d-container-action="take-all" data-index="'+o.index+'" title="Prendre tout ce type"><i class="fa-solid fa-box"></i></button></span>'
          :(q?'':'<span class="h0d-loot-empty">épuisé</span>');
      const price = o.price === null ? 'Prix à définir' : esc(o.price) + ' ' + esc(o.currency);
      return '<div class="h0d-loot-row '+(q?'':'is-empty')+'"><img src="'+esc(o.img)+'" alt="">'+
        '<div class="h0d-loot-item"><strong>'+esc(o.name)+'</strong><small>'+price+'</small></div>'+
        '<span class="h0d-loot-qty">×'+q+'</span>'+actions+'</div>';
    }).join('');
    return '<div class="h0d-loot-group"><div class="h0d-loot-group-title">'+esc(category)+'</div>'+rows+'</div>';
  }).join('');
  const count = card.offers.reduce((sum,offer) => sum+Math.max(0,offer.quantity),0);
  const warning = card.mode === 'Marchand'
    ? '<div class="h0d-loot-warning">'+(card.valueBarterEnabled
        ? 'Troc automatique activé : le prix en jetons est payé avec des objets ou ressources dont la valeur de troc est renseignée. Aucun rendu de monnaie.'
        : 'Le vendeur n’accepte pas encore le troc automatique. Le MJ peut l’activer sur sa fiche.')+'</div>'
    : '';
  const allButton = card.mode !== 'Marchand' && claimable && count
    ? '<button type="button" class="h0d-loot-take-all" data-h0d-container-action="take-all-card"><i class="fa-solid fa-sack-dollar"></i> Tout récupérer</button>' : '';
  return '<div class="h0d-loot-card h0d-container-card">'+
    '<header><div><strong>'+esc(card.name)+'</strong><small>Conteneur · '+esc(card.mode)+'</small></div><i class="fa-solid fa-box-open"></i></header>'+
    warning+'<section>'+(sections||'<div class="h0d-loot-none">Ce conteneur ne contient aucune marchandise.</div>')+'</section>'+
    '<footer><span>Reste : <strong>'+count+'</strong></span>'+allButton+'</footer></div>';
}

async function publishCard(tokenDoc, recipientUserId=null) {
  const card = stockCard(tokenDoc);
  const whisper = recipientUserId
    ? [...new Set([recipientUserId,...game.users.filter(user=>user.isGM).map(user=>user.id)])]
    : null;
  const msg = {content:renderStockCard(card),flags:{[NS]:{[CARD_FLAG]:card}},
    speaker:ChatMessage.getSpeaker({token:tokenDoc.object || tokenDoc})};
  if (whisper) msg.whisper = whisper;
  return ChatMessage.create(msg);
}

export async function openContainerForGM(tokenDoc) {
  if (!game.user?.isGM) throw new Error("H0D : seul le MJ peut publier le stock.");
  return publishCard(tokenDoc);
}

export async function openContainerForPlayer(tokenDoc) {
  const gm = helpers?.primaryGM?.();
  if (!gm) return ui.notifications?.warn("H0D : un MJ connecté est nécessaire pour ouvrir ce coffre.");
  game.socket.emit(SOCKET,{type:"container-open",userId:game.user.id,tokenUuid:tokenDoc.uuid});
  return true;
}

async function requestContainerClaim(card,offerIndex,quantity) {
  if (!game.settings.get(NS,"playersCanClaim")) return;
  const recipient = await helpers.chooseRecipientActor();
  if (!recipient?.actor) return;
  const data = {type:"container-claim",userId:game.user.id,
    tokenUuid:card.tokenUuid,offerIndex,quantity,
    reference:offerIndex === null ? null : card.offers.find(o=>o.index===offerIndex)?.reference,
    offerName:offerIndex === null ? null : card.offers.find(o=>o.index===offerIndex)?.name,
    actorId:recipient.actor.id,actorUuid:recipient.actor.uuid || null,
    recipientTokenUuid:recipient.tokenUuid || null};
  if (helpers.isPrimaryGM()) return processClaim(data);
  if (!helpers.primaryGM()) return ui.notifications?.warn("H0D : aucun MJ actif pour sécuriser le retrait.");
  // Le MJ actif exécute silencieusement l'écriture protégée par Foundry.
  // Pas de message de "demande" : seul le résultat effectif (succès ou erreur) sera notifié.
  game.socket.emit(SOCKET,data);
}

async function requestContainerTrade(card,offerIndex) {
  if(!game.settings.get(NS,"playersCanClaim"))return;
  const offer=card.offers.find(o=>o.index===offerIndex);
  if(!offer||card.mode!=="Marchand"||card.valueBarterEnabled!==true)
    return ui.notifications?.warn("H0D : ce vendeur n'autorise pas le troc automatique.");
  if(offer.currency!=="jetons"||!Number.isSafeInteger(offer.price)||offer.price<0)
    return ui.notifications?.warn("H0D : prix non compatible avec le troc automatique.");
  const recipient=await helpers.chooseRecipientActor();
  if(!recipient?.actor)return;
  // Le dialogue ne débite rien. Il présente les valeurs en temps réel,
  // compose éventuellement une offre optimale et recueille l'accord sur un surplus.
  const result=await openValueTradeDialog({
    actor:recipient.actor,vendorName:card.name,offer
  });
  if(!result)return;
  const {barterItems,ackOverpay,quotedPrice}=result;
  const data={type:"container-trade",userId:game.user.id,tokenUuid:card.tokenUuid,
    actorId:recipient.actor.id,actorUuid:recipient.actor.uuid||null,
    recipientTokenUuid:recipient.tokenUuid||null,offerIndex,
    reference:offer.reference,offerName:offer.name,
    barterItems,ackOverpay,quotedPrice};
  if(helpers.isPrimaryGM())return processClaim(data);
  if(!helpers.primaryGM())return ui.notifications?.warn("H0D : un MJ connecté est nécessaire pour exécuter le troc.");
  game.socket.emit(SOCKET,data);
}

async function transferOffer(actor,offer,quantity) {
  // La quantité du stock compte les lots ; un lot peut contenir plusieurs unités (Senn : flèches ×5).
  const perPurchase=Number(offer.perPurchase);
  if(!Number.isSafeInteger(perPurchase)||perPurchase<1||!Number.isSafeInteger(quantity)||quantity<1||
     !Number.isSafeInteger(quantity*perPurchase)) throw new Error("Conditionnement ou quantité invalide.");
  const units=quantity*perPurchase;
  // Seule une référence exacte permet une création ; ne jamais deviner un Item.
  const builder = game.h0dEquipmentBuilder;
  if (!offer.reference || !builder?.getDefinition || !builder?.buildItem)
    throw new Error("Référence indisponible : H0D Equipment Builder est requis.");
  const definition = builder.getDefinition(offer.reference);
  if (!definition) throw new Error("Référence introuvable dans le Catalogue/Builder : "+offer.reference);
  if (definition.catalogue?.pret_pour_builder === false)
    throw new Error("Cette référence n'est pas prête pour la création d'Item : "+offer.reference);
  const original = await builder.buildItem(offer.reference,{mode:"skip"});
  if (!original) throw new Error("Impossible de générer l'Item canonique : "+offer.reference);
  const source = helpers.prepareLootedItemSource(original.toObject());
  // L'intitulé commercial d'un lot (ex. ×5 chez Senn) reste visible dans l'inventaire,
  // sans modifier les propriétés mécaniques de la définition canonique.
  source.name = offer.name || source.name;
  source.flags ||= {};
  source.flags[NS] = {...(source.flags[NS] || {}),looted:true,containerReference:offer.reference};
  // Chaque Item cloné conserve une identité CSB indépendante de son prototype.
  const freshSource = () => {
    const copy=clone(source);
    if (copy.system && Object.hasOwn(copy.system,"uniqueId")) copy.system.uniqueId=foundry.utils.randomID();
    return copy;
  };
  const props = source.system?.props || {};
  const quantityField = Object.hasOwn(props,"H0D_Ressource_Quantite") ? "H0D_Ressource_Quantite" :
    Object.hasOwn(props,"H0D_Objet_Quantite") ? "H0D_Objet_Quantite" : null;
  if (quantityField) {
    const existing = actor.items.find(item => item.system?.template === original.system?.template &&
      item.getFlag?.(NS,"containerReference") === offer.reference &&
      helpers.sameStackVariant(item,original));
    if (existing) {
      const current = Math.max(0,Math.floor(Number(existing.system?.props?.[quantityField]) || 0));
      await existing.update({["system.props."+quantityField]:String(current+units)});
      return {rollback:async()=>existing.update({["system.props."+quantityField]:String(current)})};
    }
    source.system.props[quantityField] = String(units);
    const created=await actor.createEmbeddedDocuments("Item",[freshSource()]);
    return {rollback:async()=>actor.deleteEmbeddedDocuments("Item",created.map(item=>item.id))};
  }
  const created=await actor.createEmbeddedDocuments("Item",Array.from({length:units},freshSource));
  return {rollback:async()=>actor.deleteEmbeddedDocuments("Item",created.map(item=>item.id))};
}

async function updateCards(tokenDoc) {
  const card = stockCard(tokenDoc);
  for (const message of game.messages.contents) {
    if (message.getFlag(NS,CARD_FLAG)?.tokenUuid !== tokenDoc.uuid) continue;
    try { await message.update({content:renderStockCard(card),["flags."+NS+"."+CARD_FLAG]:card}); }
    catch (error) { console.warn("H0D | carte de conteneur non synchronisée",error); }
  }
}

async function processClaim(data) {
  // Deux tokens liés au même Actor partagent le même stock : une seule file de retraits.
  const tokenDoc=await helpers.resolveTokenDocument(data.tokenUuid);
  const key=String(tokenDoc?.actor?.uuid || data.tokenUuid || "");
  const previous=pending.get(key)||Promise.resolve();
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const tail=previous.then(()=>gate);
  pending.set(key,tail);
  await previous;
  try {
    if(data.type==="container-trade")await tradeSerialized(data);
    else await claimSerialized(data);
  }
  finally { release();if(pending.get(key)===tail)pending.delete(key); }
}

async function claimSerialized(data) {
  const respond = (ok,message) => {
    if (data.userId===game.user.id) (ok?ui.notifications?.info:ui.notifications?.warn)?.call(ui.notifications,message);
    else game.socket.emit(SOCKET,{type:"container-result",userId:data.userId,ok,message});
  };
  try {
    if (!game.settings.get(NS,"playersCanClaim")) return respond(false,"H0D : récupération désactivée.");
    const user = game.users.get(data.userId);
    if (!user) return respond(false,"H0D : utilisateur introuvable.");
    const tokenDoc = await helpers.resolveTokenDocument(data.tokenUuid);
    if (!tokenDoc || (!user.isGM && (tokenDoc.hidden || (user.viewedScene && tokenDoc.parent?.id !== user.viewedScene))))
      return respond(false,"H0D : conteneur inaccessible.");
    const {actor:source,mode,state} = readContainer(tokenDoc);
    const actor = await helpers.resolveRecipientActor(data,user);
    if (!actor || (!user.isGM && !helpers.actorOwnedByUser(actor,user)))
      return respond(false,"H0D : ce PJ ne vous appartient pas.");
    const indexes = data.quantity === "all-card" && mode !== "Marchand"
      ? state.offers.map((_,index)=>index)
      : [data.offerIndex];
    if (mode === "Marchand") return respond(false,"H0D : retrait gratuit interdit chez un marchand. Utilise « Troquer ».");
    if (data.quantity === "all-card" && mode === "Marchand") return respond(false,"H0D : retrait global interdit en mode marchand.");
    if (!indexes.length || indexes.some(index=>!Number.isSafeInteger(index) || index<0 || index>=state.offers.length))
      return respond(false,"H0D : marchandise introuvable.");
    const ops=[];
    for (const index of indexes) {
      const offer=state.offers[index];
      if (data.quantity !== "all-card" && (offer.reference!==data.reference || offer.name!==data.offerName))
        return respond(false,"H0D : le stock a été modifié. Rouvre le coffre.");
      const remaining=offer.quantity;
      if (remaining<=0) continue;
      const qty=data.quantity === "all" || data.quantity === "all-card" ? remaining :
        (data.quantity === 1 ? 1 : 0);
      if (!qty) return respond(false,"H0D : quantité demandée invalide.");
      ops.push({index,offer,qty});
    }
    if (!ops.length) return respond(false,"H0D : aucun objet restant.");
    // Pour le mode marchand, un retrait représente une livraison ; la monnaie n'est pas débitée.
    // Ne décrémenter que les objets réellement transférés, jamais sur échec de génération.
    try {
      for (const op of ops) {
        await transferOffer(actor,op.offer,op.qty);
        state.offers[op.index].quantity -= op.qty;
        await merchantAPI.setMerchantOffers(source,state.offers);
      }
    } finally {
      // Même si une ligne d'un retrait global échoue, republier les lignes déjà prélevées.
      await updateCards(tokenDoc);
    }
    respond(true,"H0D : "+ops.reduce((sum,op)=>sum+op.qty,0)+" objet(s) transféré(s) vers "+actor.name+
      (mode==="Marchand"?". Paiement à régler manuellement.":"."));
  } catch (error) {
    console.error("H0D | retrait de conteneur impossible",error);
    respond(false,"H0D : retrait impossible ("+(error?.message || error)+").");
  }
}

async function tradeSerialized(data) {
  const respond=(ok,message)=>{
    if(data.userId===game.user.id)(ok?ui.notifications?.info:ui.notifications?.warn)?.call(ui.notifications,message);
    else game.socket.emit(SOCKET,{type:"container-result",userId:data.userId,ok,message});
  };
  let rollbackWarning="";
  try {
    if(!game.settings.get(NS,"playersCanClaim"))return respond(false,"H0D : troc côté joueur désactivé.");
    const user=game.users.get(data.userId);
    if(!user)return respond(false,"H0D : joueur introuvable.");
    const tokenDoc=await helpers.resolveTokenDocument(data.tokenUuid);
    if(!tokenDoc||(!user.isGM&&(tokenDoc.hidden||(user.viewedScene&&tokenDoc.parent?.id!==user.viewedScene))))
      return respond(false,"H0D : vendeur inaccessible sur cette scène.");
    const {actor:vendor,mode,state}=readContainer(tokenDoc);
    if(mode!=="Marchand"||!state.enabled||state.valueBarterEnabled!==true)
      return respond(false,"H0D : ce vendeur n'accepte pas le troc automatique.");
    const index=data.offerIndex;
    if(!Number.isSafeInteger(index)||index<0||index>=state.offers.length)
      return respond(false,"H0D : cette offre n'existe plus.");
    const offer=state.offers[index];
    if(data.quotedPrice!==undefined&&data.quotedPrice!==offer.price)
      return respond(false,"H0D : prix du vendeur modifié depuis l'ouverture du troc. Rouvre son stock.");
    if(offer.reference!==data.reference||offer.name!==data.offerName)
      return respond(false,"H0D : offre modifiée. Rouvre le vendeur.");
    if(!Number.isSafeInteger(offer.quantity)||offer.quantity<1)
      return respond(false,"H0D : article épuisé.");
    if(offer.currency!=="jetons"||!Number.isSafeInteger(offer.price)||offer.price<0)
      return respond(false,"H0D : prix non défini ou hors mode troc.");
    const actor=await helpers.resolveRecipientActor(data,user);
    if(!actor||(!user.isGM&&!helpers.actorOwnedByUser(actor,user)))
      return respond(false,"H0D : ce PJ ne vous appartient pas.");
    if(actor.uuid===vendor.uuid||actor.id===vendor.id)
      return respond(false,"H0D : le vendeur ne peut pas être son propre acheteur.");
    const quote=barterQuote(actor,data.barterItems||[],offer.price);
    if(quote.overpay>0&&data.ackOverpay!==true)
      return respond(false,"H0D : confirme l'excédent avant de troquer.");
    const paid=[];
    let delivery=null;
    try {
      for(const line of quote.lines) {
        const item=line.item;
        const key=line.details.quantityField;
        const previous=item.system.props[key];
        const current=Number(previous);
        await item.update({["system.props."+key]:String(current-line.quantity)});
        paid.push({item,key,previous});
      }
      delivery=await transferOffer(actor,offer,1);
      state.offers[index].quantity-=1;
      await merchantAPI.setMerchantOffers(vendor,state.offers);
    } catch(error) {
      // Restauration compensatoire : le troc ne doit jamais être annoncé comme réussi
      // si le prélèvement ou l'écriture du stock échoue.
      const problems=[];
      if(delivery?.rollback)try{await delivery.rollback();}catch(err){problems.push("retrait article : "+String(err));}
      for(const row of paid.reverse())try{
        await row.item.update({["system.props."+row.key]:row.previous});
      }catch(err){problems.push("remboursement "+row.item.name+" : "+String(err));}
      if(problems.length)rollbackWarning=" Restauration partielle : intervention MJ nécessaire ("+problems.join("; ")+").";
      throw error;
    } finally {
      await updateCards(tokenDoc);
    }
    // Les ressources remises sont consommées du PJ et consignées sur le vendeur
    // (pas de revente automatique, car les sources ne sont pas toujours des articles du Catalogue).
    try {
      const receiptState=merchantAPI.getMerchant(vendor);
      const history=Array.isArray(receiptState.barterReceipts)?receiptState.barterReceipts:[];
      receiptState.barterReceipts=[...history,{
        at:Date.now(),buyerId:actor.id,buyerName:actor.name,playerId:user.id,
        reference:offer.reference,offerName:offer.name,
        price:offer.price,paidValue:quote.total,
        paid:quote.lines.map(line=>({name:line.details.name,quantity:line.quantity,unitValue:line.details.value}))
      }].slice(-100);
      await vendor.setFlag(NS,"merchant",receiptState);
    }catch(err){console.warn("H0D | troc terminé, mais journal du marchand non enregistré",err);}
    // Après confirmation, supprimer les piles de valeur totalement consommées.
    const emptied=quote.lines.filter(line=>line.quantity===line.details.quantity).map(line=>line.item.id);
    if(emptied.length)try{await actor.deleteEmbeddedDocuments("Item",emptied);}
    catch(err){console.warn("H0D | piles de troc vides conservées",err);}
    respond(true,"H0D : "+offer.name+" obtenu par troc sur "+vendor.name+
      " ("+quote.total+" valeur remise pour "+offer.price+" jetons)."+(quote.overpay?" Sans rendu de "+quote.overpay+".":""));
  } catch(error) {
    console.error("H0D | transaction commerciale impossible",error);
    respond(false,"H0D : troc impossible ("+String(error?.message||error)+")."+rollbackWarning);
  }
}

async function processOpen(data) {
  const user=game.users.get(data.userId);
  if (!user) return false;
  const tokenDoc=await helpers.resolveTokenDocument(data.tokenUuid);
  if (!tokenDoc || (!user.isGM && (tokenDoc.hidden || (user.viewedScene && tokenDoc.parent?.id !== user.viewedScene)))){
    game.socket.emit(SOCKET,{type:"container-result",userId:user.id,ok:false,
      message:"H0D : conteneur inaccessible depuis cette scène."});
    return false;
  }
  try {
    await publishCard(tokenDoc,user.id);
    return true;
  }catch (error) {
    console.error("H0D | publication de stock impossible",error);
    game.socket.emit(SOCKET,{type:"container-result",userId:user.id,ok:false,
      message:"H0D : "+String(error?.message||error)});
    return false;
  }
}

export async function openMerchantForPlayerOnGM(data) {
  if(!helpers?.isPrimaryGM?.())throw new Error("Action réservée au client MJ actif.");
  return processOpen(data);
}

export function registerContainerSupport(dependencies) {
  helpers=dependencies;
  game.socket.on(SOCKET,data => {
    if (!data || typeof data!=="object") return;
    if (helpers.isPrimaryGM() && data.type==="container-open") void processOpen(data);
    if (helpers.isPrimaryGM() && (data.type==="container-claim"||data.type==="container-trade")) void processClaim(data);
    if (data.type==="container-result" && data.userId===game.user.id) {
      (data.ok?ui.notifications?.info:ui.notifications?.warn)?.call(ui.notifications,data.message);
    }
  });
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    const card=message.getFlag(NS,CARD_FLAG);
    if (!card) return;
    html.querySelectorAll("[data-h0d-container-action]").forEach(button=>{
      button.addEventListener("click",async event=>{
        event.preventDefault();
        const action=button.dataset.h0dContainerAction;
        const index=action==="take-all-card"?null:Number(button.dataset.index);
        const quantity=action==="take-one"?1:action==="take-all"?"all":"all-card";
        // Retrait autonome : aucune approbation du MJ ni confirmation de type "demande".
        // En mode marchand le paiement demeure externe et n'est pas débité automatiquement.
        try {
          if(action==="trade") await requestContainerTrade(card,index);
          else await requestContainerClaim(card,index,quantity);
        }
        catch (error) {
          console.error("H0D | récupération depuis un conteneur",error);
          ui.notifications?.warn("H0D : impossible de récupérer l'objet ("+(error?.message||error)+").");
        }
      });
    });
  });
}
