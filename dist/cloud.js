const SUPABASE_URL='https://xglgqvkamphjhxjzwanz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_u0L4aaSphKEIUiyal64R4w_WVbn7FJG';
const cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const localSave=save;
let cloudUser=null,cloudLoading=true,cloudSaveTimer=null,cloudSaving=false,cloudQueued=false;

function setCloudStatus(message){const el=$('#save-status');if(el)el.textContent=message;}

function queueCloudSave(){
  if(!cloudUser||cloudLoading)return;
  setCloudStatus('Salvando on-line…');
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(pushCloudState,500);
}

async function pushCloudState(){
  if(!cloudUser||cloudLoading)return;
  if(cloudSaving){cloudQueued=true;return;}
  cloudSaving=true;
  const snapshot=JSON.parse(JSON.stringify(state));
  const {error}=await cloud.from('app_state').upsert({user_id:cloudUser.id,data:snapshot,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  cloudSaving=false;
  if(error){setCloudStatus('Salvo neste navegador · falha na sincronização');toast('Não foi possível sincronizar agora. O backup local foi mantido.');}
  else setCloudStatus('✓ Sincronizado on-line');
  if(cloudQueued){cloudQueued=false;pushCloudState();}
}

save=function(){const ok=localSave();queueCloudSave();return ok;};

function ensureAuthUI(){
  if($('#cloud-login'))return;
  document.body.insertAdjacentHTML('beforeend',`<section id="cloud-login" class="cloud-login" aria-labelledby="cloud-login-title"><form id="cloud-login-form"><div class="cloud-login-brand"><img src="seven-gold.png" alt="Seven Gold"><span>SEVEN GOLD</span></div><h1 id="cloud-login-title">Acessar gestão financeira</h1><p>Entre com o usuário administrador para carregar e salvar os dados on-line.</p><label>E-mail<input type="email" name="email" autocomplete="username" required></label><label>Senha<input type="password" name="password" autocomplete="current-password" minlength="6" required></label><p id="cloud-login-error" class="cloud-login-error" role="alert"></p><button class="primary" type="submit">Entrar</button></form></section>`);
  $('#cloud-login-form').onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button'),error=$('#cloud-login-error');
    error.textContent='';button.disabled=true;button.textContent='Entrando…';
    const result=await cloud.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});
    if(result.error){error.textContent='E-mail ou senha inválidos.';button.disabled=false;button.textContent='Entrar';}
  };
}

function showLogin(){ensureAuthUI();document.body.classList.add('cloud-locked');$('#cloud-login').hidden=false;}
function showApp(){document.body.classList.remove('cloud-locked');if($('#cloud-login'))$('#cloud-login').hidden=true;}

function ensureLogout(){
  if($('#cloud-logout'))return;
  const button=document.createElement('button');button.id='cloud-logout';button.textContent='Sair';
  button.onclick=async()=>{clearTimeout(cloudSaveTimer);await pushCloudState();await cloud.auth.signOut();location.reload();};
  $('#export').parentElement.append(button);
}

async function loadCloudState(user){
  cloudUser=user;cloudLoading=true;setCloudStatus('Carregando dados on-line…');
  const {data,error}=await cloud.from('app_state').select('data').eq('user_id',user.id).maybeSingle();
  if(error){cloudLoading=false;showApp();ensureLogout();setCloudStatus('Dados locais · falha ao carregar on-line');toast('Não foi possível carregar o Supabase. Os dados locais foram preservados.');return;}
  if(data?.data){
    try{state=validate(data.data);migratePersonFares();selected=state.people[0]?.id||null;localSave();}
    catch{cloudLoading=false;showApp();ensureLogout();setCloudStatus('Dados locais · conteúdo on-line inválido');toast('Os dados on-line não passaram na validação. O backup local foi preservado.');return;}
  }
  cloudLoading=false;showApp();ensureLogout();render();
  if(data?.data)setCloudStatus('✓ Sincronizado on-line');
  else{await pushCloudState();toast('Dados deste navegador enviados ao Supabase.');}
}

cloud.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||!session?.user){cloudUser=null;showLogin();return;}
  if(event==='SIGNED_IN'&&session.user.id!==cloudUser?.id)loadCloudState(session.user);
});

(async()=>{
  ensureAuthUI();
  const footerNote=document.querySelector('footer span:last-child');
  if(footerNote)footerNote.textContent='Dados sincronizados on-line com Supabase · Exporte backups regularmente.';
  const {data}=await cloud.auth.getSession();
  if(data.session?.user)await loadCloudState(data.session.user);
  else showLogin();
})();
