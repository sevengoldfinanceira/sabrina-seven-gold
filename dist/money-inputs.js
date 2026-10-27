// Values are displayed in BRL; calculations continue using integer cents.
function validateMoneyInput(input){const amount=parseCredit(input.value),min=Number(input.dataset.moneyMin||0)*100,max=Number(input.dataset.moneyMax||1000000000000)*100;input.setCustomValidity(input.value===''?'':!Number.isSafeInteger(amount)||amount<min||amount>max?'Informe um valor em reais entre '+formatCredit(min)+' e '+formatCredit(max)+'.':'');return input.checkValidity();}
document.addEventListener('input',e=>{if(!e.target.matches('[data-money]'))return;maskCredit(e.target);validateMoneyInput(e.target);},true);
document.addEventListener('change',e=>{if(!e.target.matches('[data-money]'))return;validateMoneyInput(e.target);},true);
document.addEventListener('keydown',e=>{const input=e.target;if(!input.matches('[data-money]'))return;if(e.key===','&&input.value.includes(',')){e.preventDefault();const pos=input.value.indexOf(',')+1;input.setSelectionRange(pos,input.value.length);}},true);
document.addEventListener('submit',e=>{let valid=true;for(const input of e.target.querySelectorAll('[data-money]'))if(!validateMoneyInput(input))valid=false;if(!valid){e.preventDefault();e.stopImmediatePropagation();e.target.reportValidity();}},true);
document.addEventListener('reset',e=>{for(const input of e.target.querySelectorAll('[data-money]'))input.setCustomValidity('');},true);
