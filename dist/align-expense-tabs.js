(()=>{
 function alignExpenseTabs(){
  const panel=document.querySelector('#company-section [data-expense-panel="variable"]:not([hidden])');
  if(!panel)return;
  const header=panel.querySelector('.variable-expenses-head');
  if(!header)return;
  let tabs=document.querySelector('#company-section .company-expense-tabs');
  if(!tabs){
   tabs=document.createElement('div');
   tabs.className='company-expense-tabs';
   tabs.setAttribute('role','tablist');
   tabs.setAttribute('aria-label','Tipos de gastos');
   tabs.innerHTML='<button type="button" role="tab" data-company-expense-tab="fixed" aria-selected="false">Mensais fixos</button><button type="button" role="tab" data-company-expense-tab="variable" aria-selected="true" class="selected">Variados</button>';
  }
  const title=header.querySelector(':scope>div:not(.company-expense-tabs)');
  if(title)title.remove();
  if(tabs.parentElement!==header)header.prepend(tabs);
 }
 new MutationObserver(alignExpenseTabs).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 document.addEventListener('DOMContentLoaded',alignExpenseTabs);
 document.addEventListener('click',event=>{if(event.target.closest('[data-company-expense-tab]'))queueMicrotask(alignExpenseTabs);});
})();
