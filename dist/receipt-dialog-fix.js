(()=>{
  function closeReceiptDialog(){
    const dialog=document.querySelector('#company-receipt-dialog');
    if(dialog?.open)dialog.close();
  }

  // Usa captura para o fechamento continuar funcionando mesmo que outros
  // manipuladores da tela de vendas interrompam o clique.
  document.addEventListener('click',event=>{
    const closeButton=event.target.closest?.('#close-company-receipt');
    if(!closeButton)return;
    event.preventDefault();
    event.stopPropagation();
    closeReceiptDialog();
  },true);

  document.addEventListener('click',event=>{
    const dialog=event.target.closest?.('#company-receipt-dialog');
    if(event.target!==dialog||!dialog?.open)return;
    const bounds=dialog.getBoundingClientRect();
    const inside=event.clientX>=bounds.left&&event.clientX<=bounds.right&&event.clientY>=bounds.top&&event.clientY<=bounds.bottom;
    if(!inside)closeReceiptDialog();
  });
})();
