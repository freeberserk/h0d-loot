import {normalizeHarvestProfile,selectHarvestResults,reconcileHarvestLoot,HARVEST_KINDS,HARVEST_LABELS} from "./h0d-harvest.js";
const MODULE_ID = "h0d-loot";
const HARVEST_FLAG = "harvestProfile";
const SOCKET = `module.${MODULE_ID}`;
const LOOT_FLAG = "loot";
const TOKEN_FLAG = "generated";

const MENACE_LOOT = {
  1: "1d3",
  2: "1d4",
  3: "1d4+1",
  4: "1d6",
  5: "1d6+1",
  6: "2d4",
  7: "2d4+1",
  8: "2d6",
  9: "2d6+2",
  10: "3d6"
};

const DEFAULT_MACHINE_TABLE = "H0D Loot — Ressources machine";
const DEFAULT_CREATURE_TABLE = "H0D Loot — Ressources créature";
const DEFAULT_RESOURCE_PACK = "forge-vtt-shared-compendiums-h0d_compendium.item-1-item";

const RESOURCE_TEMPLATE_ID = "H0DResTpl0000001";
const OBJECT_TEMPLATE_ID = "H0DObjTpl0000001";
const WEAPON_TEMPLATE_ID = "O6qwtv7ozECILPHV";
const ARMOR_TEMPLATE_ID = "dEeBbuthkI0CVMa3";

const DEFAULT_TABLES = {
  machine: [
    ["Plaques métalliques", 4],
    ["Fibres synthétiques", 3],
    ["Lentilles optiques", 2],
    ["Cellule d’énergie faible", 2],
    ["Circuit ancien abîmé", 2],
    ["Fluide élémentaire — Blaze", 1],
    ["Fluide élémentaire — Chillwater", 1],
    ["Fluide élémentaire — Sparker", 1],
    ["Fluide élémentaire — Metalburn", 1],
    ["Cellule d’énergie stable", 1],
    ["Circuit ancien intact", 1]
  ],
  creature: [
    ["Viande animale", 4],
    ["Os animal", 3],
    ["Peau animale", 2],
    ["Trophée animal rare", 1]
  ]
};

const RARE_RULES = [
  {resource:"Radar dorsal de Scrapper", origins:["scrapper"], keywords:["radar"]},
  {resource:"Crocs de Sawtooth", origins:["sawtooth","dent de scie"], keywords:["croc"]},
  {resource:"Générateur de camouflage de Stalker", origins:["stalker"], keywords:["camouflage","furtif"]},
  {resource:"Générateur de bouclier de Shell-Walker", origins:["shell walker","shell-walker"], keywords:["bouclier","generateur"]},
  {resource:"Grand réservoir Blaze", origins:["fire bellowback","bellowback feu","cracheur de feu"], keywords:["blaze","reservoir"]},
  {resource:"Grand réservoir cryogénique", origins:["freeze bellowback","bellowback gel","cracheur de gel"], keywords:["cryo","gel","reservoir"]},
  {resource:"Canon cryo de Snapmaw", origins:["snapmaw"], keywords:["canon","cryo"]},
  {resource:"Canon de Ravager", origins:["ravager"], keywords:["canon"]},
  {resource:"Foreuse de Rockbreaker", origins:["rockbreaker"], keywords:["foreuse"]},
  {resource:"Générateur gravitationnel de Behemoth", origins:["behemoth"], keywords:["gravitation","generateur"]},
  {resource:"Réacteur de vol de Stormbird", origins:["stormbird"], keywords:["reacteur","vol"]},
  {resource:"Batterie-tempête", origins:["stormbird"], keywords:["batterie","tempete"]},
  {resource:"Lance-disques de Thunderjaw", origins:["thunderjaw"], keywords:["lance disque","lance-disque","disque"]},
  {resource:"Relais de brouillage ELYSIUM", origins:["tisseur elys","tisseur elysium"], keywords:["brouillage","relais"]},
  {resource:"Moteur dorsal ELYSIUM", origins:["moissonneur elys","moissonneur elysium"], keywords:["moteur","dorsal"]},
  {resource:"Griffe de machine intacte", origins:[], keywords:["griffe"]},
  {resource:"Œil optique intact", origins:[], keywords:["oeil","optique","capteur"]}
];

let resourceLibrary = new Map();
let resourceByName = new Map();
let resourcePack = null;
let compendiumById = new Map();
let compendiumByName = new Map();
let compendiumStatus = {collection:null, found:0, expected:0, missing:[], available:false};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "machineTable", {
    name: "Table de loot — Machines",
    hint: "Nom de la RollTable utilisée pour les ressources génériques des machines.",
    scope: "world", config: true, type: String, default: DEFAULT_MACHINE_TABLE
  });
  game.settings.register(MODULE_ID, "creatureTable", {
    name: "Table de loot — Créatures",
    hint: "Nom de la RollTable utilisée pour les ressources de faune.",
    scope: "world", config: true, type: String, default: DEFAULT_CREATURE_TABLE
  });
  game.settings.register(MODULE_ID, "resourcePack", {
    name: "Compendium source — Ressources H0D",
    hint: "Collection ID du Compendium Item utilisé comme source officielle lors des transferts.",
    scope: "world", config: true, type: String, default: DEFAULT_RESOURCE_PACK
  });
  game.settings.register(MODULE_ID, "tablesInitialized", {
    name: "Tables initialisées", scope: "world", config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE_ID, "playersCanClaim", {
    name: "Les joueurs peuvent récupérer le butin",
    hint: "Les joueurs peuvent cibler une carcasse puis récupérer directement vers leur PJ contrôlé ou possédé. Le MJ actif sécurise automatiquement le transfert en arrière-plan.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "announceGeneration", {
    name: "Publier le butin à la génération",
    hint: "Publie immédiatement une carte de butin dans le chat lorsque le MJ génère une carcasse.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(MODULE_ID, "excludeNaturalAttacks", {
    name: "Ignorer les attaques naturelles des humanoïdes",
    hint: "Évite de proposer Poings, Morsure, Griffes, Crocs, etc. comme équipement récupérable sur un PNJ ou membre de faction.",
    scope: "world", config: true, type: Boolean, default: true
  });
});

Hooks.once("ready", async () => {
  await loadLibrary();
  await loadCompendiumLibrary();
  if (game.user.isGM) await ensureDefaultTables();

  game.socket.on(SOCKET, onSocketMessage);

  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = {
    generate: generateControlled,
    manual: manualLootDialog,
    configureHarvest: configureHarvestForSelection,
    regenerate: regenerateControlledLoot,
    open: openLootForCurrentSelection,
    reset: resetControlledLoot,
    menaceLoot: MENACE_LOOT,
    getResource: id => resourceLibrary.get(id) ?? null,
    diagnose: () => foundry.utils.deepClone(compendiumStatus)
  };

  console.log("H0D Loot | v0.6.0 prêt", {resources: resourceLibrary.size, compendium: compendiumStatus});
});

Hooks.on("getSceneControlButtons", controls => {
  if (!controls?.tokens?.tools) return;
  const tools = controls.tokens.tools;

  tools.h0dLoot = {
    name: "h0dLoot",
    title: game.user?.isGM
      ? "H0D Loot — ouvrir ou générer le butin"
      : "H0D Loot — ouvrir le butin de la carcasse ciblée",
    icon: "fa-solid fa-box-open",
    order: Object.keys(tools).length + 1,
    button: true,
    visible: true,
    onChange: () => openLootForCurrentSelection()
  };

  if (game.user?.isGM) {
    tools.h0dLootHarvest = {
      name:"h0dLootHarvest",
      title:"H0D Loot — définir les ressources récupérables après scan (MJ)",
      icon:"fa-solid fa-paw",
      order:Object.keys(tools).length + 2,
      button:true,visible:true,
      onChange:()=>configureHarvestForSelection()
    };
    tools.h0dLootRegenerate = {
      name: "h0dLootRegenerate",
      title: "H0D Loot — régénérer explicitement le butin sélectionné",
      icon: "fa-solid fa-rotate",
      order: Object.keys(tools).length + 3,
      button: true,
      visible: true,
      onChange: () => regenerateControlledLoot()
    };
  }
});

Hooks.on("renderChatMessageHTML", (message, html) => {
  const loot = message.getFlag(MODULE_ID, LOOT_FLAG);
  if (!loot) return;

  html.querySelectorAll("[data-h0d-loot-action]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      const action = button.dataset.h0dLootAction;
      if (action === "take-one" || action === "take-all-row") {
        const entryId = button.dataset.entryId;
        const quantity = action === "take-one" ? 1 : "all";
        await requestClaim(message.id, entryId, quantity);
      } else if (action === "take-all") {
        await requestClaim(message.id, null, "all-card");
      }
    });
  });
});

async function loadLibrary() {
  try {
    const route = foundry.utils.getRoute(`modules/${MODULE_ID}/data/resources.json`);
    const response = await fetch(route);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    resourceLibrary = new Map(data.resources.map(r => [r.id, r]));
    resourceByName = new Map(data.resources.map(r => [norm(r.name), r]));
  } catch (err) {
    console.error("H0D Loot | impossible de charger la bibliothèque", err);
    ui.notifications?.error("H0D Loot : bibliothèque de ressources introuvable.");
  }
}

