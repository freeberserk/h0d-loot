// H0D Commerce — vitrines de marchand liées à des tuiles Foundry v14.
// Les joueurs ne lisent jamais les flags de l'Actor : uniquement un instantané
// public et limité, enregistré sur le TileDocument par le MJ.
import {merchantAPI} from "./h0d-merchant.js";

const NS = "h0d-loot";
const TILE_FLAG = "merchantTile";
const CATEGORY_NAMES = {
  weapon:"Armes", armor:"Armures", ammo:"Munitions", ammunition:"Munitions",
  object:"Objets", resource:"Ressources"
};
const CATEGORY_ORDER = ["Armes","Armures","Munitions","Objets","Ressources","Autres"];
const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
const clone = value => foundry.utils.deepClone(value);
let attachedBoard = null;
const syncPending = new Map();
let syncRunning = false;

function requireGM() {
  if (!game.user?.isGM) throw new Error("H0D Commerce : action réservée au MJ.");
}
function resolveTile(value) {
  const doc = value?.documentName === "Tile" ? value : value?.document;
  if (doc?.documentName !== "Tile") throw new Error("Sélectionne une tuile de scène.");
  return doc;
}
function resolveActor(value) {
  const actor = typeof value === "string" ? game.actors?.get(value) : value;
  if (actor?.documentName !== "Actor") throw new Error("Fiche de marchand introuvable.");
  return actor;
}
function merchantSourceKey(actor) {
  return actor?.uuid || actor?.token?.uuid || (actor?.id ? `Actor.${actor.id}` : null);
}
function publicSnapshot(actor) {
  const state = merchantAPI.getMerchant(actor);
  const enabled = state.enabled === true;
  return {
    version:1,
    actorId:actor.id,
    sourceUuid:merchantSourceKey(actor),
    name:String(actor.name ?? "Marchand"),
    enabled,
    offers:enabled ? (state.offers || []).map(offer => {
      const kind = game.h0dEquipmentBuilder?.getDefinition?.(offer.reference)?.kind;
      return {
        name:String(offer.name ?? "Marchandise"),
        quantity:offer.quantity === null ? null : Number(offer.quantity),
        price:offer.price === null ? null : Number(offer.price),
        currency:String(offer.currency ?? "jetons"),
        category:CATEGORY_NAMES[String(kind ?? "").toLowerCase()] || "Autres"
      };
    }) : []
  };
}
export function getTileStorefront(tileValue) {
  const tile = resolveTile(tileValue);
  const data = tile.getFlag(NS,TILE_FLAG);
  return data?.version === 1 ? clone(data) : null;
}
export async function linkTileToMerchant(tileValue,actorValue) {
  requireGM();
  const tile = resolveTile(tileValue);
  const actor = resolveActor(actorValue);
  if (!merchantAPI.getMerchant(actor).enabled) {
    throw new Error("Active d'abord le rôle Marchand sur " + actor.name + ".");
  }
  const snapshot = publicSnapshot(actor);
  await tile.setFlag(NS,TILE_FLAG,snapshot);
  return clone(snapshot);
}
export async function unlinkMerchantTile(tileValue) {
  requireGM();
  const tile = resolveTile(tileValue);
  await tile.unsetFlag(NS,TILE_FLAG);
}
export async function syncMerchantTiles(actorValue) {
  requireGM();
  const actor = resolveActor(actorValue);
  const snapshot = publicSnapshot(actor);
  let count = 0;
  for (const scene of game.scenes?.contents || []) {
    for (const tile of scene.tiles || []) {
      const previous = tile.getFlag(NS,TILE_FLAG);
      // Les anciens liens (sans sourceUuid) continuent de cibler un Actor du répertoire.
      if (previous?.sourceUuid ? previous.sourceUuid !== snapshot.sourceUuid :
          (actor.isToken || previous?.actorId !== actor.id)) continue;
      if (JSON.stringify(previous) === JSON.stringify(snapshot)) continue;
      await tile.setFlag(NS,TILE_FLAG,snapshot);
      count++;
    }
  }
  return count;
}
function queueTileSync(actor) {
  if (!game.user?.isGM || actor?.documentName !== "Actor") return;
  const key=merchantSourceKey(actor);
  if (!key) return;
  syncPending.set(key,actor);
  if (syncRunning) return;
  syncRunning = true;
  void (async () => {
    try {
      while (syncPending.size) {
        const actors=[...syncPending.values()];
        syncPending.clear();
        for (const source of actors) await syncMerchantTiles(source);
      }
    } catch(err) {
      console.error("H0D Commerce | synchronisation de tuiles",err);
      ui.notifications?.warn?.("H0D Commerce : synchronisation d'une vitrine impossible.");
    } finally {
      syncRunning = false;
    }
  })();
}
function categorySort(a,b) {
  const ai=CATEGORY_ORDER.indexOf(a), bi=CATEGORY_ORDER.indexOf(b);
  return (ai<0?99:ai)-(bi<0?99:bi) || a.localeCompare(b,"fr");
}
function storefrontContent(snapshot) {
  const grouped = new Map();
  for (const offer of snapshot.offers || []) {
    const cat = CATEGORY_ORDER.includes(offer.category) ? offer.category : "Autres";
    if (!grouped.has(cat)) grouped.set(cat,[]);
    grouped.get(cat).push(offer);
  }
  const sections = [...grouped.keys()].sort(categorySort).map(cat => {
    const rows = grouped.get(cat).sort((a,b)=>a.name.localeCompare(b.name,"fr")).map(offer => {
      const quantity = offer.quantity === null ? "Non précisée" : offer.quantity === 0 ? "Épuisé" : String(offer.quantity);
      const price = offer.price === null ? "À définir" : offer.price + " " + offer.currency;
      return '<div class="h0d-storefront-row">' +
        '<span class="h0d-storefront-name">' + esc(offer.name) + '</span>' +
        '<span class="h0d-storefront-quantity">' + esc(quantity) + '</span>' +
        '<span class="h0d-storefront-price">' + esc(price) + '</span></div>';
    }).join("");
    return '<section class="h0d-storefront-category"><h3>'+esc(cat)+'</h3>'+rows+'</section>';
  }).join("");
  return '<div class="h0d-storefront">' +
    '<header><i class="fa-solid fa-store" aria-hidden="true"></i><div><strong>'+esc(snapshot.name)+
    '</strong><small>Vitrine marchande · Consultation uniquement</small></div></header>' +
    '<div class="h0d-storefront-body">' + (sections || '<p>Aucune marchandise proposée.</p>') + '</div>' +
    '<footer>Achats à confirmer avec le MJ · Aucun objet ni paiement transféré.</footer></div>';
}
export async function openTileStorefront(tileValue) {
  const tile = resolveTile(tileValue);
  if (!game.user?.isGM && (tile.hidden || tile.parent?.id !== canvas?.scene?.id)) {
    throw new Error("Cette vitrine n'est pas accessible.");
  }
  const snapshot = getTileStorefront(tile);
  if (!snapshot) throw new Error("Cette tuile n'est pas liée à un marchand.");
  if (!snapshot.enabled) {
    ui.notifications?.warn?.("Ce marchand ne propose actuellement aucune vente.");
    return null;
  }
  return foundry.applications.api.DialogV2.wait({
    window:{title:"H0D — Étal de " + snapshot.name,resizable:true},
    content:storefrontContent(snapshot),
    buttons:[{action:"close",label:"Fermer",default:true}]
  });
}
export async function linkSelectedMerchantTile() {
  requireGM();
  const selected = canvas?.tiles?.controlled || [];
  if (selected.length !== 1) throw new Error("Sélectionne une seule tuile dans les contrôles de tuiles.");
  const tile = resolveTile(selected[0]);
  const previous = getTileStorefront(tile);
  // Un Actor porté par un token non lié peut avoir ses propres flags de commerce.
  // Il ne figure pas dans game.actors ; il doit donc être proposé séparément.
  const candidates=new Map();
  for (const actor of game.actors?.contents || []) {
    if (actor.type === "_template" || !merchantAPI.getMerchant(actor).enabled) continue;
    const key=merchantSourceKey(actor);
    if (key) candidates.set(key,{actor,label:actor.name+" (répertoire)"});
  }
  for (const scene of game.scenes?.contents || []) {
    for (const token of scene.tokens?.contents || []) {
      const actor=token.actor;
      if (!actor?.isToken || !merchantAPI.getMerchant(actor).enabled) continue;
      const key=merchantSourceKey(actor);
      if (key) candidates.set(key,{actor,label:actor.name+" (token — "+scene.name+")"});
    }
  }
  const entries=[...candidates.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label,"fr"));
  const choices=entries.map(([key,{actor,label}])=>'<option value="'+esc(key)+'" '+
    ((previous?.sourceUuid === key || (!previous?.sourceUuid && !actor.isToken && previous?.actorId === actor.id)) ? 'selected' : '')+
    '>'+esc(label)+'</option>').join("");
  const choice = await foundry.applications.api.DialogV2.input({
    window:{title:"H0D — Associer la tuile : " + (tile.name || "Stock marchand")},
    content:'<p>Cette tuile reste décorative pour Foundry, mais un double-clic ouvre sa vitrine aux joueurs.</p>' +
      '<div class="form-group"><label>Marchand lié</label><select name="actorId">' +
      '<option value="">— Aucun (détacher la vitrine) —</option>' + choices + '</select></div>' +
      (entries.length ? '' : '<p>Aucun Marchand actif trouvé dans le répertoire ni sur les tokens des scènes. Active le rôle Marchand dans le monde de test.</p>'),
    ok:{label:"Enregistrer",icon:"fa-solid fa-link"}
  });
  if (!choice) return null;
  if (!choice.actorId) {
    await unlinkMerchantTile(tile);
    ui.notifications?.info?.("H0D Commerce : liaison supprimée de la tuile.");
    return null;
  }
  const selected=candidates.get(String(choice.actorId));
  if (!selected) throw new Error("Le marchand choisi n’est plus disponible. Rouvre la fenêtre de liaison.");
  const result = await linkTileToMerchant(tile,selected.actor);
  ui.notifications?.info?.("H0D Commerce : tuile liée à " + result.name + ".");
  return result;
}
function pointInTile(doc,p) {
  const width=Number(doc.width||0),height=Number(doc.height||0);
  if(width<=0||height<=0)return false;
  const dx=p.x-(Number(doc.x||0)+width/2),dy=p.y-(Number(doc.y||0)+height/2);
  const radians=-(Number(doc.rotation||0)*Math.PI/180);
  const x=dx*Math.cos(radians)-dy*Math.sin(radians);
  const y=dx*Math.sin(radians)+dy*Math.cos(radians);
  return Math.abs(x)<=width/2 && Math.abs(y)<=height/2;
}
function handleCanvasDoubleClick(event) {
  if(event.button!==0 || !canvas?.ready || !canvas.scene) return;
  // Le double-clic du MJ dans l'outil Tuiles reste réservé à l'édition Foundry.
  if(game.user?.isGM && canvas.activeLayer===canvas.tiles) return;
  const point=canvas.canvasCoordinatesFromClient({x:event.clientX,y:event.clientY});
  const tiles=(canvas.tiles?.placeables || []).filter(obj => {
    const doc=obj.document,store=doc?.getFlag(NS,TILE_FLAG);
    return !!store?.enabled && !doc.hidden && obj.isVisible !== false && pointInTile(doc,point);
  }).sort((a,b) => (Number(b.document.elevation||0)-Number(a.document.elevation||0)) ||
                     (Number(b.document.sort||0)-Number(a.document.sort||0)));
  if (!tiles.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void openTileStorefront(tiles[0].document).catch(err => {
    console.error("H0D Commerce | ouverture de la vitrine",err);
    ui.notifications?.error?.(err.message);
  });
}
function removeCanvasListener() {
  if (attachedBoard) attachedBoard.removeEventListener("dblclick",handleCanvasDoubleClick,true);
  attachedBoard = null;
}
function installCanvasListener() {
  const board=canvas?.app?.canvas || canvas?.app?.renderer?.canvas || document.getElementById("board");
  if(!board || board === attachedBoard) return;
  removeCanvasListener();
  board.addEventListener("dblclick",handleCanvasDoubleClick,true);
  attachedBoard=board;
}
function merchantFlagChanged(changes) {
  if (changes.name !== undefined) return true;
  if (changes.flags?.[NS] && Object.prototype.hasOwnProperty.call(changes.flags[NS],"merchant")) return true;
  return Object.keys(changes).some(key => key.startsWith("flags."+NS+".merchant"));
}
export function registerMerchantTileHooks() {
  Hooks.on("canvasReady",installCanvasListener);
  Hooks.on("canvasTearDown",removeCanvasListener);
  Hooks.once("ready",installCanvasListener);
  Hooks.on("updateActor",(actor,changes) => {
    if(game.user?.isGM && merchantFlagChanged(changes)) queueTileSync(actor);
  });
  Hooks.on("updateToken",(token,changes) => {
    if (!game.user?.isGM || !token?.actor?.isToken) return;
    const delta=changes.delta || changes.actorData;
    if (delta && merchantFlagChanged(delta)) queueTileSync(token.actor);
  });
  Hooks.on("getSceneControlButtons",controls => {
    if(!game.user?.isGM) return;
    const tools=controls?.tiles?.tools;
    if(!tools) return;
    tools.h0dMerchantTile={
      name:"h0dMerchantTile",
      title:"H0D Commerce — lier la tuile sélectionnée à un marchand",
      icon:"fa-solid fa-store",
      order:Object.keys(tools).length+1,
      button:true,visible:true,
      onChange:() => linkSelectedMerchantTile().catch(err=>ui.notifications?.warn?.(err.message))
    };
  });
}
export const merchantTileAPI = {
  linkTileToMerchant,unlinkMerchantTile,getTileStorefront,
  syncMerchantTiles,openTileStorefront,linkSelectedMerchantTile
};
