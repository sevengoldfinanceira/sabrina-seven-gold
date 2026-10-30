(()=>{
 variableExpenseRows=function(list){
  const date=value=>value?value.split('-').reverse().join('/'):'—';
  return list.map(expense=>`<tr>
   <td data-label="Descrição"><strong>${esc(expense.name)}</strong>${expense.amount===null?'<small>Valor pendente</small>':''}</td>
   <td data-label="Valor">${expense.amount===null?'—':money(expense.amount/100)}</td>
   <td data-label="Data da compra">${date(expense.date)}</td>
   <td data-label="Vencimento">${date(expense.dueDate)}</td>
   <td data-label="Pagamento"><span>${date(expense.paidDate)}</span><span class="expense-status ${expense.paidDate?'paid':'missing'}">${expense.paidDate?'Pago':'Pendente'}</span></td>
   <td data-label="Ações"><div class="variable-expense-actions">
    <button data-expense-pay="${esc(expense.id)}" ${expense.amount===null?'disabled':''}>${expense.paidDate?'Ver pagamento':'Marcar pago'}</button>
    <details class="expense-menu"><summary aria-label="Mais ações">…</summary><div>
     <button data-expense-edit="${esc(expense.id)}">Editar gasto</button>
     ${expense.paidDate?`<button data-expense-pay="${esc(expense.id)}">Alterar ou remover pagamento</button>`:''}
     <button class="danger" data-expense-void="${esc(expense.id)}">Excluir</button>
    </div></details>
   </div></td>
  </tr>`).join('');
 };
})();