async function loadCompendiumLibrary() {
  resourcePack = null;
  compendiumById = new Map();
  compendiumByName = new Map();

  const collection = String(game.settings.get(MODULE_ID, "resourcePack") || "").trim();
  compendiumStatus = {collection, found:0, expected:resourceLibrary.size, missing:[], available:false};
  if (!collection) return;

  const pack = game.packs.get(collection);
  if (!pack || pack.documentName !== "Item") {
    console.warn(`H0D Loot | Compendium Item introuvable : ${collection}`);
    return;
  }

  try {
    const index = await pack.getIndex({fields:["system.template"]});
    for (const entry of index) {
      if (foundry.utils.getProperty(entry, "system.template") !== RESOURCE_TEMPLATE_ID) continue;
      const record = {id:String(entry._id), name:String(entry.name || ""), img:entry.img || "icons/svg/item-bag.svg"};
      compendiumById.set(record.id, record);
      compendiumByName.set(norm(record.name), record);
    }

    resourcePack = pack;
    const missing = [];
    for (const resource of resourceLibrary.values()) {
      if (!compendiumById.has(resource.id) && !compendiumByName.has(norm(resource.name))) missing.push(resource.name);
    }

    compendiumStatus = {
      collection,
      title:pack.title,
      found:compendiumById.size,
      expected:resourceLibrary.size,
      missing,
      available:true
    };
  } catch (err) {
    console.error("H0D Loot | impossible d'indexer le Compendium de ressources", err);
    resourcePack = null;
  }
}

async function getResourceDocument(resourceId) {
  if (!resourcePack) return null;
  const resource = resourceLibrary.get(resourceId);
  let entry = compendiumById.get(resourceId) || null;
  if (!entry && resource) entry = compendiumByName.get(norm(resource.name)) || null;
  if (!entry) return null;
  try { return await resourcePack.getDocument(entry.id); }
  catch (err) {
    console.warn(`H0D Loot | impossible de charger ${entry.name} depuis ${resourcePack.collection}`, err);
    return null;
  }
}

function cleanEmbeddedItemSource(source) {
  const data = foundry.utils.deepClone(source || {});
  delete data._id;
  delete data.folder;
  delete data.ownership;
  delete data._stats;
  delete data.sort;
  if (data.flags?.[MODULE_ID]) delete data.flags[MODULE_ID];
  return data;
}

async function ensureDefaultTables() {
  if (game.settings.get(MODULE_ID, "tablesInitialized")) return;
  await createTableIfMissing(DEFAULT_MACHINE_TABLE, DEFAULT_TABLES.machine,
    "Ressources génériques de carcasse machine. Poids éditables par le MJ.");
  await createTableIfMissing(DEFAULT_CREATURE_TABLE, DEFAULT_TABLES.creature,
    "Ressources récupérables sur la faune. Poids éditables par le MJ.");
  await game.settings.set(MODULE_ID, "tablesInitialized", true);
}

async function createTableIfMissing(name, entries, description) {
  if (game.tables.getName(name)) return;
  let cursor = 1;
  const results = entries.map(([text, weight]) => {
    const resource = resourceByName.get(norm(text));
    const start = cursor;
    const end = cursor + weight - 1;
    cursor = end + 1;
    return {
      type: "text", text,
      img: resource?.source?.img || "icons/svg/d20-grey.svg",
      weight, range: [start, end], drawn: false,
      flags: {[MODULE_ID]: {resourceId: resource?.id || null}}
    };
  });
  await RollTable.create({
    name,
    img: "icons/containers/chest/chest-reinforced-steel-brown.webp",
    description: `<p>${esc(description)}</p>`,
    formula: `1d${cursor - 1}`,
    replacement: true,
    displayRoll: false,
    results,
    ownership: {default: 0},
    flags: {[MODULE_ID]: {generated: true}}
  });
  ui.notifications?.info(`H0D Loot : table créée — ${name}`);
}

async function openLootForCurrentSelection() {
  if (game.user?.isGM) return gmOpenOrGenerate();
  return playerOpenTargetedLoot();
}

async function gmOpenOrGenerate() {
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return manualLootDialog();

  for (const token of tokens) {
    const existing = await getTokenLoot(token.document, {migrate:true});
    if (existing) {
      await surfaceTokenLoot(token.document, existing, {privateToUser:false});
      continue;
    }

    const type = detectType(token.actor);
    if (!type) {
      ui.notifications?.warn(`${token.name} : type H0D non reconnu.`);
      continue;
    }
    await generateForToken(token, type);
  }
}

async function playerOpenTargetedLoot() {
  if (!game.settings.get(MODULE_ID, "playersCanClaim")) {
    return ui.notifications?.warn("H0D Loot : récupération par les joueurs désactivée.");
  }

  const targets = Array.from(game.user?.targets ?? []);
  const controlledWithLoot = (canvas?.tokens?.controlled ?? []).filter(t => t.document.getFlag(MODULE_ID, TOKEN_FLAG));
  const candidates = targets.length ? targets : controlledWithLoot;

  if (!candidates.length) {
    return ui.notifications?.warn("H0D Loot : cible une carcasse avec l’outil de ciblage (T), puis reclique sur H0D Loot.");
  }

  let opened = 0;
  for (const token of candidates) {
    const loot = await getTokenLoot(token.document, {migrate:false});
    if (!loot) continue;
    await surfaceTokenLoot(token.document, loot, {privateToUser:true});
    opened++;
  }

  if (!opened) ui.notifications?.warn("H0D Loot : aucune carcasse ciblée ne possède de butin généré.");
}

async function generateControlled() {
  if (!game.user?.isGM) return;
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return manualLootDialog();

  let made = 0;
  let skipped = 0;
  for (const token of tokens) {
    const type = detectType(token.actor);
    if (!type) { skipped++; continue; }

    const previous = await getTokenLoot(token.document, {migrate:true});
    if (previous) {
      skipped++;
      ui.notifications?.warn(`${token.name} possède déjà un butin H0D. Utilise le bouton ↻ H0D Loot pour le régénérer.`);
      continue;
    }

    try {
      await generateForToken(token, type);
      made++;
    } catch (err) {
      console.error(`H0D Loot | erreur pour ${token.name}`, err);
      ui.notifications?.error(`H0D Loot : erreur sur ${token.name}. Voir la console.`);
    }
  }
  if (!made && skipped) ui.notifications?.warn("H0D Loot : aucun nouveau butin généré.");
}

async function regenerateControlledLoot() {
  if (!game.user?.isGM) return;
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return ui.notifications?.warn("H0D Loot : sélectionne au moins une carcasse à régénérer.");

  const proceed = await foundry.applications.api.DialogV2.confirm({
    window:{title:"H0D Loot — régénérer"},
    content:`<p>Régénérer le butin de <strong>${tokens.length}</strong> token(s) ?</p><p>Le contenu restant de la carcasse sera remplacé. Cette action permet volontairement un nouveau tirage.</p>`,
    yes:{label:"Régénérer", icon:"fa-solid fa-rotate"},
    no:{label:"Annuler"},
    rejectClose:false,
    modal:true
  });
  if (!proceed) return;

  for (const token of tokens) {
    const type = detectType(token.actor);
    if (!type) continue;
    await clearTokenLoot(token.document, {deleteCards:true});
    await generateForToken(token, type);
  }
}

