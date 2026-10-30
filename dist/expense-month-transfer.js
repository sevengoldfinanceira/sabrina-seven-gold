function expenseDestinationMonth(kind,date,paidDate,sourceMonth){
 if(kind!=='variable')return sourceMonth;
 return (paidDate||date).slice(0,7);
}

function storeExpenseInMonth(entry,sourceMonth,targetMonth){
 const source=companyMonth(sourceMonth);
 const sourceIndex=source.items.findIndex(item=>item.id===entry.id);
 if(sourceIndex>=0)source.items.splice(sourceIndex,1);
 const target=companyMonth(targetMonth);
 const targetIndex=target.items.findIndex(item=>item.id===entry.id);
 if(targetIndex>=0)target.items[targetIndex]=entry;
 else target.items.push(entry);
}

(()=>{
 const expenseForm=document.querySelector('#expense-form');
 expenseForm.onsubmit=event=>{
  event.preventDefault();
  const form=event.target;
  if(!form.reportValidity()||!expenseContext)return;
  const ctx=expenseContext,date=form.elements.date.value,paidDate=form.elements.paidDate.value||null,name=form.elements.name.value.trim();
  if(!name||!validDate(date)||(paidDate&&!validDate(paidDate)))return;
  const source=companyMonth(ctx.month),prior=source.items.find(item=>item.id===ctx.id),kind=prior?.kind||ctx.kind||'variable';
  if(kind==='fixed'&&date.slice(0,7)!==ctx.month){toast('Escolha um vencimento dentro do mês selecionado.');return;}
  const entry={id:ctx.id||crypto.randomUUID(),kind,name,amount:parseCredit(form.elements.amount.value),date,paidDate,fees:paidDate?(prior?.fees||0):0,voided:false};
  const targetMonth=expenseDestinationMonth(kind,date,paidDate,ctx.month);
  storeExpenseInMonth(entry,ctx.month,targetMonth);
  save();render();document.querySelector('#expense-dialog').close();
  toast(targetMonth===ctx.month?'Gasto salvo':'Gasto movido para o mês da data de pagamento');
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
  const targetMonth=expenseDestinationMonth(entry.kind,entry.date,paidDate,sourceMonth);
  storeExpenseInMonth(entry,sourceMonth,targetMonth);
  save();render();document.querySelector('#expense-payment-dialog').close();
  toast(targetMonth===sourceMonth?'Pagamento registrado com data':'Gasto movido para o mês da data de pagamento');
 };

 validateCompany=function(data){
  if(data.company===undefined)return;
  if(!data.company||typeof data.company!=='object'||Array.isArray(data.company))throw Error('Gastos inválidos');
  for(const [month,company] of Object.entries(data.company)){
   if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!company||!(company.revenue===null||Number.isSafeInteger(company.revenue)&&company.revenue>=0)||!(company.taxRate===undefined||Number.isFinite(company.taxRate)&&company.taxRate>=0&&company.taxRate<=100)||!Array.isArray(company.items))throw Error('Mês inválido');
   const ids=new Set();
   for(const expense of company.items){
    const dateIsValid=expense.date===null||validDate(expense.date)&&(expense.kind==='variable'||expense.date.slice(0,7)===month);
    if(!expense||typeof expense.id!=='string'||!expense.id||ids.has(expense.id)||typeof expense.name!=='string'||!expense.name.trim()||!['fixed','variable'].includes(expense.kind)||!(expense.amount===null||Number.isSafeInteger(expense.amount)&&expense.amount>=0)||!dateIsValid||!(expense.paidDate===null||validDate(expense.paidDate))||typeof expense.voided!=='boolean'||!(expense.fees===undefined||Number.isSafeInteger(expense.fees)&&expense.fees>=0))throw Error('Gasto inválido');
    ids.add(expense.id);
   }
  }
 };
})();
