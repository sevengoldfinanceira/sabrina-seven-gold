(()=>{
 const form=document.querySelector('#expense-form');
 const paidInput=form?.elements?.paidDate;
 if(!form||!paidInput)return;
 const paidLabel=paidInput.closest('label');
 const dueLabel=document.createElement('label');
 dueLabel.id='expense-due-date-label';
 dueLabel.innerHTML='Data de vencimento<input name="dueDate" type="date">';
 paidLabel.before(dueLabel);

 const openExpenseWithDueDate=openExpense;
 openExpense=function(id=null,name='',kind='variable'){
  const entry=companyMonth().items.find(expense=>expense.id===id);
  openExpenseWithDueDate(id,name,kind);
  const variable=expenseContext?.kind!=='fixed';
  dueLabel.hidden=!variable;
  form.elements.dueDate.required=variable;
  form.elements.dueDate.value=variable?(entry?.dueDate||entry?.paidDate||entry?.date||''):'';
  paidLabel.firstChild.textContent='Data do pagamento (opcional)';
 };
})();
