const SUPABASE_URL='https://xglgqvkamphjhxjzwanz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_u0L4aaSphKEIUiyal64R4w_WVbn7FJG';
const cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const localSave=save;
const CLOUD_PENDING_KEY=KEY+'-cloud-pending-v1';
let cloudUser=null,cloudLoading=true,cloudSaveTimer=null,cloudSaving=false,cloudQueued=false,cloudWritePromise=null,cloudUpdatedAt='';
let cloudBaseState=null,cloudDirty=false,cloudRetryDelay=2000;
let cloudChannel=null,cloudPollTimer=null,cloudPulseTimer=null,cloudListenersReady=false;

function setCloudStatus(message){const el=$('#save-status');if(el)el.textContent=message;}

function stableFingerprint(value){
  if(Array.isArray(value))return `[${value.map(stableFingerprint).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableFingerprint(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const cloneCloudValue=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const sameCloudValue=(a,b)=>stableFingerprint(a)===stableFingerprint(b);

function keyedCloudArray(...lists){
  const items=lists.filter(Array.isArray).flat();
  return items.length>0&&items.every(item=>item&&typeof item==='object'&&typeof item.id==='string');
}

function mergeCloudArrays(base,local,remote){
  if(!keyedCloudArray(base,local,remote))return cloneCloudValue(local);
  const baseMap=new Map((base||[]).map(item=>[item.id,item]));
  const localMap=new Map((local||[]).map(item=>[item.id,item]));
  const remoteMap=new Map((remote||[]).map(item=>[item.id,item]));
  const order=[...(remote||[]).map(item=>item.id),...(local||[]).map(item=>item.id)];
  return [...new Set(order)].flatMap(id=>{
    const merged=mergeCloudStates(baseMap.get(id),localMap.get(id),remoteMap.get(id));
    return merged===undefined?[]:[merged];
  });
}

function mergeCloudStates(base,local,remote){
  if(sameCloudValue(local,base))return cloneCloudValue(remote);
  if(sameCloudValue(remote,base))return cloneCloudValue(local);
  if(local===undefined)return undefined;
  if(remote===undefined)return cloneCloudValue(local);
  if(Array.isArray(local)&&Array.isArray(remote))return mergeCloudArrays(Array.isArray(base)?base:[],local,remote);
  if(local&&remote&&typeof local==='object'&&typeof remote==='object'){
    const result={},baseObject=base&&typeof base==='object'&&!Array.isArray(base)?base:{};
    for(const key of new Set([...Object.keys(baseObject),...Object.keys(remote),...Object.keys(local)])){
      const merged=mergeCloudStates(baseObject[key],local[key],remote[key]);
      if(merged!==undefined)result[key]=merged;
    }
    return result;
  }
  // Se os dois acessos alteraram o mesmo campo, mantém a edição local que ainda
  // não foi sincronizada. Alterações remotas em outros campos já foram mescladas.
  return cloneCloudValue(local);
}

function readPendingCloudSave(userId){
  try{
    const pending=JSON.parse(localStorage.getItem(CLOUD_PENDING_KEY)||'null');
    return pending?.userId===userId&&pending.base?pending:null;
  }catch{return null;}
}

function markPendingCloudSave(){
  if(!cloudUser||cloudLoading)return;
  cloudDirty=true;
  try{localStorage.setItem(CLOUD_PENDING_KEY,JSON.stringify({userId:cloudUser.id,baseUpdatedAt:cloudUpdatedAt,base:cloudBaseState||cloneCloudValue(state)}));}catch{}
}

function clearPendingCloudSave(snapshot){
  if(!sameCloudValue(snapshot,state))return false;
  cloudDirty=false;
  try{localStorage.removeItem(CLOUD_PENDING_KEY);}catch{}
  return true;
}

function hasPendingCloudWrite(){return Boolean(cloudDirty||cloudSaveTimer||cloudSaving||cloudQueued);}

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
    if(stableFingerprint(next)===stableFingerprint(state)){
      cloudBaseState=cloneCloudValue(next);
      if(updatedAt)cloudUpdatedAt=updatedAt;
      return false;
    }
    const previousSelected=selected;
    state=next;
    migratePersonFares();
    selected=state.people.some(person=>person.id===previousSelected)?previousSelected:(state.people[0]?.id||null);
    localSave();
    cloudBaseState=cloneCloudValue(state);
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

function queueCloudSave(delay=500){
  if(!cloudUser||cloudLoading)return;
  setCloudStatus('Salvando on-line…');
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>{cloudSaveTimer=null;pushCloudState();},delay);
}

function nextCloudTimestamp(previous=''){
  const prior=Date.parse(previous),now=Date.now();
  return new Date(Number.isFinite(prior)?Math.max(now,prior+1):now).toISOString();
}

async function fetchCloudRow(userId){
  const result=await cloud.from('app_state').select('data,updated_at').eq('user_id',userId).maybeSingle();
  if(result.error)throw result.error;
  return result.data||null;
}

async function pushCloudState(){
  if(!cloudUser||cloudLoading)return true;
  if(cloudSaving){cloudQueued=true;return cloudWritePromise;}
  clearTimeout(cloudSaveTimer);cloudSaveTimer=null;
  cloudSaving=true;
  cloudWritePromise=(async()=>{
    let error=null,writtenSnapshot=null;
    try{
      for(let attempt=0;attempt<3;attempt++){
        const userId=cloudUser.id,row=await fetchCloudRow(userId);
        if(cloudUser?.id!==userId)throw Error('Sessão alterada durante a sincronização.');
        const remoteState=row?.data?validate(cloneCloudValue(row.data)):null;
        let snapshot=cloneCloudValue(state);
        if(remoteState&&!sameCloudValue(remoteState,cloudBaseState)){
          snapshot=validate(mergeCloudStates(cloudBaseState||remoteState,snapshot,remoteState));
          const previousSelected=selected;
          state=cloneCloudValue(snapshot);
          migratePersonFares();
          selected=state.people.some(person=>person.id===previousSelected)?previousSelected:(state.people[0]?.id||null);
          localSave();
          render();
        }
        cloudBaseState=remoteState?cloneCloudValue(remoteState):null;
        cloudUpdatedAt=row?.updated_at||'';
        const updatedAt=nextCloudTimestamp(cloudUpdatedAt),payload={user_id:userId,data:snapshot,updated_at:updatedAt};
        let result;
        if(row){
          result=await cloud.from('app_state').update(payload).eq('user_id',userId).eq('updated_at',row.updated_at).select('data,updated_at').maybeSingle();
          if(!result.error&&!result.data)continue;
        }else{
          result=await cloud.from('app_state').insert(payload).select('data,updated_at').maybeSingle();
          if(result.error?.code==='23505')continue;
        }
        if(result.error)throw result.error;
        writtenSnapshot=cloneCloudValue(result.data?.data||snapshot);
        cloudBaseState=cloneCloudValue(writtenSnapshot);
        cloudUpdatedAt=result.data?.updated_at||updatedAt;
        break;
      }
      if(!writtenSnapshot)throw Error('Os dados mudaram durante a sincronização.');
    }catch(cause){error=cause;}
    cloudSaving=false;
    if(error){
      setCloudStatus('Salvo neste navegador · tentando sincronizar novamente');
      toast('A conexão oscilou. Os dados foram preservados e o sistema tentará sincronizar novamente.');
      queueCloudSave(cloudRetryDelay);
      cloudRetryDelay=Math.min(cloudRetryDelay*2,30000);
    }else{
      cloudRetryDelay=2000;
      if(!clearPendingCloudSave(writtenSnapshot))queueCloudSave();
      setCloudStatus(cloudDirty?'Salvando alterações mais recentes…':'✓ Sincronizado on-line');
      pulseCloudRefresh();
    }
    if(cloudQueued){cloudQueued=false;return pushCloudState();}
    return !error;
  })();
  return cloudWritePromise;
}

save=function(){const ok=localSave();if(ok){markPendingCloudSave();queueCloudSave();}return ok;};
async function saveAndSync(){
  const ok=localSave();
  if(!ok)return false;
  markPendingCloudSave();
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
  const pending=readPendingCloudSave(user.id);
  cloudDirty=Boolean(pending);
  const {data,error}=await cloud.from('app_state').select('data,updated_at').eq('user_id',user.id).maybeSingle();
  if(error){cloudLoading=false;showApp();ensureLogout();startCloudLiveSync(user);setCloudStatus('Dados locais · tentando reconectar');toast('Não foi possível carregar o Supabase agora. O sistema tentará novamente automaticamente.');if(cloudDirty)queueCloudSave(cloudRetryDelay);return;}
  if(data?.data){
    try{
      const remoteState=validate(cloneCloudValue(data.data));
      cloudBaseState=cloneCloudValue(remoteState);
      cloudUpdatedAt=data.updated_at||'';
      if(pending){
        let pendingBase;
        try{pendingBase=validate(cloneCloudValue(pending.base));}catch{pendingBase=remoteState;}
        state=validate(mergeCloudStates(pendingBase,state,remoteState));
        cloudDirty=!sameCloudValue(state,remoteState);
        if(!cloudDirty)try{localStorage.removeItem(CLOUD_PENDING_KEY);}catch{}
      }else state=remoteState;
      migratePersonFares();selected=state.people[0]?.id||null;localSave();
    }
    catch{cloudLoading=false;showApp();ensureLogout();startCloudLiveSync(user);setCloudStatus('Dados locais · conteúdo on-line inválido');toast('Os dados on-line não passaram na validação. O backup local foi preservado.');return;}
  }else{cloudBaseState=null;cloudUpdatedAt='';cloudDirty=true;}
  cloudLoading=false;showApp();ensureLogout();render();startCloudLiveSync(user);
  if(cloudDirty){
    markPendingCloudSave();
    const synced=await pushCloudState();
    if(synced&&!data?.data)toast('Dados deste navegador enviados ao Supabase.');
  }else setCloudStatus('✓ Sincronizado on-line');
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