async function generateForToken(token, type) {
  const actor = token.actor;
  const creatureType = String(actor.system?.props?.H0D_Creature_Type || "");
  const harvest=type==="creature"?
    normalizeHarvestProfile(token.document.getFlag(MODULE_ID,HARVEST_FLAG)??{}):null;
  let loot;

  if (type === "humanoid") {
    const items = buildHumanoidLoot(actor);
    loot = {
      schema:2,
      lootId:foundry.utils.randomID(),
      title:`Butin — ${token.name}`,
      source:{
        tokenUuid:token.document.uuid,
        actorUuid:actor.uuid,
        actorName:actor.name,
        type,
        creatureType,
        menace:null,
        menaceUsed:null,
        formula:null,
        draws:null,
        rareNotes:[]
      },
      items,
      claims:[],
      createdAt:Date.now()
    };
  } else {
    const rawMenace = getMenace(actor, type);
    const menace = clamp(Math.floor(rawMenace || 1), 1, 10);
    const formula = MENACE_LOOT[menace];
    const countRoll = await (new Roll(formula)).evaluate();
    const draws = Math.max(0, Number(countRoll.total || 0));

    const tableName = game.settings.get(MODULE_ID, type === "machine" ? "machineTable" : "creatureTable");
    const table = game.tables.getName(tableName);
    if (!table) throw new Error(`Table introuvable : ${tableName}`);

    const lootMap = new Map();
    let effectiveDraws=draws;
    if(type==="creature"&&harvest.mode==="directed"){
      const selection=selectHarvestResults(table,harvest,draws);
      effectiveDraws=selection.draws;
      for(const result of selection.results)addTableResult(lootMap,result,1);
    }else if(draws>0){
      const draw=await table.drawMany(draws,{displayChat:false,recursive:true});
      for(const result of draw.results??[])addTableResult(lootMap,result,1);
    }

    const rareNotes = [];
    if (type === "machine") {
      const examined = new Set();
      for (const part of findRecoverableMachineParts(actor)) {
        if (part.kind === "resource") {
          addLoot(lootMap, part.resource, 1, part.note, {
            category:part.category || "Ressource",
            keyPrefix:part.category ? `${part.category}:` : ""
          });
        } else {
          lootMap.set(part.entryId, part);
        }
        if (part.label) examined.add(part.label);
      }
      rareNotes.push(...examined);
    }

    loot = {
      schema:2,
      lootId:foundry.utils.randomID(),
      title:`Butin — ${token.name}`,
      source:{
        tokenUuid:token.document.uuid,
        actorUuid:actor.uuid,
        actorName:actor.name,
        type,
        creatureType,
        menace:rawMenace,
        menaceUsed:menace,
        formula,
        draws:effectiveDraws,
        harvest:type==="creature"?harvest:null,
        rareNotes
      },
      items:[...lootMap.values()].sort(sortLootEntries),
      claims:[],
      createdAt:Date.now()
    };

    if (rawMenace > 10) {
      ui.notifications?.warn(`${token.name} : Menace ${rawMenace}, barème plafonné à 10 (${formula}).`);
    }
  }

  await token.document.setFlag(MODULE_ID, TOKEN_FLAG, {
    version:2,
    lootId:loot.lootId,
    loot,
    messageIds:[],
    createdAt:Date.now(),
    depleted:loot.items.every(i => Number(i.quantity || 0) <= 0)
  });

  // Les pièces détachables réellement détruites ne produisent aucun loot.
  // Un rapport séparé, privé aux MJ, permet de vérifier la chaîne PV → état → loot
  // sans polluer la carte visible par les joueurs.
  if (type === "machine") {
    const report = await createDestroyedPartsGMMessage(token.document, actor);
    if (report && game.user?.isGM) {
      const state = token.document.getFlag(MODULE_ID, TOKEN_FLAG) || {};
      const ids = new Set(state.messageIds || []);
      ids.add(report.id);
      await token.document.setFlag(MODULE_ID, TOKEN_FLAG, {...state, messageIds:[...ids]});
    }
  }

  if (game.settings.get(MODULE_ID, "announceGeneration")) {
    await surfaceTokenLoot(token.document, loot, {privateToUser:false});
  } else {
    ui.notifications?.info(`${token.name} : butin H0D généré sur la carcasse.`);
  }

  return loot;
}

function buildHumanoidLoot(actor) {
  const entries = [];
  const excludeNatural = game.settings.get(MODULE_ID, "excludeNaturalAttacks");

  for (const item of actor.items ?? []) {
    const templateId = String(item.system?.template || "");
    const p = item.system?.props ?? {};
    const stockage = String(p.H0D_Stockage || "");
    if (stockage && stockage !== "PJ") continue;

    let category = null;
    let quantity = 1;
    let quantityField = null;

    if (templateId === WEAPON_TEMPLATE_ID) {
      if (excludeNatural && isNaturalAttackItem(item)) continue;
      category = "Arme";
    } else if (templateId === ARMOR_TEMPLATE_ID) {
      category = "Armure";
    } else if (templateId === OBJECT_TEMPLATE_ID) {
      const isAmmo = norm(p.H0D_Objet_Type) === "munition";
      category = isAmmo ? "Munition" : "Objet";
      if (Object.prototype.hasOwnProperty.call(p, "H0D_Objet_Quantite")) {
        quantityField = "H0D_Objet_Quantite";
        quantity = Math.max(0, Math.floor(Number(p.H0D_Objet_Quantite || 0)));
      }
    } else if (templateId === RESOURCE_TEMPLATE_ID) {
      category = "Ressource";
      quantityField = "H0D_Ressource_Quantite";
      quantity = Math.max(0, Math.floor(Number(p.H0D_Ressource_Quantite || 0)));
    } else {
      continue;
    }

    if (quantity <= 0) continue;
    entries.push({
      entryId:foundry.utils.randomID(),
      kind:"embedded",
      sourceItemId:item.id,
      templateId,
      resourceId: templateId === RESOURCE_TEMPLATE_ID ? (item.getFlag?.(MODULE_ID,"resourceId") || resourceByName.get(norm(item.name))?.id || null) : null,
      name:item.name,
      img:item.img || "icons/svg/item-bag.svg",
      quantity,
      quantityField,
      category,
      note:"Possession réelle"
    });
  }

  return entries.sort(sortLootEntries);
}

function isNaturalAttackItem(item) {
  const n = norm(item.name);
  const naturalNames = [
    "poing", "poings", "morsure", "griffe", "griffes", "croc", "crocs", "bec", "queue",
    "corne", "cornes", "tentacule", "tentacules", "attaque naturelle", "coup de patte"
  ];
  return naturalNames.some(x => n === x || n.startsWith(`${x} `));
}

function addTableResult(map, result, quantity=1) {
  const flaggedId = result.getFlag?.(MODULE_ID, "resourceId") ?? result.flags?.[MODULE_ID]?.resourceId;
  const text = String(result.description || result.text || result.name || "").trim();
  let resource = flaggedId ? resourceLibrary.get(flaggedId) : null;
  if (!resource && text) resource = resourceByName.get(norm(text));

  if (resource) addLoot(map, resource, quantity, "Table de loot");
  else if (text) {
    const key = `text:${norm(text)}`;
    const current = map.get(key);
    if (current) current.quantity += quantity;
    else map.set(key, {
      entryId:foundry.utils.randomID(), kind:"text", resourceId:null,
      name:text, img:result.img || "icons/svg/item-bag.svg", quantity,
      category:"Résultat", note:"Résultat texte — non transférable automatiquement"
    });
  }
}

function addLoot(map, resource, quantity, note="", {category="Ressource", keyPrefix=""} = {}) {
  if (!resource || quantity <= 0) return;
  const key = `${keyPrefix}${resource.id}`;
  const current = map.get(key);
  if (current) {
    current.quantity += quantity;
    if (note && !current.note.includes(note)) current.note = [current.note, note].filter(Boolean).join(" · ");
  } else {
    map.set(key, {
      entryId:foundry.utils.randomID(), kind:"resource", resourceId:resource.id,
      name:resource.name, img:resource.source?.img || "icons/svg/item-bag.svg",
      quantity, category, note
    });
  }
}

// La fiche Machine est l'autorité pour les pièces physiques : jamais les attaques abstraites.
// Canon récupération : une pièce détachée à PV > 0 reste exploitable pour le craft.
// Une pièce détachée à 0 PV devient un composant détérioré ET fournit 1 ressource secondaire.
function machinePartIsChassis(item) {
  return /chassis/.test(norm([item.name, item.system?.props?.H0D_Composant_Type].join(" ")));
}

function genericMachineResourceByName(name) {
  const resource = resourceByName.get(norm(name)) ?? null;
  if (!resource) return null;
  const type = String(resource.source?.system?.props?.H0D_Ressource_Type || "");
  return ["Plaque","Fibre","Lentille","Cellule","Circuit","Fluide","Noyau"].includes(type) ? resource : null;
}

function fluidResourceFromText(text) {
  const n = norm(text);
  const mapping = [
    [/blaze|feu/, "Fluide élémentaire — Blaze"],
    [/chillwater|cryo|cryogen|gel/, "Fluide élémentaire — Chillwater"],
    [/metalburn|acide/, "Fluide élémentaire — Metalburn"],
    [/sparker|etincelle/, "Fluide élémentaire — Sparker"]
  ];
  for (const [pattern, name] of mapping) {
    if (!pattern.test(n)) continue;
    const found = genericMachineResourceByName(name);
    if (found) return found;
  }
  return null;
}

function nucleusResourceForMachine(actor) {
  const p = actor?.system?.props ?? {};
  const category = norm(p.H0D_Machine_Categorie || "");
  let name = null;
  if (/petite/.test(category)) name = "Noyau de petite machine";
  else if (/moyenne/.test(category)) name = "Noyau de machine moyenne";
  else if (/lourde|titan|prototype/.test(category)) name = "Noyau de machine lourde";
  if (!name) return null;
  return genericMachineResourceByName(name);
}

