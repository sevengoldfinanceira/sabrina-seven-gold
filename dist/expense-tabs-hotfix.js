(()=>{
 function ensureExpenseTabs(){
  const section=document.querySelector('#company-section');
  if(!section||section.querySelector('.company-expense-tabs'))return;
  const slot=section.querySelector('.fixed-tabs-slot,.variable-tabs-slot');
  if(!slot)return;
  const tabs=document.createElement('div');
  tabs.className='company-expense-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Tipos de gastos');
  const variable=section.querySelector('[data-expense-panel="variable"]:not([hidden])');
  tabs.innerHTML=`<button type="button" role="tab" data-company-expense-tab="fixed" aria-selected="${!variable}" class="${variable?'':'selected'}">Mensais fixos</button><button type="button" role="tab" data-company-expense-tab="variable" aria-selected="${!!variable}" class="${variable?'selected':''}">Variados</button>`;
  slot.replaceWith(tabs);
 }
 new MutationObserver(ensureExpenseTabs).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',ensureExpenseTabs);
})();
