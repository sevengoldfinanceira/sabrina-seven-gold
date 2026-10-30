(()=>{
 function alignExpenseTabs(){
  const panel=document.querySelector('#company-section [data-expense-panel="variable"]:not([hidden])');
  if(!panel)return;
  const header=panel.querySelector('.variable-expenses-head');
  const tabs=document.querySelector('#company-section .company-expense-tabs');
  if(!header||!tabs)return;
  const title=header.querySelector(':scope>div:not(.company-expense-tabs)');
  if(title)title.remove();
  if(tabs.parentElement!==header)header.prepend(tabs);
 }
 new MutationObserver(alignExpenseTabs).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 document.addEventListener('DOMContentLoaded',alignExpenseTabs);
 document.addEventListener('click',event=>{if(event.target.closest('[data-company-expense-tab]'))queueMicrotask(alignExpenseTabs);});
})();