function damagedMachineResource(item, actor=null) {
  const p = item.system?.props ?? {};
  const type = norm(p.H0D_Composant_Type || "");
  const named = String(p.H0D_Composant_Loot ?? "").trim();
  const text = norm([
    item.name,
    p.H0D_Composant_Type,
    p.H0D_Composant_Loot,
    p.H0D_Composant_Emplacement,
    p.H0D_Composant_Notes
  ].join(" "));

  // Si la fiche fournit déjà une ressource générique connue, elle est prioritaire.
  const fromField = genericMachineResourceByName(named);
  if (fromField) return fromField;

  // Cœurs / noyaux -> noyau correspondant au gabarit de la machine.
  if (type === "noyau" || /\bcoeur\b|\bnoyau\b/.test(text)) {
    return nucleusResourceForMachine(actor);
  }

  // Réservoirs / bonbonnes / sacs de fluide -> fluide élémentaire correspondant.
  if (type === "reservoir" || /reservoir|bonbonne|sac de fluide|poche de fluide/.test(text)) {
    return fluidResourceFromText(text);
  }

  // Éléments souples / stabilisateurs / câblages -> fibre synthétique.
  if (/stabilisateur|cablage|cable|fibre|filament|faisceau|tendon|souple/.test(text)) {
    return genericMachineResourceByName("Fibres synthétiques");
  }

  // Batteries / réacteurs / générateurs -> cellule d'énergie.
  if (type === "generateur" || type === "moteur" || /batterie|reacteur|generateur|accumulateur|cellule d energie/.test(text)) {
    return genericMachineResourceByName("Cellule d’énergie faible");
  }

  // Optiques / radars / capteurs -> lentille optique.
  if (type === "capteur" || /oeil|optique|radar|capteur|lentille/.test(text)) {
    return genericMachineResourceByName("Lentilles optiques");
  }

  // Électronique / modules -> circuit ancien.
  if (/circuit|relais|electronique|module|processeur|balise|emetteur|recepteur|interface/.test(text)) {
    return genericMachineResourceByName("Circuit ancien abîmé");
  }

  // Une mention explicite d'un fluide reste exploitable même si le type est Autre/Cargo.
  const fluid = fluidResourceFromText(text);
  if (fluid && /fluide|blaze|chillwater|cryo|metalburn|sparker/.test(text)) return fluid;

  // Structures rigides / griffes / plaques / membres -> plaque métallique.
  if (["blindage","structure","mobilite","cargo"].includes(type)
      || /structure|griffe|plaque|blindage|membre|patte|aile|carapace|coque|armature/.test(text)) {
    return genericMachineResourceByName("Plaques métalliques");
  }

  return null;
}

function machinePieceLootEntry(item, actor, {hp, max, category, condition, deteriorated=false} = {}) {
  const p = item.system?.props ?? {};
  return {
    entryId:foundry.utils.randomID(),
    kind:"machine-piece",
    sourceItemId:item.id,
    name:item.name,
    img:item.img,
    quantity:1,
    category,
    condition,
    deteriorated,
    sourceHp:hp,
    sourceMaxHp:max,
    sourceState:String(p.H0D_Composant_Etat || "Intact"),
    note:deteriorated
      ? `Pièce détachée détériorée — ${hp}/${max} PV`
      : `Pièce physique exploitable — ${hp}/${max} PV`,
    label:item.name,
    origin:actor.name,
    partProps:foundry.utils.deepClone(p)
  };
}

function findRecoverableMachineParts(actor) {
  const entries = [];
  const bool = v => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

  for(const item of actor.items ?? []) {
    const p = item.system?.props ?? {};
    if(item.system?.template !== "H0DCompMach00001" && !(p.H0D_Composant_PV_Max !== undefined && p.H0D_Composant_Etat !== undefined)) continue;
    if(machinePartIsChassis(item) || !bool(p.H0D_Composant_Detachable)) continue;
    if(p.H0D_Composant_Recuperable !== undefined && !bool(p.H0D_Composant_Recuperable)) continue;

    const max = Math.max(0,Number(p.H0D_Composant_PV_Max)||0);
    const hp = Math.max(0, Math.min(max,Number(p.H0D_Composant_PV_Actuels)||0));
    const state = String(p.H0D_Composant_Etat || "Intact");
    const stateNorm = norm(state);

    // Détruite = aucun composant physique exploitable dans cette règle.
    if(stateNorm === "detruit") continue;

    // Détachée : l'état physique de la pièce prime.
    if(stateNorm === "detache") {
      if(hp > 0) {
        entries.push(machinePieceLootEntry(item, actor, {
          hp, max,
          category:"Composants préservés",
          condition:hp < max ? "Endommage" : "Intact",
          deteriorated:false
        }));
      } else {
        entries.push(machinePieceLootEntry(item, actor, {
          hp, max,
          category:"Composants détériorés",
          condition:"Casse",
          deteriorated:true
        }));

        const resource = damagedMachineResource(item, actor);
        if(resource) {
          entries.push({
            entryId:foundry.utils.randomID(),
            kind:"resource",
            resource,
            quantity:1,
            category:"Récupération secondaire",
            note:`Issue de ${item.name} détérioré (0/${max} PV)`,
            label:item.name
          });
        } else {
          entries.push({
            entryId:foundry.utils.randomID(),
            kind:"text",
            name:`Récupération secondaire — ${item.name}`,
            img:item.img,
            quantity:1,
            category:"À arbitrer par le MJ",
            note:"Famille de récupération non déterminée automatiquement",
            label:item.name
          });
        }
      }
      continue;
    }

    // Pièce encore montée mais endommagée : ancien comportement de recyclage conservé.
    if(hp === 0) {
      entries.push({
        entryId:foundry.utils.randomID(),kind:"text",name:item.name,img:item.img,quantity:1,
        category:"À arbitrer par le MJ",note:"Pièce à 0 PV non détachée — état de récupération ambigu",label:item.name
      });
    } else if(hp < max || stateNorm === "endommage") {
      const resource = damagedMachineResource(item, actor);
      if(resource) {
        entries.push({
          entryId:foundry.utils.randomID(),kind:"resource",resource,quantity:1,
          note:`Recyclage de ${item.name} (${hp}/${max} PV)`,label:item.name
        });
      }
    } else {
      entries.push(machinePieceLootEntry(item, actor, {
        hp, max,
        category:"Composants préservés",
        condition:"Intact",
        deteriorated:false
      }));
    }
  }

  return entries;
}

function findDestroyedMachineParts(actor) {
  const out = [];
  const bool = v => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

  for (const item of actor.items ?? []) {
    const p = item.system?.props ?? {};
    const isPiece = item.system?.template === "H0DCompMach00001"
      || (p.H0D_Composant_PV_Max !== undefined && p.H0D_Composant_Etat !== undefined);
    if (!isPiece) continue;
    if (!bool(p.H0D_Composant_Detachable)) continue;

    const stateNorm = norm(String(p.H0D_Composant_Etat || ""));
    if (stateNorm !== "detruit") continue;

    const max = Math.max(0, Number(p.H0D_Composant_PV_Max) || 0);
    const hp = Math.max(0, Math.min(max, Number(p.H0D_Composant_PV_Actuels) || 0));
    out.push({
      id:item.id,
      name:item.name,
      img:item.img || "icons/svg/item-bag.svg",
      hp,
      max
    });
  }

  return out.sort((a,b) => String(a.name).localeCompare(String(b.name), "fr"));
}

function renderDestroyedPartsReport(tokenName, parts) {
  const rows = parts.map(part => `
    <div class="h0d-loot-row h0d-loot-destroyed-row">
      <img src="${esc(part.img)}" alt="">
      <div class="h0d-loot-item">
        <strong>${esc(part.name)}</strong>
        <small>Détruite · ${part.hp}/${part.max} PV · aucun rendement</small>
      </div>
      <span class="h0d-loot-destroyed-mark"><i class="fa-solid fa-ban"></i></span>
    </div>`
  ).join("");

  return `<div class="h0d-loot-card h0d-loot-gm-audit">
    <header>
      <div>
        <strong>Rapport MJ — ${esc(tokenName)}</strong>
        <small>Composants détruits · non récupérables</small>
      </div>
      <i class="fa-solid fa-triangle-exclamation"></i>
    </header>
    <div class="h0d-loot-warning">Ces pièces ne génèrent ni composant, ni récupération secondaire.</div>
    <section>
      <div class="h0d-loot-group">
        <div class="h0d-loot-group-title">Composants détruits</div>
        ${rows}
      </div>
    </section>
  </div>`;
}

async function createDestroyedPartsGMMessage(tokenDoc, actor) {
  const parts = findDestroyedMachineParts(actor);
  if (!parts.length) return null;

  const whisper = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
  if (!whisper.length && game.user?.id) whisper.push(game.user.id);

  const data = {
    content:renderDestroyedPartsReport(tokenDoc?.name || actor?.name || "Machine", parts),
    whisper,
    flags:{[MODULE_ID]:{
      destroyedPartsReport:true,
      tokenUuid:tokenDoc?.uuid || null,
      actorUuid:actor?.uuid || null
    }}
  };
  if (tokenDoc) data.speaker = ChatMessage.getSpeaker({token:tokenDoc.object ?? tokenDoc});
  return ChatMessage.create(data);
}

