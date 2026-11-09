import {barterItemDetails,barterQuote,bestBarterOffer,recognitionTokenPayment} from "./h0d-trade.js";

const escape=value=>foundry.utils.escapeHTML(String(value??""));

/** Calcul client uniquement, validé à nouveau côté MJ lors de la transaction. */
export function previewBarterOffer(items,amounts,price){
  let total=0;
  const subtotals=[];
  for(let i=0;i<items.length;i++){
    const item=items[i];
    const quantity=amounts[i];
    if(!Number.isSafeInteger(quantity)||quantity<0||quantity>item.quantity){
      return {valid:false,total:0,subtotals:[],status:"invalid",
        message:"Corrige les quantités sélectionnées : elles doivent être entières et disponibles."};
    }
    const line=quantity*item.value;
    if(!Number.isSafeInteger(line)||!Number.isSafeInteger(total+line))
      return {valid:false,total:0,subtotals:[],status:"invalid",
        message:"Valeur de troc trop élevée pour être calculée."};
    total+=line;
    subtotals.push(line);
  }
  const missing=Math.max(0,price-total),overpay=Math.max(0,total-price);
  return {valid:true,total,subtotals,missing,overpay,
    status:missing>0?"insufficient":overpay>0?"overpay":"exact"};
}

/**
 * Fenêtre interactive de commerce sans modification de l'inventaire.
 * L'approbation du surplus est intégrée au même dialogue.
 */
