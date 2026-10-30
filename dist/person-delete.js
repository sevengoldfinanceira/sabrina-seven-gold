(()=>{
 function installPersonDelete(){
  const form=document.querySelector('#person-form');
  if(!form||form.querySelector('#delete-person'))return;
  const saveButton=form.querySelector('button[type="submit"]');
  const deleteButton=document.createElement('button');
  deleteButton.type='button';
  deleteButton.id='delete-person';
  deleteButton.className='danger-person-delete';
  deleteButton.textContent='Apagar cadastro';
  deleteButton.hidden=true;
  form.insertBefore(deleteButton,saveButton);
  const originalOpenPerson=openPerson;
  openPerson=function(edit=false){originalOpenPerson(edit);deleteButton.hidden=!edit;};
  deleteButton.addEventListener('click',()=>{
   const person=state.people.find(item=>item.id===editing);
   if(!person)return;
   if(state.people.length<=1){toast('É necessário manter pelo menos uma pessoa cadastrada.');return;}
   const linkedSales=(state.saleEntries||[]).filter(sale=>sale.originator===person.id||sale.closer===person.id);
   const linkedAdvances=(state.advances||[]).filter(advance=>advance.person===person.id);
   const recordKeys=Object.keys(state.records).filter(key=>key.endsWith(':'+person.id));
   const details=[linkedSales.length&&linkedSales.length+' venda(s)',linkedAdvances.length&&linkedAdvances.length+' vale(s)',recordKeys.length&&recordKeys.length+' registro(s) mensal(is)'].filter(Boolean).join(', ');
   const warning='Apagar definitivamente o cadastro de “'+person.name+'”?'+(details?' Também serão removidos '+details+'.':'')+' Esta ação não poderá ser desfeita.';
   if(!confirm(warning))return;
   const removedSaleIds=new Set(linkedSales.map(sale=>sale.id));
   state.people=state.people.filter(item=>item.id!==person.id);
   state.saleEntries=(state.saleEntries||[]).filter(sale=>!removedSaleIds.has(sale.id));
   state.companyCommissionPayments=(state.companyCommissionPayments||[]).filter(payment=>!removedSaleIds.has(payment.saleId));
   state.advances=(state.advances||[]).filter(advance=>advance.person!==person.id);
   recordKeys.forEach(key=>delete state.records[key]);
   selected=state.people[0]?.id||null;
   editing=null;
   save();
   render();
   document.querySelector('#person-dialog').close();
   toast('Cadastro apagado definitivamente');
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPersonDelete);else installPersonDelete();
})();