/** Garde la fenêtre ouverte entre deux générations, tout en sérialisant les clics. */
async function h0dPersistentDialog(options,run) {
  const Dialog=foundry.applications.api.DialogV2;
  await Dialog.wait({
    window:options.window,
    content:options.content+
      '<div class="h0d-batch-controls" style="margin-top:10px;display:flex;gap:8px;align-items:center;">'+
      '<button type="button" data-h0d-batch-run><i class="fa-solid fa-gears"></i> Exécuter</button>'+
      '<small data-h0d-batch-status aria-live="polite">Prêt à générer plusieurs éléments.</small></div>',
    buttons:[{action:"close",label:"Fermer",icon:"fa-solid fa-xmark"}],
    rejectClose:false,
    render:(_event,dialog)=>{
      const root=dialog.element,button=root?.querySelector("[data-h0d-batch-run]"),
        status=root?.querySelector("[data-h0d-batch-status]");
      if(!button||!status||button.dataset.bound==="yes")return;
      button.dataset.bound="yes";
      let busy=false;
      button.addEventListener("click",async()=>{
        if(busy)return;
        const form=root.querySelector("form");
        if(!form)return;
        const input=Object.fromEntries(new FormData(form).entries());
        busy=true;button.disabled=true;
        const close=root.querySelector('[data-action="close"]');
        if(close)close.disabled=true;
        status.textContent="Opération en cours…";
        try{
          await run(input);
          status.textContent="Terminé. Tu peux générer un autre élément.";
        }catch(err){
          console.error("H0D | génération",err);
          status.textContent="Erreur : "+(err?.message??err);
          ui.notifications?.error("H0D : "+(err?.message??err));
        }finally{
          busy=false;button.disabled=false;
          if(close)close.disabled=false;
        }
      });
    }
  });
}


/** Configuration MJ persistante sur chaque TokenDocument de faune. */
async function configureHarvestForSelection(){
  if(!game.user?.isGM)return;
  const all=canvas?.tokens?.controlled??[];
  const tokens=all.filter(token=>detectType(token.actor)==="creature");
  if(!tokens.length)
    return ui.notifications?.warn("H0D Loot : sélectionne une ou plusieurs carcasses de faune (ni machines ni PNJ).");
  if(tokens.length!==all.length)
    ui.notifications?.warn("H0D Loot : les machines et humanoïdes sélectionnés sont ignorés.");
  const initial=normalizeHarvestProfile(tokens[0].document.getFlag(MODULE_ID,HARVEST_FLAG)??{});
  const selected=(x,y)=>x===y?"selected":"";
  const checked=x=>x?"checked":"";
  await h0dPersistentDialog({
    window:{title:"H0D Loot — récolte après scan ("+tokens.length+" carcasse(s))"},
    content:`<div class="h0d-loot-dialog h0d-harvest-dialog">
      <p><strong>Cibles :</strong> ${tokens.map(t=>esc(t.name)).join(", ")}</p>
      <p>Le MJ fixe les ressources récupérables d'après la narration / le Focus ; ce n'est pas un tirage automatique de diagnostic.</p>
      <div class="form-group"><label>Mode
        <select name="mode">
          <option value="free" ${selected(initial.mode,"free")}>Tirage habituel (table générique)</option>
          <option value="directed" ${selected(initial.mode,"directed")}>Récolte dirigée MJ / scan</option>
        </select></label></div>
      <fieldset><legend>Ressources autorisées</legend>
        ${HARVEST_KINDS.map(({key,label})=>`<label style="display:block">
          <input type="checkbox" name="allow_${key}" ${checked(initial.allowed[key])}> ${esc(label)}</label>`).join("")}
      </fieldset>
      <div class="form-group"><label>Ressource garantie
        <select name="guaranteed">
          <option value="">Aucune</option>
          ${HARVEST_KINDS.filter(x=>x.key!=="other").map(({key,label})=>
            `<option value="${key}" ${selected(initial.guaranteed,key)}>${esc(label)}</option>`).join("")}
        </select></label></div>
      <div class="form-group"><label>Information établie par le scan / décision MJ
        <textarea name="note" rows="2" maxlength="700"
          placeholder="Ex. Viande peu consommable ; peau encore récupérable.">${esc(initial.note)}</textarea>
      </label></div>
      <label style="display:block"><input name="updateExisting" type="checkbox" checked>
        Corriger aussi le butin déjà généré (sans reroll ni suppression des prises)</label>
      <small>Chiens sauvages : choisir « dirigée », décocher Viande, garder Peau,
        garantir Peau. Laisser Os autorisé si souhaité.</small>
    </div>`
  },async fd=>{
    const allowed=Object.fromEntries(HARVEST_KINDS.map(x=>[x.key,fd["allow_"+x.key]==="on"]));
    const profile=normalizeHarvestProfile({
      mode:fd.mode,allowed,guaranteed:String(fd.guaranteed??""),note:fd.note
    });
    const updateExisting=fd.updateExisting==="on";
    const tableName=game.settings.get(MODULE_ID,"creatureTable");
    const table=game.tables.getName(tableName);
    if(profile.mode==="directed"&&!table)
      throw new Error("Table de faune introuvable : "+tableName);
    // Construire toutes les corrections AVANT d'enregistrer les profils de groupe.
    // Si une peau garantie n'existe pas dans la table, ne rien modifier.
    const revisions=[];
    for(const token of tokens){
      const old=updateExisting?await getTokenLoot(token.document,{migrate:true}):null;
      if(old){
        const revision=reconcileHarvestLoot(old,profile,table,{
          addResult:(items,result)=>{
            const map=new Map();
            for(const item of items){
              const key=item.kind==="resource"&&item.resourceId?item.resourceId:
                item.kind==="text"?"text:"+norm(item.name):item.entryId;
              map.set(key,item);
            }
            addTableResult(map,result,1);
            items.splice(0,items.length,...[...map.values()].sort(sortLootEntries));
          }
        });
        revisions.push({token,revision});
      }
    }
    let updated=0,claimed=0;
    for(const token of tokens){
      const matched=revisions.find(r=>r.token===token);
      if(matched){
        await persistLoot(null,matched.revision.loot,token.document);
        claimed+=matched.revision.alreadyClaimed.length;
        updated++;
      }
      await token.document.setFlag(MODULE_ID,HARVEST_FLAG,profile);
    }
    ui.notifications?.info("H0D Loot : scan / récolte enregistrés sur "+tokens.length+
      " carcasse(s), "+updated+" butin(s) existant(s) corrigé(s)."+
      (claimed?" Prélèvements antérieurs préservés, non repris aux PJ.":""));
  });
}

async function manualLootDialog() {
  if (!game.user?.isGM) return;
  await h0dPersistentDialog({
    window:{title:"H0D Loot — génération manuelle"},
    content:`<div class="h0d-loot-dialog">
      <div class="form-group"><label>Type</label><select name="type"><option value="machine">Machine</option><option value="creature">Créature</option></select></div>
      <div class="form-group"><label>Nombre</label><input type="number" name="nombre" value="1" min="1" max="50"></div>
      <div class="form-group"><label>Niveau de Menace</label><input type="number" name="menace" value="1" min="1" max="10"></div>
    </div>`,
  }, async fd => {

  const type = String(fd.type || "machine");
  const nombre = clamp(Math.floor(Number(fd.nombre || 1)), 1, 50);
  const menace = clamp(Math.floor(Number(fd.menace || 1)), 1, 10);
  const formula = MENACE_LOOT[menace];
  let draws = 0;
  for (let i=0; i<nombre; i++) {
    const r = await (new Roll(formula)).evaluate();
    draws += Math.max(0, Number(r.total || 0));
  }

  const tableName = game.settings.get(MODULE_ID, type === "machine" ? "machineTable" : "creatureTable");
  const table = game.tables.getName(tableName);
  if (!table) return ui.notifications?.error(`H0D Loot : table introuvable — ${tableName}`);

  const map = new Map();
  if (draws > 0) {
    const draw = await table.drawMany(draws, {displayChat:false, recursive:true});
    for (const result of draw.results ?? []) addTableResult(map, result, 1);
  }
  const loot = {
    schema:2, lootId:foundry.utils.randomID(),
    title:`Butin manuel — ${nombre} ${type === "machine" ? "machine(s)" : "créature(s)"}`,
    source:{tokenUuid:null, actorUuid:null, actorName:null, type, menace, menaceUsed:menace, formula, draws, rareNotes:[]},
    items:[...map.values()].sort(sortLootEntries), claims:[], createdAt:Date.now()
  };
  await createLootMessage(loot, {whisper:null});
  });
}

async function getTokenLoot(tokenDoc, {migrate=false} = {}) {
  const state = tokenDoc?.getFlag(MODULE_ID, TOKEN_FLAG);
  if (!state) return null;
  if (state.loot) return foundry.utils.deepClone(state.loot);

  if (migrate && state.messageId) {
    const message = game.messages.get(state.messageId);
    const legacy = message?.getFlag(MODULE_ID, LOOT_FLAG);
    if (legacy) {
      const loot = migrateLoot(legacy, tokenDoc.uuid);
      await tokenDoc.setFlag(MODULE_ID, TOKEN_FLAG, {
        version:2, lootId:loot.lootId, loot,
        messageIds:[state.messageId], createdAt:state.createdAt || Date.now(),
        depleted:loot.items.every(i=>Number(i.quantity||0)<=0)
      });
      return loot;
    }
  }
  return null;
}

