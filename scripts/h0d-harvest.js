/**
 * H0D Loot — récolte dirigée par les informations du Focus et le MJ.
 * Algorithmes indépendants de Foundry (tests Node), sans nouveau barème de loot.
 */
export const HARVEST_KINDS=Object.freeze([
  {key:"meat",label:"Viande"},
  {key:"bone",label:"Os"},
  {key:"skin",label:"Peau / fourrure"},
  {key:"trophy",label:"Trophée rare"},
  {key:"other",label:"Autres résultats"}
]);
export const HARVEST_LABELS=Object.freeze(Object.fromEntries(HARVEST_KINDS.map(x=>[x.key,x.label])));
const KINDS=new Set(HARVEST_KINDS.map(x=>x.key));
const clean=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .replace(/[’']/g," ").replace(/[^a-zA-Z0-9]+/g," ").trim().toLowerCase();
const nameOf=result=>String(result?.description||result?.text||result?.name||"").trim();
export function harvestKind(name){
  const n=clean(name);
  if(/\b(viande|chair|steak|filet)\b/.test(n))return "meat";
  if(/\b(os|ossement|ossements)\b/.test(n))return "bone";
  if(/\b(peau|peaux|fourrure|cuir|pelage)\b/.test(n))return "skin";
  if(/\b(trophee|trophees)\b/.test(n))return "trophy";
  return "other";
}
const defaultAllowed=()=>({meat:true,bone:true,skin:true,trophy:true,other:false});
export function normalizeHarvestProfile(raw={}){
  const mode=raw?.mode==="directed"?"directed":"free";
  const allowed=defaultAllowed();
  if(raw?.allowed&&typeof raw.allowed==="object"){
    for(const key of KINDS)if(Object.hasOwn(raw.allowed,key))allowed[key]=raw.allowed[key]===true;
  }
  const guaranteed=KINDS.has(raw?.guaranteed)?raw.guaranteed:"";
  if(mode==="directed"&&guaranteed&&!allowed[guaranteed])
    throw new Error("Ressource garantie interdite par la sélection : "+HARVEST_LABELS[guaranteed]);
  return {
    version:1,mode,allowed,guaranteed:mode==="directed"?guaranteed:"",
    note:String(raw?.note??"").slice(0,700).trim()
  };
}
export function tableCandidates(table,profile){
  const config=normalizeHarvestProfile(profile);
  const entries=Array.isArray(table?.results?.contents)?table.results.contents:
    Array.isArray(table?.results)?table.results:
      Array.from(table?.results?.contents??table?.results??[]);
  return entries.map(result=>{
    const name=nameOf(result);
    const kind=harvestKind(name);
    const weight=Number(result.weight??1);
    return {result,name,kind,weight};
  }).filter(x=>x.name&&Number.isFinite(x.weight)&&x.weight>0&&
     (config.mode!=="directed"||config.allowed[x.kind]));
}
function chooseWeighted(list,rng){
  const total=list.reduce((sum,x)=>sum+x.weight,0);
  if(total<=0)return null;
  let r=Math.max(0,Math.min(.999999999999,Number(rng())||0))*total;
  for(const x of list){r-=x.weight;if(r<0)return x;}
  return list.at(-1);
}
/**
 * Tirages contrôlés avec remplacement : même nombre de tirages que la formule
 * existante et une éventuelle ressource garantie qui prend un de ces tirages.
 * On ne modifie JAMAIS les poids ni les résultats de la RollTable du MJ.
 */
export function selectHarvestResults(table,raw,count,rng=Math.random){
  const profile=normalizeHarvestProfile(raw);
  if(profile.mode!=="directed")throw new Error("Un tirage dirigé nécessite le mode MJ.");
  if(table?.replacement===false)
    throw new Error("Récolte dirigée : la RollTable doit être avec remise. La table actuelle est sans remise.");
  const candidates=tableCandidates(table,profile);
  const draws=Math.max(0,Math.floor(Number(count)||0));
  const result=[];
  if(profile.guaranteed){
    const options=candidates.filter(x=>x.kind===profile.guaranteed);
    if(!options.length)throw new Error(
      "Ressource garantie « "+HARVEST_LABELS[profile.guaranteed]+
      " » absente de la RollTable des créatures. Aucune ressource n'a été inventée."
    );
    result.push(chooseWeighted(options,rng).result);
  }
  const total=Math.max(draws,result.length);
  while(result.length<total){
    const selected=chooseWeighted(candidates,rng);
    if(!selected)break;
    result.push(selected.result);
  }
  return {results:result,draws:total,empty:candidates.length===0};
}
/**
 * Réconciliation d'un butin déjà créé sans supprimer ses claims :
 * - retirer uniquement les ressources interdites encore présentes ;
 * - ajouter 1 ressource garantie si aucune unité n'est disponible
 *   et si aucune ne figure déjà dans les prélèvements historiques.
 * La transformation de résultats Foundry en véritables objets est fournie
 * par le module principal (fonction addTableResult).
 */
export function reconcileHarvestLoot(loot,raw,table,{addResult,rng=Math.random}={}){
  const profile=normalizeHarvestProfile(raw);
  const copy={...loot,source:{...(loot.source??{}),harvest:profile},
    items:(loot.items??[]).map(item=>({...item})),
    claims:[...(loot.claims??[])]};
  if(profile.mode!=="directed")return {loot:copy,removed:[],added:[],alreadyClaimed:[]};
  const removed=[],alreadyClaimed=[];
  copy.items=copy.items.filter(item=>{
    const kind=harvestKind(item.name);
    if(profile.allowed[kind])return true;
    const count=Math.max(0,Number(item.quantity)||0);
    if(count>0)removed.push({name:item.name,quantity:count});
    const historical=copy.claims.some(c=>c.entryId===item.entryId||(
      item.resourceId&&c.resourceId===item.resourceId));
    if(historical){
      item.quantity=0;
      alreadyClaimed.push(item.name);
      return true;
    }
    return false;
  });
  const added=[];
  if(profile.guaranteed){
    const present=copy.items.some(i=>harvestKind(i.name)===profile.guaranteed&&Number(i.quantity)>0);
    const taken=copy.claims.some(i=>harvestKind(i.name)===profile.guaranteed&&Number(i.quantity)>0);
    if(!present&&!taken){
      if(typeof addResult!=="function")throw new Error("Ajout de ressource garantie impossible.");
      const {results}=selectHarvestResults(table,profile,0,rng);
      if(results.length){
        const before=copy.items.length;
        addResult(copy.items,results[0]);
        if(copy.items.length<=before&&!copy.items.some(i=>harvestKind(i.name)===profile.guaranteed&&Number(i.quantity)>0))
          throw new Error("Ressource garantie introuvable dans la bibliothèque H0D.");
        added.push(nameOf(results[0]));
      }
    }
  }
  return {loot:copy,removed,added,alreadyClaimed};
}
