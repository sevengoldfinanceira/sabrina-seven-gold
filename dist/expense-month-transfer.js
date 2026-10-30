function expenseVisibilityMonths(kind,date,dueDate,paidDate,sourceMonth){
 if(kind!=='variable')return [sourceMonth];
 return [...new Set([date?.slice(0,7),dueDate?.slice(0,7),paidDate?.slice(0,7)].filter(Boolean))];
}

function variableExpenseCopies(id){
 const copies=[];
 for(const [month,company] of Object.entries(state.company||{})){
  const entry=company?.items?.find(item=>item.id===id&&item.kind==='variable');
  if(entry)copies.push({month,entry});
 }
 return copies;
}

function storeExpenseAcrossMonths(entry,sourceMonth){
 if(entry.kind!=='variable'){
  const company=companyMonth(sourceMonth),index=company.items.findIndex(item=>item.id===entry.id);
  if(index>=0)company.items[index]=entry;
  else company.items.push(entry);
  return [sourceMonth];
 }
 for(const company of Object.values(state.company||{})){
  if(!Array.isArray(company?.items))continue;
  company.items=company.items.filter(item=>item.id!==entry.id);
 }
 const months=expenseVisibilityMonths(entry.kind,entry.date,entry.dueDate,entry.paidDate,sourceMonth);
 for(const month of months)companyMonth(month).items.push({...entry});
 return months;
}

function syncVariableExpenseVisibility(){
 const groups=new Map();
 for(const [month,company] of Object.entries(state.company||{})){
  for(const entry of company?.items||[]){
   if(entry.kind!=='variable')continue;
   if(!groups.has(entry.id))groups.set(entry.id,[]);
   groups.get(entry.id).push({month,entry});
  }
 }
 let changed=false;
 for(const copies of groups.values()){
  const purchaseMonth=copies[0].entry.date?.slice(0,7);
  const canonical=copies.find(copy=>copy.month===purchaseMonth)||copies[0];
  const desired=expenseVisibilityMonths(canonical.entry.kind,canonical.entry.date,canonical.entry.dueDate,canonical.entry.paidDate,canonical.month).sort();
  const present=copies.map(copy=>copy.month).sort();
  const signature=JSON.stringify(canonical.entry);
  if(desired.join(',')===present.join(',')&&copies.every(copy=>JSON.stringify(copy.entry)===signature))continue;
  storeExpenseAcrossMonths({...canonical.entry},canonical.month);
  changed=true;
 }
 return changed;
}

(()=>{
 const expenseForm=document.querySelector('#expense-form');
 expenseForm.onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  if(!form.reportValidity()||!expenseContext)return;
  const ctx=expenseContext,date=form.elements.date.value,dueDate=form.elements.dueDate?.value||null,paidDate=form.elements.paidDate.value||null,name=form.elements.name.value.trim();
  if(!name||!validDate(date)||(dueDate&&!validDate(dueDate))||(paidDate&&!validDate(paidDate)))return;
  const prior=companyMonth(ctx.month).items.find(item=>item.id===ctx.id),kind=prior?.kind||ctx.kind||'variable';
  if(kind==='fixed'&&date.slice(0,7)!==ctx.month){toast('Escolha um vencimento dentro do mês selecionado.');return;}
  if(kind==='variable'&&!dueDate){toast('Informe a data de vencimento.');return;}
  const entry={id:ctx.id||crypto.randomUUID(),kind,name,amount:parseCredit(form.elements.amount.value),date,dueDate:kind==='variable'?dueDate:null,paidDate,fees:paidDate?(prior?.fees||0):0,voided:false};
  const months=storeExpenseAcrossMonths(entry,ctx.month);
  save();render();document.querySelector('#expense-dialog').close();
  toast(months.length>1?'Gasto exibido nos meses da compra, vencimento e pagamento':'Gasto salvo');
 };

 const paymentForm=document.querySelector('#expense-payment-form');
 paymentForm.onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  if(!form.reportValidity()||!expensePaymentContext)return;
  const paidDate=form.elements.paidDate.value;
  if(!validDate(paidDate)){toast('Informe uma data de pagamento válida.');return;}
  const sourceMonth=expensePaymentContext.month;
  const entry=companyMonth(sourceMonth).items.find(item=>item.id===expensePaymentContext.id);
  if(!entry)return;
  entry.paidDate=paidDate;
  entry.fees=parseCredit(form.elements.fees.value);
  const months=storeExpenseAcrossMonths(entry,sourceMonth);
  save();render();document.querySelector('#expense-payment-dialog').close();
  toast(months.length>1?'Gasto exibido nos meses da compra, vencimento e pagamento':'Pagamento registrado com data');
 };

 document.querySelector('#unpay-expense').onclick=()=>{
  if(!expensePaymentContext)return;
  const sourceMonth=expensePaymentContext.month;
  const entry=companyMonth(sourceMonth).items.find(item=>item.id===expensePaymentContext.id);
  if(!entry)return;
  entry.paidDate=null;
  entry.fees=0;
  storeExpenseAcrossMonths(entry,sourceMonth);
  save();render();document.querySelector('#expense-payment-dialog').close();toast('Pagamento removido');
 };

 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-expense-void]');
  if(!button)return;
  const current=companyMonth().items.find(item=>item.id===button.dataset.expenseVoid);
  if(!current||current.kind!=='variable')return;
  for(const copy of variableExpenseCopies(current.id))copy.entry.voided=current.voided;
  save();render();
 });

 validateCompany=function(data){
  if(data.company===undefined)return;
  if(!data.company||typeof data.company!=='object'||Array.isArray(data.company))throw Error('Gastos inválidos');
  for(const [month,company] of Object.entries(data.company)){
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!company||!(company.revenue===null||Number.isSafeInteger(company.revenue)&&company.revenue>=0)||!(company.taxRate===undefined||Number.isFinite(company.taxRate)&&company.taxRate>=0&&company.taxRate<=100)||!Array.isArray(company.items))throw Error('Mês inválido');
   const ids=new Set();
   for(const expense of company.items){
    const dateIsValid=expense&&expense.date===null||expense&&validDate(expense.date)&&(expense.kind==='variable'||expense.date.slice(0,7)===month);
    const dueDateIsValid=expense&&(expense.dueDate===undefined||expense.dueDate===null||validDate(expense.dueDate));
    if(!expense||typeof expense.id!=='string'||!expense.id||ids.has(expense.id)||typeof expense.name!=='string'||!expense.name.trim()||!['fixed','variable'].includes(expense.kind)||!(expense.amount===null||Number.isSafeInteger(expense.amount)&&expense.amount>=0)||!dateIsValid||!dueDateIsValid||!(expense.paidDate===null||validDate(expense.paidDate))||typeof expense.voided!=='boolean'||!(expense.fees===undefined||Number.isSafeInteger(expense.fees)&&expense.fees>=0))throw Error('Gasto inválido');
    ids.add(expense.id);
   }
  }
 };

 const renderCompanyWithExpenseVisibility=renderCompany;
 renderCompany=function(){
  if(syncVariableExpenseVisibility())save();
  renderCompanyWithExpenseVisibility();
 };
})();