function migrateLoot(raw, tokenUuid=null) {
  const loot = foundry.utils.deepClone(raw || {});
  loot.schema = 2;
  loot.lootId ||= foundry.utils.randomID();
  loot.source ||= {};
  if (tokenUuid) loot.source.tokenUuid = tokenUuid;
  loot.items = (loot.items || []).map(i => ({
    entryId:i.entryId || foundry.utils.randomID(),
    kind:i.kind || (i.resourceId ? "resource" : "text"),
    category:i.category || (i.resourceId ? "Ressource" : "Résultat"),
    ...i
  }));
  loot.claims ||= [];
  return loot;
}

async function surfaceTokenLoot(tokenDoc, loot, {privateToUser=false} = {}) {
  const whisper = privateToUser ? [game.user.id] : null;
  const message = await createLootMessage(loot, {whisper, tokenDoc});

  if (game.user?.isGM) {
    const state = tokenDoc.getFlag(MODULE_ID, TOKEN_FLAG) || {};
    const ids = new Set(state.messageIds || []);
    ids.add(message.id);
    await tokenDoc.setFlag(MODULE_ID, TOKEN_FLAG, {...state, version:2, lootId:loot.lootId, loot, messageIds:[...ids]});
  }
  return message;
}

async function createLootMessage(loot, {whisper=null, tokenDoc=null} = {}) {
  const data = {
    content:renderLootCard(loot),
    flags:{[MODULE_ID]:{[LOOT_FLAG]:loot}}
  };
  if (tokenDoc) data.speaker = ChatMessage.getSpeaker({token:tokenDoc.object ?? tokenDoc});
  if (whisper?.length) data.whisper = whisper;
  return ChatMessage.create(data);
}

async function resetControlledLoot() {
  if (!game.user?.isGM) return;
  const tokens = canvas?.tokens?.controlled ?? [];
  if (!tokens.length) return ui.notifications?.warn("H0D Loot : sélectionne au moins un token.");
  for (const token of tokens) await clearTokenLoot(token.document, {deleteCards:false});
  ui.notifications?.info(`H0D Loot : ${tokens.length} token(s) réinitialisé(s).`);
}

async function clearTokenLoot(tokenDoc, {deleteCards=false} = {}) {
  const state = tokenDoc.getFlag(MODULE_ID, TOKEN_FLAG) || {};
  if (deleteCards) {
    const ids = new Set([...(state.messageIds || []), state.messageId].filter(Boolean));
    for (const id of ids) {
      const msg = game.messages.get(id);
      if (msg) await msg.delete().catch(()=>{});
    }
  }
  await tokenDoc.unsetFlag(MODULE_ID, TOKEN_FLAG);
}

function renderLootCard(loot) {
  const claimable = game.settings.get(MODULE_ID, "playersCanClaim");
  const remaining = loot.items.reduce((n,i)=>n+Math.max(0,Number(i.quantity||0)),0);
  const typeLabel = sourceTypeLabel(loot.source);
  const meta = sourceMeta(loot.source);
  const warning = Number(loot.source?.menace) > 10
    ? `<div class="h0d-loot-warning">Menace ${esc(loot.source.menace)} : barème plafonné à 10.</div>` : "";
  const scanNote=loot.source?.harvest?.note?
    `<div class="h0d-loot-rare"><strong>Observation du scan / arbitrage MJ :</strong> ${esc(loot.source.harvest.note)}</div>`:"";
  const harvestBadge=loot.source?.harvest?.mode==="directed"?
    `<div class="h0d-loot-rare"><strong>Récolte dirigée MJ :</strong> ${esc(
      HARVEST_KINDS.filter(x=>loot.source.harvest.allowed?.[x.key]).map(x=>x.label).join(", ")||"Aucune ressource"
    )}${loot.source.harvest.guaranteed?" · "+esc(HARVEST_LABELS[loot.source.harvest.guaranteed])+" garantie":""}</div>`:"";
  const rare = loot.source?.rareNotes?.length
    ? `<div class="h0d-loot-rare"><strong>Composants examinés :</strong> ${loot.source.rareNotes.map(esc).join(" · ")}</div>` : "";

  const groups = new Map();
  for (const item of loot.items || []) {
    const cat = item.category || "Autre";
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }

  const sections = groups.size ? [...groups.entries()].map(([category, items]) => {
    const rows = items.map(item => {
      const q = Math.max(0, Number(item.quantity || 0));
      const transferable = isTransferable(item);
      const disabled = q <= 0 || !transferable || !claimable;
      const actions = !disabled ? `<span class="h0d-loot-actions">
        <button type="button" data-h0d-loot-action="take-one" data-entry-id="${esc(item.entryId)}" title="Prendre 1"><i class="fa-solid fa-hand"></i> 1</button>
        <button type="button" data-h0d-loot-action="take-all-row" data-entry-id="${esc(item.entryId)}" title="Prendre tout ce type"><i class="fa-solid fa-box"></i></button>
      </span>` : (q <= 0 ? `<span class="h0d-loot-empty">pris</span>` : "");
      return `<div class="h0d-loot-row ${q<=0?"is-empty":""}">
        <img src="${esc(item.img)}" alt="">
        <div class="h0d-loot-item"><strong>${esc(item.name)}</strong>${item.note?`<small>${esc(item.note)}</small>`:""}</div>
        <span class="h0d-loot-qty">×${q}</span>${actions}
      </div>`;
    }).join("");
    return `<div class="h0d-loot-group"><div class="h0d-loot-group-title">${esc(category)}</div>${rows}</div>`;
  }).join("") : `<div class="h0d-loot-none">Aucun butin récupérable.</div>`;

  const allButton = claimable && remaining > 0 && loot.items.some(i=>isTransferable(i) && Number(i.quantity)>0)
    ? `<button type="button" class="h0d-loot-take-all" data-h0d-loot-action="take-all"><i class="fa-solid fa-sack-dollar"></i> Tout récupérer</button>` : "";

  return `<div class="h0d-loot-card" data-loot-id="${esc(loot.lootId)}">
    <header><div><strong>${esc(loot.title)}</strong><small>${esc(typeLabel)}${meta ? ` · ${esc(meta)}` : ""}</small></div><i class="fa-solid fa-box-open"></i></header>
    ${warning}${scanNote}${harvestBadge}${rare}<section>${sections}</section><footer><span>Reste : <strong>${remaining}</strong></span>${allButton}</footer>
  </div>`;
}

function sourceTypeLabel(source={}) {
  if (source.type === "machine") return "Machine";
  if (source.type === "humanoid") return source.creatureType === "Faction" ? "Membre de faction" : "PNJ";
  if (source.type === "creature") return "Créature";
  return "Butin";
}

function sourceMeta(source={}) {
  if (source.type === "humanoid") return "possessions réelles";
  if (source.formula) return `Menace ${source.menace} · ${source.formula} → ${source.draws} tirage(s)`;
  return "";
}

async function requestClaim(messageId, entryId, quantity) {
  if (!game.settings.get(MODULE_ID, "playersCanClaim")) return;
  const recipient = await chooseRecipientActor();
  if (!recipient?.actor) return;
  const actor = recipient.actor;
  const message = game.messages.get(messageId);
  const snapshot = message?.getFlag(MODULE_ID, LOOT_FLAG);
  if (!snapshot) return ui.notifications?.warn("H0D Loot : carte de butin invalide.");

  const payload = {
    type:"claim",
    userId:game.user.id,
    actorId:actor.id,
    actorUuid:actor.uuid || null,
    recipientTokenUuid:recipient.tokenUuid || null,
    messageId,
    lootId:snapshot.lootId,
    tokenUuid:snapshot.source?.tokenUuid || null,
    entryId,
    quantity
  };

  if (isPrimaryGM()) await processClaim(payload);
  else {
    const gm = primaryGM();
    if (!gm) return ui.notifications?.error("H0D Loot : aucun MJ actif pour sécuriser le transfert.");
    game.socket.emit(SOCKET, payload);
    ui.notifications?.info(`H0D Loot : récupération vers ${actor.name} en cours…`);
  }
}

function isPlayerCharacterActor(actor) {
  const p = actor?.system?.props ?? {};
  return Object.prototype.hasOwnProperty.call(p, "H0D_PV_Actuels")
    && !Object.prototype.hasOwnProperty.call(p, "H0D_Machine_PV_Actuels")
    && !Object.prototype.hasOwnProperty.call(p, "H0D_Creature_PV_Actuels");
}

function actorOwnedByUser(actor, user=game.user) {
  if (!actor || !user) return false;
  try {
    return actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  } catch (_) {
    return !!actor.isOwner;
  }
}

function uniqueRecipientCandidates(candidates=[]) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!c?.actor || !isPlayerCharacterActor(c.actor)) continue;
    const key = c.tokenUuid || c.actor.uuid || c.actor.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

