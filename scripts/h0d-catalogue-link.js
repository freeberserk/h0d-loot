/**
 * H0D Catalogue est l'autorité de définition ; H0D Loot garde des identifiants
 * compendium historiques pour les transferts et des états de butin persistants.
 * Aucune correspondance approximative ou modification des inventaires existants.
 */
export function catalogueApi(game){
 const mod=game?.modules?.get("h0d-catalogue");
 const api=mod?.active?(mod.api??game?.h0dCatalogue):null;
 return api?.getStatus?.()?.ready?api:null;
}
export function resolveCatalogueResource(resource,catalogue){
 if(!resource||!catalogue?.resolveDefinition)
  return {status:"catalogue-absent",key:null,definition:null};
 const r=catalogue.resolveDefinition({
  key:resource.catalogueKey??resource.catalogKey??null,
  name:resource.name,kind:"resource"
 });
 if(!["key","name"].includes(r.status)||r.definition?.kind!=="resource")
  return {status:r.status,key:null,definition:null,candidates:r.candidates??[]};
 return {status:"canonique",key:r.definition.key,definition:r.definition};
}
const safe=d=>d?.catalogue?.visible_au_stock_standard===true &&
 d.catalogue?.generable_stock_aleatoire!==false &&
 d.catalogue?.pret_pour_builder!==false &&
 d.catalogue?.non_marchand!==true&&d.catalogue?.mj_seul!==true;
export function merchantCatalogueDefinitions(game){
 const catalogue=catalogueApi(game);
 if(catalogue){
  const defs=typeof catalogue.getStockEligibleDefinitions==="function"?
   catalogue.getStockEligibleDefinitions():catalogue.getDefinitions({includeRestricted:false}).filter(safe);
  return {source:"H0D Catalogue",definitions:defs.filter(d=>d?.key&&d?.name&&safe(d))};
 }
 return {source:"H0D Catalogue (indisponible)",definitions:[]};
}
