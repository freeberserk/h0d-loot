import {merchantAPI} from "./h0d-merchant.js";

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
  return actor?.system?.template === TEMPLATE_ID || Object.hasOwn(props,"H0D_Conteneur_Mode");
}

function readContainer(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor || !isContainerToken({actor})) throw new Error("Ce token n'est pas un conteneur H0D.");
  const mode = String(actor.system?.props?.H0D_Conteneur_Mode || "Butin");
  const state = merchantAPI.getMerchant(actor);
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
    offers:(state.offers || []).map((offer,index) => {
      const def = builder?.getDefinition?.(offer.reference) || catalogue?.getDefinition?.(offer.reference) || null;
      const kind = String(def?.kind || "").toLowerCase();
      const category = {weapon:"Armes",armor:"Armures",object:"Objets",resource:"Ressources",ammo:"Munitions",ammunition:"Munitions"}[kind] || "Autres";
      return {index,reference:String(offer.reference || ""),name:String(offer.name || "Article"),
        quantity:Number.isSafeInteger(offer.quantity) && offer.quantity >= 0 ? offer.quantity : 1,
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
      const actions = q && claimable ? '<span class="h0d-loot-actions">'+
        '<button type="button" data-h0d-container-action="take-one" data-index="'+o.index+'" title="Prendre 1"><i class="fa-solid fa-hand"></i> 1</button>'+
        '<button type="button" data-h0d-container-action="take-all" data-index="'+o.index+'" title="Prendre tout ce type"><i class="fa-solid fa-box"></i></button></span>' :
        (q ? '' : '<span class="h0d-loot-empty">épuisé</span>');
      const price = o.price === null ? 'Prix à définir' : esc(o.price) + ' ' + esc(o.currency);
      return '<div class="h0d-loot-row '+(q?'':'is-empty')+'"><img src="'+esc(o.img)+'" alt="">'+
        '<div class="h0d-loot-item"><strong>'+esc(o.name)+'</strong><small>'+price+'</small></div>'+
        '<span class="h0d-loot-qty">×'+q+'</span>'+actions+'</div>';
    }).join('');
    return '<div class="h0d-loot-group"><div class="h0d-loot-group-title">'+esc(category)+'</div>'+rows+'</div>';
  }).join('');
  const count = card.offers.reduce((sum,offer) => sum+Math.max(0,offer.quantity),0);
  const warning = card.mode === 'Marchand'
    ? '<div class="h0d-loot-warning">Stock marchand : retirer un objet ne débite pas les jetons du PJ. Paiement à gérer avec le MJ.</div>'
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
  game.socket.emit(SOCKET,data);
  ui.notifications?.info("H0D : demande de récupération envoyée.");
}

async function transferOffer(actor,offer,quantity) {
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
  source.flags ||= {};
  source.flags[NS] = {...(source.flags[NS] || {}),looted:true,containerReference:offer.reference};
  const props = source.system?.props || {};
  const quantityField = Object.hasOwn(props,"H0D_Ressource_Quantite") ? "H0D_Ressource_Quantite" :
    Object.hasOwn(props,"H0D_Objet_Quantite") ? "H0D_Objet_Quantite" : null;
  if (quantityField) {
    const existing = actor.items.find(item => item.system?.template === original.system?.template &&
      item.getFlag?.(NS,"containerReference") === offer.reference &&
      helpers.sameStackVariant(item,original));
    if (existing) {
      const current = Math.max(0,Math.floor(Number(existing.system?.props?.[quantityField]) || 0));
      await existing.update({["system.props."+quantityField]:String(current+quantity)});
      return;
    }
    source.system.props[quantityField] = String(quantity);
    await actor.createEmbeddedDocuments("Item",[source]);
    return;
  }
  await actor.createEmbeddedDocuments("Item",Array.from({length:quantity},()=>clone(source)));
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
  const key=String(data.tokenUuid || "");
  const previous=pending.get(key)||Promise.resolve();
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const tail=previous.then(()=>gate);
  pending.set(key,tail);
  await previous;
  try { await claimSerialized(data); }
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
    for (const op of ops) {
      await transferOffer(actor,op.offer,op.qty);
      state.offers[op.index].quantity -= op.qty;
      await merchantAPI.setMerchantOffers(source,state.offers);
    }
    await updateCards(tokenDoc);
    respond(true,"H0D : "+ops.reduce((sum,op)=>sum+op.qty,0)+" objet(s) transféré(s) vers "+actor.name+
      (mode==="Marchand"?". Paiement à régler manuellement.":"."));
  } catch (error) {
    console.error("H0D | retrait de conteneur impossible",error);
    respond(false,"H0D : retrait impossible ("+(error?.message || error)+").");
  }
}

async function processOpen(data) {
  const user=game.users.get(data.userId);
  if (!user) return;
  const tokenDoc=await helpers.resolveTokenDocument(data.tokenUuid);
  if (!tokenDoc || (!user.isGM && (tokenDoc.hidden || (user.viewedScene && tokenDoc.parent?.id !== user.viewedScene)))) return;
  try { await publishCard(tokenDoc,user.id); }
  catch (error) { game.socket.emit(SOCKET,{type:"container-result",userId:user.id,ok:false,message:"H0D : "+error.message}); }
}

export function registerContainerSupport(dependencies) {
  helpers=dependencies;
  game.socket.on(SOCKET,data => {
    if (!data || typeof data!=="object") return;
    if (helpers.isPrimaryGM() && data.type==="container-open") void processOpen(data);
    if (helpers.isPrimaryGM() && data.type==="container-claim") void processClaim(data);
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
        if (card.mode==="Marchand" && !game.user.isGM) {
          const confirm=await foundry.applications.api.DialogV2.confirm({
            window:{title:"H0D — Retrait marchand"},
            content:"<p>Le transfert de cet objet ne retire aucun jeton. Valider ce retrait avec le MJ avant de continuer.</p>"
          });
          if (!confirm)return;
        }
        await requestContainerClaim(card,index,quantity);
      });
    });
  });
}