async function chooseRecipientFromList(candidates, title="H0D Loot — destinataire") {
  const clean = uniqueRecipientCandidates(candidates);
  if (clean.length === 1) return clean[0];
  if (!clean.length) return null;

  const opts = clean.map((c, index) => {
    const source = c.tokenUuid ? "token contrôlé" : "personnage possédé";
    return `<option value="${index}">${esc(c.actor.name)} — ${source}</option>`;
  }).join("");

  const fd = await foundry.applications.api.DialogV2.input({
    window:{title},
    content:`<div class="form-group"><label>Ajouter le butin à</label><select name="recipientIndex">${opts}</select></div>`,
    ok:{label:"Choisir"}, rejectClose:false, modal:true
  });
  if (!fd) return null;
  return clean[Number(fd.recipientIndex)] ?? null;
}

async function chooseRecipientActor() {
  const user = game.user;

  // 1. Priorité au PJ actuellement contrôlé : aucun assignement Foundry requis.
  const controlled = uniqueRecipientCandidates(
    (canvas?.tokens?.controlled ?? [])
      .filter(t => t?.actor && actorOwnedByUser(t.actor, user))
      .map(t => ({actor:t.actor, tokenUuid:t.document?.uuid || null}))
  );
  if (controlled.length === 1) return controlled[0];
  if (controlled.length > 1) {
    return chooseRecipientFromList(controlled, "H0D Loot — quel PJ contrôlé reçoit le butin ?");
  }

  // 2. Personnage explicitement associé à l'utilisateur, si présent.
  if (user.character && isPlayerCharacterActor(user.character) && actorOwnedByUser(user.character, user)) {
    return {actor:user.character, tokenUuid:null};
  }

  // 3. S'il n'y a qu'un seul PJ possédé présent sur la scène, on le choisit automatiquement.
  const sceneOwned = uniqueRecipientCandidates(
    (canvas?.tokens?.placeables ?? [])
      .filter(t => t?.actor && actorOwnedByUser(t.actor, user))
      .map(t => ({actor:t.actor, tokenUuid:t.document?.uuid || null}))
  );
  if (sceneOwned.length === 1) return sceneOwned[0];

  // 4. Dernier recours : tous les PJ possédés dans le monde.
  const worldOwned = uniqueRecipientCandidates(
    game.actors
      .filter(a => actorOwnedByUser(a, user))
      .map(a => ({actor:a, tokenUuid:null}))
  );
  if (worldOwned.length === 1) return worldOwned[0];
  if (worldOwned.length > 1) {
    return chooseRecipientFromList(worldOwned, "H0D Loot — quel PJ reçoit le butin ?");
  }

  ui.notifications?.warn("H0D Loot : aucun PJ contrôlé ou possédé par ce joueur.");
  return null;
}

async function resolveRecipientActor(data, user) {
  if (data.recipientTokenUuid) {
    const tokenDoc = await resolveTokenDocument(data.recipientTokenUuid);
    const tokenActor = tokenDoc?.actor ?? tokenDoc?.object?.actor ?? null;
    if (tokenActor && isPlayerCharacterActor(tokenActor)) return tokenActor;
  }

  if (data.actorUuid) {
    try {
      const resolver = foundry.utils.fromUuid ?? globalThis.fromUuid;
      const byUuid = await resolver(data.actorUuid);
      if (byUuid?.documentName === "Actor" && isPlayerCharacterActor(byUuid)) return byUuid;
    } catch (err) {
      console.warn("H0D Loot | acteur destinataire UUID invalide", data.actorUuid, err);
    }
  }

  const byId = game.actors.get(data.actorId);
  return byId && isPlayerCharacterActor(byId) ? byId : null;
}

async function onSocketMessage(data) {
  if (!data || typeof data !== "object") return;
  if (data.type === "claim" && isPrimaryGM()) await processClaim(data);
  if (data.type === "claim-result" && data.userId === game.user.id) {
    const fn = data.ok ? ui.notifications?.info : ui.notifications?.warn;
    fn?.call(ui.notifications, data.message);
  }
}

async function processClaim(data) {
  const respond = (ok, message) => {
    if (data.userId === game.user.id) {
      (ok ? ui.notifications?.info : ui.notifications?.warn)?.call(ui.notifications, message);
    } else game.socket.emit(SOCKET, {type:"claim-result", userId:data.userId, ok, message});
  };

  try {
    const user = game.users.get(data.userId);
    const message = game.messages.get(data.messageId);
    if (!user || !message) return respond(false, "H0D Loot : demande invalide ou expirée.");

    const actor = await resolveRecipientActor(data, user);
    if (!actor) return respond(false, "H0D Loot : personnage destinataire introuvable.");
    if (!user.isGM && !actorOwnedByUser(actor, user)) {
      return respond(false, "H0D Loot : ce personnage ne t’appartient pas.");
    }

    let tokenDoc = null;
    let loot = null;
    if (data.tokenUuid) {
      tokenDoc = await resolveTokenDocument(data.tokenUuid);
      if (!tokenDoc) return respond(false, "H0D Loot : la carcasse n’existe plus.");
      loot = await getTokenLoot(tokenDoc, {migrate:true});
    }
    if (!loot) loot = migrateLoot(message.getFlag(MODULE_ID, LOOT_FLAG));
    if (!loot?.items) return respond(false, "H0D Loot : carte de butin invalide.");
    if (data.lootId && loot.lootId !== data.lootId) return respond(false, "H0D Loot : cette carte n’est plus à jour. Rouvre la carcasse.");

    if (data.quantity === "all-card") {
      const transfers = loot.items.filter(i => isTransferable(i) && Number(i.quantity) > 0);
      if (!transfers.length) return respond(false, "H0D Loot : plus rien à récupérer.");
      for (const entry of transfers) {
        const qty = Math.max(0, Math.floor(Number(entry.quantity)||0));
        if (qty) await transferEntryToActor(actor, entry, qty, tokenDoc);
        entry.quantity = 0;
        loot.claims.push(claimRecord(user, actor, entry, qty));
      }
      await persistLoot(message, loot, tokenDoc);
      return respond(true, `H0D Loot : tout le butin disponible a été ajouté à ${actor.name}.`);
    }

    const entry = loot.items.find(i => i.entryId === data.entryId || i.resourceId === data.entryId);
    if (!entry) return respond(false, "H0D Loot : élément introuvable.");
    const available = Math.max(0, Math.floor(Number(entry.quantity)||0));
    if (!available) return respond(false, "H0D Loot : cet élément a déjà été récupéré.");
    const qty = data.quantity === "all" ? available : Math.min(available, Math.max(1, Math.floor(Number(data.quantity)||1)));

    await transferEntryToActor(actor, entry, qty, tokenDoc);
    entry.quantity = available - qty;
    loot.claims.push(claimRecord(user, actor, entry, qty));
    await persistLoot(message, loot, tokenDoc);
    respond(true, `H0D Loot : ${qty} × ${entry.name} ajouté à ${actor.name}.`);
  } catch (err) {
    console.error("H0D Loot | transfert impossible", err);
    respond(false, `H0D Loot : transfert impossible (${err.message || err}).`);
  }
}

function claimRecord(user, actor, entry, quantity) {
  return {userId:user.id, actorId:actor.id, entryId:entry.entryId, resourceId:entry.resourceId || null, name:entry.name, quantity, at:Date.now()};
}

function isTransferable(entry) {
  return entry?.kind === "resource" || entry?.kind === "embedded" || entry?.kind === "machine-piece";
}

async function persistLoot(message, loot, tokenDoc=null) {
  const updates = new Set([message?.id].filter(Boolean));

  if (tokenDoc) {
    const old = tokenDoc.getFlag(MODULE_ID, TOKEN_FLAG) || {};
    for (const id of old.messageIds || []) updates.add(id);
    if (old.messageId) updates.add(old.messageId);

    await tokenDoc.setFlag(MODULE_ID, TOKEN_FLAG, {
      ...old,
      version:2,
      lootId:loot.lootId,
      loot,
      messageIds:[...updates],
      depleted:loot.items.every(i=>Number(i.quantity||0)<=0)
    });
  }

  for (const id of updates) {
    const msg = game.messages.get(id);
    if (!msg) continue;
    try {
      await msg.update({content:renderLootCard(loot), [`flags.${MODULE_ID}.${LOOT_FLAG}`]:loot});
    } catch (err) {
      console.warn(`H0D Loot | carte ${id} non mise à jour`, err);
    }
  }
}

async function transferEntryToActor(actor, entry, quantity, tokenDoc) {
  if (entry.kind === "resource") return addResourceToActor(actor, entry.resourceId, quantity);
  if (entry.kind === "embedded") return addEmbeddedLootToActor(actor, entry, quantity, tokenDoc);
  if (entry.kind === "machine-piece") return addMachinePartToActor(actor, entry, quantity);
  throw new Error(`Type de butin non transférable : ${entry.kind}`);
}

