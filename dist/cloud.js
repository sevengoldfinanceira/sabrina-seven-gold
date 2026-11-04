const SUPABASE_URL='https://xglgqvkamphjhxjzwanz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_u0L4aaSphKEIUiyal64R4w_WVbn7FJG';
const cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const localSave=save;
let cloudUser=null,cloudLoading=true,cloudSaveTimer=null,cloudSaving=false,cloudQueued=false,cloudWritePromise=null,cloudUpdatedAt='';
let cloudChannel=null,cloudPollTimer=null,cloudPulseTimer=null,cloudListenersReady=false;

function setCloudStatus(message){const el=$('#save-status');if(el)el.textContent=message;}

function stableFingerprint(value){
  if(Array.isArray(value))return `[${value.map(stableFingerprint).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableFingerprint(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hasPendingCloudWrite(){return Boolean(cloudSaveTimer||cloudSaving||cloudQueued);}

function pulseCloudRefresh(){
  document.body.classList.remove('cloud-refreshing');
  void document.body.offsetWidth;
  document.body.classList.add('cloud-refreshing');
  clearTimeout(cloudPulseTimer);
  cloudPulseTimer=setTimeout(()=>document.body.classList.remove('cloud-refreshing'),480);
}

function applyCloudState(data,{notify=true,updatedAt=''}={}){
  if(!data||hasPendingCloudWrite())return false;
  if(updatedAt&&cloudUpdatedAt&&updatedAt<=cloudUpdatedAt)return false;
  try{
    const next=validate(JSON.parse(JSON.stringify(data)));
    if(stableFingerprint(next)===stableFingerprint(state))return false;
    const previousSelected=selected;
    state=next;
    migratePersonFares();
    selected=state.people.some(person=>person.id===previousSelected)?previousSelected:(state.people[0]?.id||null);
    localSave();
    if(updatedAt)cloudUpdatedAt=updatedAt;
    render();
    setCloudStatus('✓ Atualizado agora');
    pulseCloudRefresh();
    if(notify)toast('Dados atualizados por outro acesso.');
    return true;
  }catch(error){
    console.error('Falha ao aplicar atualização on-line',error);
    return false;
  }
}

async function pullCloudState({notify=true}={}){
  if(!cloudUser||cloudLoading||hasPendingCloudWrite())return;
  const userId=cloudUser.id;
  const {data,error}=await cloud.from('app_state').select('data,updated_at').eq('user_id',userId).maybeSingle();
  if(error||cloudUser?.id!==userId)return;
  if(data?.data)applyCloudState(data.data,{notify,updatedAt:data.updated_at||''});
}

function stopCloudLiveSync(){
  clearInterval(cloudPollTimer);cloudPollTimer=null;
  if(cloudChannel){cloud.removeChannel(cloudChannel);cloudChannel=null;}
}

function startCloudLiveSync(user){
  stopCloudLiveSync();
  cloudChannel=cloud.channel(`app-state-${user.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'app_state',filter:`user_id=eq.${user.id}`},payload=>{
      if(payload.new?.data)applyCloudState(payload.new.data,{updatedAt:payload.new.updated_at||''});
    })
    .subscribe();
  // A consulta periódica mantém a atualização funcionando mesmo quando o Realtime
  // ainda não estiver habilitado para a tabela no painel do Supabase.
  cloudPollTimer=setInterval(()=>pullCloudState(),4000);
  if(!cloudListenersReady){
    cloudListenersReady=true;
    window.addEventListener('focus',()=>pullCloudState());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullCloudState();});
    window.addEventListener('storage',event=>{
      if(event.key!==KEY||!event.newValue||hasPendingCloudWrite())return;
      try{applyCloudState(JSON.parse(event.newValue));}catch{}
    });
  }
}

function queueCloudSave(){
  if(!cloudUser||cloudLoading)return;
  setCloudStatus('Salvando on-line…');
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>{cloudSaveTimer=null;pushCloudState();},500);
}

async function pushCloudState(){
  if(!cloudUser||cloudLoading)return true;
  if(cloudSaving){cloudQueued=true;return cloudWritePromise;}
  clearTimeout(cloudSaveTimer);cloudSaveTimer=null;
  cloudSaving=true;
  const snapshot=JSON.parse(JSON.stringify(state));
  const updatedAt=new Date().toISOString();
  cloudWritePromise=(async()=>{
    let error=null;
    try{({error}=await cloud.from('app_state').upsert({user_id:cloudUser.id,data:snapshot,updated_at:updatedAt},{onConflict:'user_id'}));}
    catch(cause){error=cause;}
    cloudSaving=false;
    if(error){setCloudStatus('Salvo neste navegador · falha na sincronização');toast('Não foi possível sincronizar agora. O backup local foi mantido.');}
    else{cloudUpdatedAt=updatedAt;setCloudStatus('✓ Sincronizado on-line');pulseCloudRefresh();}
    if(cloudQueued){cloudQueued=false;return pushCloudState();}
    return !error;
  })();
  return cloudWritePromise;
}

save=function(){const ok=localSave();queueCloudSave();return ok;};
async function saveAndSync(){
  const ok=localSave();
  if(!ok)return false;
  clearTimeout(cloudSaveTimer);cloudSaveTimer=null;
  return pushCloudState();
}

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
  const {data,error}=await cloud.from('app_state').select('data,updated_at').eq('user_id',user.id).maybeSingle();
  if(error){cloudLoading=false;showApp();ensureLogout();startCloudLiveSync(user);setCloudStatus('Dados locais · tentando reconectar');toast('Não foi possível carregar o Supabase agora. O sistema tentará novamente automaticamente.');return;}
  if(data?.data){
    try{state=validate(data.data);cloudUpdatedAt=data.updated_at||'';migratePersonFares();selected=state.people[0]?.id||null;localSave();}
    catch{cloudLoading=false;showApp();ensureLogout();startCloudLiveSync(user);setCloudStatus('Dados locais · conteúdo on-line inválido');toast('Os dados on-line não passaram na validação. O backup local foi preservado.');return;}
  }
  cloudLoading=false;showApp();ensureLogout();render();startCloudLiveSync(user);
  if(data?.data)setCloudStatus('✓ Sincronizado on-line');
  else{await pushCloudState();toast('Dados deste navegador enviados ao Supabase.');}
}

cloud.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||!session?.user){stopCloudLiveSync();cloudUser=null;showLogin();return;}
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
