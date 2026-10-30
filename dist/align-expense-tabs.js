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
  const heading=header.querySelector(':scope>div>h2');
  if(heading)heading.parentElement.remove();
  if(tabs.parentElement!==header)header.prepend(tabs);
  let actions=header.querySelector('.variable-expense-header-actions');
  if(!actions){
   const addButton=header.querySelector('#add-expense');
   actions=document.createElement('div');
   actions.className='variable-expense-header-actions';
   actions.innerHTML=`<label class="month-control">Mês<input type="month" id="variable-expense-month" value="${document.querySelector('#month')?.value||''}"></label>`;
   if(addButton)actions.append(addButton);
   header.append(actions);
  }
 }
 new MutationObserver(alignExpenseTabs).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 document.addEventListener('DOMContentLoaded',alignExpenseTabs);
 document.addEventListener('click',event=>{if(event.target.closest('[data-company-expense-tab]'))queueMicrotask(alignExpenseTabs);});
 document.addEventListener('change',event=>{
  if(event.target.id!=='variable-expense-month'||!/^\d{4}-\d{2}$/.test(event.target.value))return;
  const month=document.querySelector('#month');
  if(month){month.value=event.target.value;render();}
 });
})();
