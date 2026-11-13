const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');

const source=fs.readFileSync('dist/cloud.js','utf8');
const helpers=source.slice(0,source.indexOf('function ensureAuthUI'));
const storage=new Map();
const context={
  JSON,Date,Math,Map,Set,console,setTimeout,clearTimeout,
  KEY:'seven-good-adm-v1',state:{},save(){return true;},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
  window:{supabase:{createClient(){return {};}}},
  $(){return null;}
};
vm.createContext(context);vm.runInContext(helpers,context);

const merge=(base,local,remote)=>vm.runInContext('mergeCloudStates',context)(base,local,remote);
const base={
  version:1,
  people:[{id:'p1',name:'Pessoa',role:'Vendedor',pix:'',fare:0,fareGlobal:true}],
  saleEntries:[],
  records:{'2026-11:p1':{fare:0,days:[]}}
};
const local=structuredClone(base);
local.people[0].pix='11999999999';local.people[0].fare=6.2;
local.people.push({id:'p2',name:'Pessoa nova',role:'Vendedor',pix:'chave-pix',fare:5.5,fareGlobal:true});
local.records['2026-11:p1'].fare=6.2;
const remote=structuredClone(base);
remote.people[0].role='Supervisão';
remote.saleEntries.push({id:'s1',client:'Cliente remoto'});

const combined=merge(base,local,remote);
assert.equal(combined.people.find(person=>person.id==='p1').pix,'11999999999','Local Pix survives a concurrent remote edit');
assert.equal(combined.people.find(person=>person.id==='p1').fare,6.2,'Local fare survives a concurrent remote edit');
assert.equal(combined.people.find(person=>person.id==='p1').role,'Supervisão','Unrelated remote field is retained');
assert.equal(combined.people.find(person=>person.id==='p2').pix,'chave-pix','New local employee is retained');
assert.equal(combined.saleEntries[0].client,'Cliente remoto','New remote entity is retained');
assert.equal(combined.records['2026-11:p1'].fare,6.2,'Nested local record edit is retained');

const deletedLocally=merge({items:[{id:'a',value:1}]},{items:[]},{items:[{id:'a',value:1},{id:'b',value:2}]});
assert.deepEqual(JSON.parse(JSON.stringify(deletedLocally.items)),[{id:'b',value:2}],'Local deletion and remote addition merge safely');
const deletedRemotely=merge({items:[{id:'a',value:1},{id:'b',value:2}]},{items:[{id:'a',value:1},{id:'b',value:3}]},{items:[{id:'b',value:2}]});
assert.deepEqual(JSON.parse(JSON.stringify(deletedRemotely.items)),[{id:'b',value:3}],'Remote deletion and unrelated local edit merge safely');
assert.equal(merge({pix:'old'},{pix:'local'},{pix:'remote'}).pix,'local','Unsynced local value wins a same-field conflict');

const nextTimestamp=vm.runInContext('nextCloudTimestamp',context);
const future='2099-01-01T00:00:00.000Z';
assert.ok(nextTimestamp(future)>future,'Cloud timestamp remains monotonic even with clock skew');
console.log('PASS: conflict-safe Supabase merge, new employees, Pix, fare, deletions and monotonic timestamps');
