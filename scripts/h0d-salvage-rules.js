/**
 * Récupération H0D : décision déterministe pour une pièce déjà identifiée.
 * Le résultat est tiré UNE fois à la génération de la carte puis persisté.
 * Aucune rareté sans référence Catalogue exacte.
 */
export function salvageYieldFallback(props={},name=""){
  const n=String(name??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const type=String(props.H0D_Composant_Type??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(type==="blindage"||/plaque|blindage|carapace|coque/.test(n))
    return /massif|titan|colossal|tres lourd/.test(n)?6:
      /grand|dorsal|principal|renforce|lourd/.test(n)?4:
      /lateral|flanc|segment|moyen/.test(n)?2:2;
  return 1;
}
export function decideSalvage(props={},{
  hp=0,max=0,state="Intact",name="",rareAvailable=false,roll=Math.random
}={}){
  const status=String(state??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(status==="detruit"||hp<=0||max<=0)return {kind:"none",quantity:0};
  if(props.H0D_Composant_Conserver_Entier===true)return {kind:"piece",quantity:1};
  const base=props.H0D_Composant_Rendement;
  const configured=Number(base);
  const fullYield=base!==undefined&&base!==null&&Number.isSafeInteger(configured)&&configured>=0
    ?configured:salvageYieldFallback(props,name);
  const pristine=hp>=max&&!status.includes("endommage")&&!status.includes("casse");
  const quantity=pristine?fullYield:Math.max(fullYield>0?1:0,Math.floor(fullYield/2));
  const isPlate=/blindage|plaque|carapace|coque/.test(String(name+" "+(props.H0D_Composant_Type||"")).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase());
  const chance=Math.max(0,Math.min(100,Number(props.H0D_Composant_Rare_Pourcent)||0));
  const key=String(props.H0D_Composant_Rare_Catalogue_Key||"").trim();
  const effectiveChance=pristine?chance:chance/2;
  if(!isPlate && rareAvailable && key && effectiveChance>0 && Number(roll())*100<effectiveChance)
    return {kind:"rare",quantity:1,catalogueKey:key,chance:effectiveChance};
  return {kind:"materials",quantity,pristine,baseYield:fullYield};
}