async function addMachinePartToActor(actor,entry,quantity) {
  // Une pièce récupérée devient un Objet PJ de type PieceMachine, jamais un composant machine actif.
  const template = game.items.get(OBJECT_TEMPLATE_ID);
  if(!template) throw new Error("Template H0D Objet absent : installer Template Manager avant le prélèvement.");

  const source = cleanEmbeddedItemSource(template.toObject());
  const original = entry.partProps || {};
  const condition = String(entry.condition || "Intact");
  const hp = Math.max(0, Number(entry.sourceHp ?? original.H0D_Composant_PV_Actuels ?? 0) || 0);
  const max = Math.max(0, Number(entry.sourceMaxHp ?? original.H0D_Composant_PV_Max ?? 0) || 0);
  const deteriorated = !!entry.deteriorated || (hp === 0 && max > 0);

  source.name = deteriorated ? `${entry.name} — détérioré` : entry.name;
  source.img = entry.img || source.img;
  source.type = "equippableItem";
  source.system ??= {};
  source.system.template = OBJECT_TEMPLATE_ID;
  source.system.props = {
    H0D_Objet_Type:"PieceMachine",
    H0D_Objet_Sous_Type:String(original.H0D_Composant_Type||"Composant"),
    H0D_Objet_Quantite:1,
    H0D_Stockage:"PJ",
    H0D_Objet_Actif:false,
    H0D_Objet_Identifie:true,
    H0D_Objet_Etat:condition,
    H0D_Objet_Origine:entry.origin||"",
    H0D_Objet_Description:deteriorated
      ? `Pièce détachée détériorée de ${entry.origin||"machine"} : ${entry.name} (${hp}/${max} PV). Peut servir de matériau de craft ou de récupération.`
      : `Pièce détachée exploitable de ${entry.origin||"machine"} : ${entry.name} (${hp}/${max} PV).`,
    H0D_Objet_Valeur:Number(original.H0D_Composant_Valeur)||0
  };
  source.flags ??= {};
  source.flags[MODULE_ID] = {
    looted:true,
    machinePart:true,
    sourceItemId:entry.sourceItemId,
    sourceState:entry.sourceState || original.H0D_Composant_Etat || null,
    sourceHp:hp,
    sourceMaxHp:max,
    deteriorated
  };

  const sources = Array.from({length:quantity},()=>foundry.utils.deepClone(source));
  return actor.createEmbeddedDocuments("Item",sources);
}

async function addResourceToActor(actor, resourceId, quantity) {
  const resource = resourceLibrary.get(resourceId);
  if (!resource) throw new Error(`Ressource ${resourceId} absente de la bibliothèque H0D`);

  const existing = actor.items.find(i => {
    const flagId = i.getFlag?.(MODULE_ID, "resourceId");
    if (flagId === resourceId) return true;
    return i.system?.template === RESOURCE_TEMPLATE_ID && norm(i.name) === norm(resource.name);
  });

  if (existing) {
    const cur = Math.max(0, Math.floor(Number(existing.system?.props?.H0D_Ressource_Quantite || 0)));
    await existing.update({"system.props.H0D_Ressource_Quantite":String(cur + quantity)});
    if (!existing.getFlag?.(MODULE_ID, "resourceId")) await existing.setFlag(MODULE_ID, "resourceId", resourceId);
    return existing;
  }

  const compendiumDoc = await getResourceDocument(resourceId);
  let source;
  let sourceMode;
  if (compendiumDoc) {
    source = cleanEmbeddedItemSource(compendiumDoc.toObject());
    sourceMode = "compendium";
  } else {
    source = cleanEmbeddedItemSource(resource.source);
    sourceMode = "fallback";
    console.warn(`H0D Loot | ${resource.name} absent du Compendium ; utilisation de la bibliothèque embarquée.`);
  }

  source.system ??= {};
  source.system.props ??= {};
  source.system.props.H0D_Ressource_Quantite = String(quantity);
  source.system.props.H0D_Stockage = "PJ";
  source.flags ??= {};
  source.flags[MODULE_ID] = {
    ...(source.flags[MODULE_ID] ?? {}), resourceId, sourceMode,
    sourcePack:sourceMode === "compendium" ? resourcePack?.collection ?? null : null
  };

  const [created] = await actor.createEmbeddedDocuments("Item", [source]);
  return created;
}

async function addEmbeddedLootToActor(actor, entry, quantity, tokenDoc) {
  if (!tokenDoc) throw new Error("Carcasse source introuvable pour cet équipement");
  const sourceActor = tokenDoc.actor ?? tokenDoc.object?.actor;
  if (!sourceActor) throw new Error("Actor source de la carcasse introuvable");
  const sourceItem = sourceActor.items.get(entry.sourceItemId);
  if (!sourceItem) throw new Error(`${entry.name} n’existe plus sur la carcasse`);

  const quantityField = entry.quantityField || null;
  if (quantityField) {
    const existing = actor.items.find(i =>
      i.system?.template === entry.templateId &&
      norm(i.name) === norm(entry.name) &&
      sameStackVariant(i, sourceItem)
    );
    if (existing) {
      const cur = Math.max(0, Math.floor(Number(existing.system?.props?.[quantityField] || 0)));
      await existing.update({[`system.props.${quantityField}`]:String(cur + quantity)});
      return existing;
    }
  }

  const base = prepareLootedItemSource(sourceItem.toObject());
  if (quantityField) {
    base.system ??= {};
    base.system.props ??= {};
    base.system.props[quantityField] = String(quantity);
    const [created] = await actor.createEmbeddedDocuments("Item", [base]);
    return created;
  }

  const sources = [];
  for (let i=0; i<quantity; i++) sources.push(foundry.utils.deepClone(base));
  return actor.createEmbeddedDocuments("Item", sources);
}

function prepareLootedItemSource(raw) {
  const source = cleanEmbeddedItemSource(raw);
  source.system ??= {};
  source.system.props ??= {};
  const p = source.system.props;
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Stockage")) p.H0D_Stockage = "PJ";
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Armure_Active")) p.H0D_Armure_Active = false;
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Objet_Actif")) p.H0D_Objet_Actif = false;
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Objet_Munition_Active")) p.H0D_Objet_Munition_Active = false;
  if (source.flags?.["custom-system-builder"]?.h0dCooldown) delete source.flags["custom-system-builder"].h0dCooldown;
  source.flags ??= {};
  source.flags[MODULE_ID] = {...(source.flags[MODULE_ID] ?? {}), looted:true};
  return source;
}

function sameStackVariant(a, b) {
  const ap = a.system?.props ?? {};
  const bp = b.system?.props ?? {};
  if (a.system?.template === RESOURCE_TEMPLATE_ID) {
    return norm(ap.H0D_Ressource_Qualite) === norm(bp.H0D_Ressource_Qualite);
  }
  if (a.system?.template === OBJECT_TEMPLATE_ID) {
    return norm(ap.H0D_Objet_Type) === norm(bp.H0D_Objet_Type)
      && norm(ap.H0D_Objet_Munition_Famille) === norm(bp.H0D_Objet_Munition_Famille)
      && norm(ap.H0D_Objet_Munition_Element) === norm(bp.H0D_Objet_Munition_Element);
  }
  return true;
}

async function resolveTokenDocument(uuid) {
  if (!uuid) return null;
  try {
    const resolver = foundry.utils.fromUuid ?? globalThis.fromUuid;
    const doc = await resolver(uuid);
    return doc?.documentName === "Token" ? doc : null;
  } catch (err) {
    console.warn("H0D Loot | UUID de carcasse invalide", uuid, err);
    return null;
  }
}

function detectType(actor) {
  const p = actor?.system?.props ?? {};
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Machine_Niveau_Menace") || Object.prototype.hasOwnProperty.call(p,"H0D_Machine_PV_Actuels")) return "machine";
  if (Object.prototype.hasOwnProperty.call(p,"H0D_Creature_Menace") || Object.prototype.hasOwnProperty.call(p,"H0D_Creature_PV_Actuels")) {
    const t = String(p.H0D_Creature_Type || "Creature");
    if (t === "PNJ" || t === "Faction") return "humanoid";
    return "creature";
  }
  return null;
}

function getMenace(actor, type) {
  const p = actor?.system?.props ?? {};
  return Math.max(1, Number(type === "machine" ? p.H0D_Machine_Niveau_Menace : p.H0D_Creature_Menace) || 1);
}

function sortLootEntries(a,b) {
  const order = {
    Arme:1, Armure:2, Munition:3, Objet:4,
    "Composants préservés":5,
    "Composants détériorés":6,
    "Récupération secondaire":7,
    Ressource:8, Résultat:9,
    "À arbitrer par le MJ":10,
    Autre:20
  };
  const ca = order[a.category] ?? 20;
  const cb = order[b.category] ?? 20;
  return ca - cb || String(a.name).localeCompare(String(b.name),"fr");
}

function primaryGM() {
  return game.users.filter(u=>u.active && u.isGM).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0] ?? null;
}
function isPrimaryGM() { return game.user?.isGM && primaryGM()?.id === game.user.id; }
function clamp(n,min,max) { return Math.max(min, Math.min(max,n)); }
function numOrNull(v) { if (v===null || v===undefined || v==="") return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function norm(v) { return String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g," ").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase(); }
function esc(v) { return foundry.utils.escapeHTML(String(v ?? "")); }
