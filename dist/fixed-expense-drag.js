function reorderFixedExpense(sourceId,targetId,after){
 if(!sourceId||!targetId||sourceId===targetId)return false;
 const items=companyMonth().items;
 const sourceIndex=items.findIndex(item=>item.id===sourceId&&item.kind==='fixed');
 if(sourceIndex<0)return false;
 const [source]=items.splice(sourceIndex,1);
 const targetIndex=items.findIndex(item=>item.id===targetId&&item.kind==='fixed');
 if(targetIndex<0){items.splice(sourceIndex,0,source);return false;}
 items.splice(targetIndex+(after?1:0),0,source);
 return true;
}

(()=>{
 const root=document.querySelector('#company-section');
 if(!root?.querySelectorAll)return;
 let draggedId=null;

 function decorate(){
  root.querySelectorAll('.monthly-expenses .expense-table.modern tbody tr').forEach(row=>{
   const action=row.querySelector('[data-expense-edit],[data-expense-pay]');
   const id=action?.dataset.expenseEdit||action?.dataset.expensePay;
   if(!id)return;
   row.dataset.fixedExpenseId=id;
   row.draggable=true;
   if(!row.querySelector('.expense-drag-handle')){
    const handle=document.createElement('span');
    handle.className='expense-drag-handle';
    handle.title='Arraste para mudar a posição';
    handle.setAttribute('aria-hidden','true');
    handle.textContent='⠿';
    row.querySelector('td')?.append(handle);
   }
  });
 }

 function clearTargets(){
  root.querySelectorAll('.expense-drop-before,.expense-drop-after').forEach(row=>row.classList.remove('expense-drop-before','expense-drop-after'));
 }

 root.addEventListener('dragstart',event=>{
  if(event.target.closest('button,summary,details,input,select,a')){
   event.preventDefault();
   return;
  }
  const row=event.target.closest('[data-fixed-expense-id]');
  if(!row)return;
  draggedId=row.dataset.fixedExpenseId;
  row.classList.add('expense-dragging');
  event.dataTransfer.effectAllowed='move';
  event.dataTransfer.setData('text/plain',draggedId);
 });

 root.addEventListener('dragover',event=>{
  const target=event.target.closest('[data-fixed-expense-id]');
  if(!target||!draggedId||target.dataset.fixedExpenseId===draggedId)return;
  event.preventDefault();
  clearTargets();
  const rows=[...target.parentElement.querySelectorAll('[data-fixed-expense-id]')];
  const after=rows.findIndex(row=>row.dataset.fixedExpenseId===draggedId)<rows.indexOf(target);
  target.classList.add(after?'expense-drop-after':'expense-drop-before');
  event.dataTransfer.dropEffect='move';
 });

 root.addEventListener('drop',event=>{
  const target=event.target.closest('[data-fixed-expense-id]');
  if(!target||!draggedId||target.dataset.fixedExpenseId===draggedId)return;
  event.preventDefault();
  const rows=[...target.parentElement.querySelectorAll('[data-fixed-expense-id]')];
  const after=rows.findIndex(row=>row.dataset.fixedExpenseId===draggedId)<rows.indexOf(target);
  if(reorderFixedExpense(draggedId,target.dataset.fixedExpenseId,after)){
   save();render();toast('Ordem dos gastos atualizada');
  }
  draggedId=null;
  clearTargets();
 });

 root.addEventListener('dragend',event=>{
  event.target.closest('[data-fixed-expense-id]')?.classList.remove('expense-dragging');
  draggedId=null;
  clearTargets();
 });

 new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
 decorate();
})();