export async function openValueTradeDialog({actor,vendorName,offer,paymentMode="resources-only"}){
  const price=offer.price;
  if(!Number.isSafeInteger(price)||price<0)throw new Error("Prix du vendeur invalide.");
  const tokenPlan=paymentMode==="tokens-first"?recognitionTokenPayment(actor,price):
    {used:0,remaining:price,lines:[]};
  const remaining=tokenPlan.remaining;
  const items=Array.from(actor?.items||[]).map(item=>{
    const details=barterItemDetails(item);
    return details?{...details,img:item.img||"icons/svg/item-bag.svg"}:null;
  }).filter(Boolean);
  if(remaining>0&&!items.length){
    ui.notifications?.warn("H0D : ce PJ ne possède aucune ressource ou objet avec une valeur de troc utilisable.");
    return null;
  }

  const recommended=bestBarterOffer(actor,remaining);
  const lines=items.map((item,i)=>`
    <div class="h0d-trade-row" data-h0d-trade-row="${i}">
      <img class="h0d-trade-item-icon" src="${escape(item.img)}" alt="">
      <div class="h0d-trade-item-description">
        <strong>${escape(item.name)}</strong>
        <small>Possédés : ${item.quantity} · ${item.value} jeton${item.value>1?"s":""} / unité</small>
      </div>
      <div class="h0d-trade-quantity" aria-label="Quantité de ${escape(item.name)} proposée">
        <button type="button" data-h0d-trade-step="-1" data-index="${i}" aria-label="Retirer une unité de ${escape(item.name)}">−</button>
        <input type="number" name="pay_${i}" min="0" max="${item.quantity}" step="1" value="0" inputmode="numeric" aria-label="Quantité de ${escape(item.name)}">
        <button type="button" data-h0d-trade-step="1" data-index="${i}" aria-label="Ajouter une unité de ${escape(item.name)}">+</button>
      </div>
      <strong class="h0d-trade-line-value" data-h0d-trade-subtotal="${i}">0 <small>jetons</small></strong>
    </div>`).join("");

  const automaticInfo=recommended.status==="too-large"
    ?"Calcul automatique indisponible pour ces valeurs ; tu peux composer l'offre manuellement."
    :recommended.status==="insufficient"
      ?"Les ressources valorisées du PJ ne suffisent pas pour couvrir le prix."
      :recommended.status==="unavailable"
        ?"Impossible de trouver une combinaison automatiquement ; compose l'offre manuellement."
        :"Cherche le plus petit surplus, puis le moins d'unités possible.";

  const content=document.createElement("div");
  content.className="h0d-trade-root";
  content.innerHTML=`
    <div class="h0d-trade-heading">
      <div><h3>Troc avec ${escape(vendorName)}</h3><small>Lot : ${escape(offer.name)}</small></div>
      <div class="h0d-trade-price"><small>Prix demandé</small><strong>${price} jetons</strong></div>
    </div>
    ${paymentMode==="tokens-first"?`<p class="h0d-trade-hint">Jetons de Reconnaissance prélevés en priorité : <strong>${tokenPlan.used}</strong>. Complément en ressources : <strong>${remaining}</strong> point(s) de valeur.</p>`:""}
    <div class="h0d-trade-section-title">
      <strong>Ressources proposées</strong>
      <button type="button" class="h0d-trade-auto" data-h0d-trade-auto
        ${recommended.status==="ok"?"":"disabled"}
        title="${escape(automaticInfo)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Offre au plus juste</button>
    </div>
    <p class="h0d-trade-hint">${escape(automaticInfo)}</p>
    <div class="h0d-trade-items">${lines||'<p>Aucun complément en ressources requis.</p>'}</div>
    <div class="h0d-trade-summary">
      <div class="h0d-trade-total"><span>Valeur offerte</span><strong data-h0d-trade-total>0 / ${remaining} jetons</strong></div>
      <progress max="${Math.max(1,remaining)}" value="0" data-h0d-trade-progress aria-label="Progression de l'offre de troc"></progress>
      <div class="h0d-trade-status" role="status" aria-live="polite" data-h0d-trade-status></div>
      <label class="h0d-trade-overpay" data-h0d-trade-ack-row hidden>
        <input type="checkbox" name="tradeOverpay">
        <span>J'accepte de remettre <strong data-h0d-trade-overpay>0</strong> jeton(s) de valeur supplémentaire, sans rendu de monnaie.</span>
      </label>
    </div>
    <p class="h0d-trade-footnote">Le paiement sera contrôlé à nouveau sur l'inventaire réel et le stock du marchand avant l'échange.</p>
  `;

  const render=(_event,dialog)=>{
    const root=dialog.element?.querySelector(".h0d-trade-root");
    if(!root)return;
    const confirm=dialog.element?.querySelector('button[data-action="trade-confirm"]');
    const inputs=items.map((item,i)=>root.querySelector(`[name="pay_${i}"]`));
    const consent=root.querySelector('[name="tradeOverpay"]');
    const status=root.querySelector("[data-h0d-trade-status]");
    const summary=root.querySelector("[data-h0d-trade-total]");
    const progress=root.querySelector("[data-h0d-trade-progress]");
    const ackRow=root.querySelector("[data-h0d-trade-ack-row]");
    const surplus=root.querySelector("[data-h0d-trade-overpay]");
    const parseQuantity=input=>{
      const raw=String(input?.value??"").trim();
      if(!raw)return 0;
      const number=Number(raw);
      return Number.isSafeInteger(number)?number:NaN;
    };
    const read=()=>inputs.map(parseQuantity);
    const refresh=()=>{
      const quote=previewBarterOffer(items,read(),remaining);
      if(!quote.valid){
        summary.textContent="Offre à corriger";
        progress.value=0;
        status.textContent=quote.message;
        status.dataset.status="invalid";
        ackRow.hidden=true;
        if(confirm)confirm.disabled=true;
        return;
      }
      summary.textContent=quote.total+" / "+remaining+" jetons";
      progress.value=remaining===0?1:Math.min(remaining,quote.total);
      items.forEach((item,i)=>{
        root.querySelector(`[data-h0d-trade-subtotal="${i}"]`).textContent=quote.subtotals[i]+" jetons";
        const previous=inputs[i].previousElementSibling;
        const next=inputs[i].nextElementSibling;
        if(previous)previous.disabled=read()[i]===0;
        if(next)next.disabled=read()[i]>=item.quantity;
      });
      status.dataset.status=quote.status;
      ackRow.hidden=quote.status!=="overpay";
      if(quote.status==="insufficient")
        status.textContent="Il manque "+quote.missing+" jeton(s) de valeur pour valider.";
      else if(quote.status==="overpay")
        status.textContent="Offre suffisante, mais "+quote.overpay+" jeton(s) de surplus ne seront pas rendus.";
      else status.textContent="Échange équilibré : valeur exacte atteinte.";
      surplus.textContent=String(quote.overpay);
      if(confirm){
        confirm.disabled=quote.status==="insufficient"||(quote.status==="overpay"&&!consent.checked);
        confirm.textContent=quote.status==="overpay"?"Troquer — surplus accepté":"Troquer — confirmer";
      }
    };
    root.addEventListener("click",event=>{
      const step=event.target.closest("[data-h0d-trade-step]");
      if(step){
        event.preventDefault();
        const i=Number(step.dataset.index),input=inputs[i];
        if(!input)return;
        const current=Number.isSafeInteger(parseQuantity(input))?parseQuantity(input):0;
        input.value=String(Math.min(items[i].quantity,Math.max(0,current+Number(step.dataset.h0dTradeStep))));
        consent.checked=false;
        refresh();
        return;
      }
      if(event.target.closest("[data-h0d-trade-auto]")){
        event.preventDefault();
        if(recommended.status!=="ok")return;
        const quantities=new Map(recommended.selection.map(x=>[x.itemId,x.quantity]));
        items.forEach((item,i)=>{inputs[i].value=String(quantities.get(item.id)||0);});
        consent.checked=false;
        refresh();
      }
    });
    root.addEventListener("input",event=>{
      if(event.target.matches('input[name^="pay_"]')){
        consent.checked=false;
        refresh();
      }else if(event.target===consent)refresh();
    });
    root.addEventListener("change",event=>{
      if(event.target===consent)refresh();
    });
    refresh();
  };
  const result=await foundry.applications.api.DialogV2.wait({
    window:{title:"H0D — Troc avec "+vendorName,resizable:true},
    content,
    render,
    rejectClose:false,
    buttons:[
      {action:"trade-confirm",label:"Troquer — confirmer",default:true,
        callback:(_event,button)=>{
          const data=items.map((item,i)=>({
            itemId:item.id,quantity:Number(button.form.elements[`pay_${i}`]?.value||0)
          })).filter(row=>row.quantity>0);
          const checked=Boolean(button.form.elements.tradeOverpay?.checked);
          const quote=barterQuote(actor,data,remaining);
          if(quote.overpay>0&&!checked)throw new Error("Excédent non accepté.");
          return {barterItems:data,ackOverpay:quote.overpay>0&&checked,quotedPrice:price,tokensUsed:tokenPlan.used};
        }},
      {action:"cancel",label:"Annuler",callback:()=>({cancelled:true})}
    ]
  });
  return result?.barterItems?result:null;
}
