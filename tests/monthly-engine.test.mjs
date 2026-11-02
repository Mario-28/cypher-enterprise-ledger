import assert from 'node:assert/strict';
import * as E from '../scripts/monthly-engine.mjs';
const results=[];
const test=(name,fn)=>{fn();results.push(name);};
const pc={uuid:'Actor.one',name:'Ada',role:'foreman',task:'production'};
const user={id:'u1',name:'Owner',isGM:false};
const gm={id:'gm',name:'GM',isGM:true,override:true};
const config={days:20};
function state(){return {month:1,level:2,cash:10000,pcs:[{...pc}],tasks:[],staff:[{id:'worker',name:'Worker',wage:50,happiness:50}],events:[{id:'int',kind:'internal',level:2,title:'Boiler'},{id:'ext',kind:'external',level:2,title:'Raid'}],routes:[{id:'route',name:'Route',legs:1,escort:0}],contracts:[{id:'contract',status:'active',title:'Job',level:2,required:4,progress:0}],rivals:[{id:'rival',intel:50,aggression:1,plan:{blocked:false}}],divisions:[{id:'division',name:'Division',integration:10}],branches:[{id:'branch',name:'Branch',userId:'u1',tier:2,growth:0,morale:50}],stats:{nat20:0,resolvedInternal:0,resolvedExternal:0},heat:10,reputation:20};}
const target={internal:'int',external:'ext',route:'route',contract:'contract',rival:'rival',division:'division',branch:'branch',staff:'worker',none:''};
function request(s,task,extra={}){return {task,pcUuid:pc.uuid,pcName:pc.name,targetId:target[E.TASKS[task].target],approach:'standard',funding:'standard',cost:{company:E.TASKS[task].coins*s.level,personal:0,might:0,speed:0,intellect:0},...extra};}
function ready(s,task,extra={}){const a=E.create(s,request(s,task,extra),user,config);if(a.alternativeFunding)a.fundingApprovedBy='gm';E.accept(s,a,user,config);return a;}
test('catalog 33 tasks',()=>assert.equal(Object.keys(E.TASKS).length,33));
for(const t of Object.values(E.TASKS))for(const nat of [1,10,20])test(`${t.id}: d20 ${nat}`,()=>{const s=state();if(t.requires)E.addEffect(s,{id:'lead',pcUuid:pc.uuid},t.requires,'Lead',[],0);const a=ready(s,t.id);const r=E.resolve(s,a,nat,user,config);assert.equal(a.status,'resolved');assert.equal(s.tasks.length,1);assert.equal(r.income,r.plannerGross-r.plannerExpense);assert.equal(s.cash,10000);assert.equal(s.planning.receipts.length,1);assert.ok(Number.isFinite(a.result.net));assert.throws(()=>E.resolve(s,a,nat,user,config));});
test('default cost quote',()=>{const s=state(),q=E.quote(s,request(s,'marketing'));assert.equal(q.cost.company,40);assert.equal(q.days,2);assert.equal(q.alternativeFunding,false);});
test('invalid numeric cost',()=>{const s=state();assert.throws(()=>E.quote(s,request(s,'marketing',{cost:{company:-1}})));assert.throws(()=>E.quote(s,request(s,'marketing',{cost:{company:1.5}})));});
test('pool cap',()=>{const s=state();assert.throws(()=>E.quote(s,request(s,'marketing',{cost:{company:40,might:11}})));});
test('preparation capped',()=>{const s=state(),q=E.quote(s,request(s,'marketing',{approach:'thorough',funding:'enhanced',cost:{company:9999,personal:100,might:10,speed:10,intellect:10}}));assert.equal(q.prep,3);});
test('proposal reserves nothing',()=>{const s=state();E.create(s,request(s,'marketing'),user,config);assert.equal(E.daysUsed(s,pc.uuid),0);assert.equal(E.companyReserved(s),0);});
test('acceptance reserves once',()=>{const s=state(),a=ready(s,'marketing');assert.equal(E.daysUsed(s,pc.uuid),2);assert.equal(E.companyReserved(s),40);assert.throws(()=>E.accept(s,a,user,config));});
test('cancellation releases reservation',()=>{const s=state(),a=ready(s,'marketing');E.cancel(s,a,user);assert.equal(E.daysUsed(s,pc.uuid),0);assert.equal(E.companyReserved(s),0);});
test('insufficient treasury',()=>{const s=state();s.cash=5;assert.throws(()=>E.create(s,request(s,'marketing'),user,config));});
test('time overbooking refused',()=>{const s=state();for(let i=0;i<4;i++)ready(s,'prototype');assert.equal(E.daysUsed(s,pc.uuid),20);assert.throws(()=>E.create(s,request(s,'marketing'),user,config));});
test('alternative funding needs approval',()=>{const s=state(),a=E.create(s,request(s,'marketing',{cost:{company:0,personal:20,might:2}}),user,config);assert.equal(a.alternativeFunding,true);assert.throws(()=>E.accept(s,a,user,config));a.fundingApprovedBy='gm';E.accept(s,a,user,config);assert.throws(()=>E.resolve(s,a,20,user,config));E.paid(s,a,user);E.resolve(s,a,20,user,config);assert.equal(a.cost.company,0);assert.equal(a.payment.manual,true);});
test('mixed costs require owner receipt',()=>{const s=state(),a=ready(s,'marketing',{cost:{company:40,personal:25,might:2,speed:1,intellect:1}});assert.throws(()=>E.resolve(s,a,20,user,config));E.paid(s,a,user);E.resolve(s,a,20,user,config);assert.deepEqual(s.planning.receipts[0].cost,{company:40,personal:25,might:2,speed:1,intellect:1});});
test('GM manual payment must be explicit override',()=>{const s=state(),a=ready(s,'marketing',{cost:{company:40,personal:5}});assert.throws(()=>E.paid(s,a,{...gm,override:false}));E.paid(s,a,gm);assert.equal(a.payment.override,true);});
test('bad/missing targets',()=>{const s=state();assert.throws(()=>E.create(s,request(s,'work',{targetId:'absent'}),user,config));assert.throws(()=>E.create(s,request(s,'repair',{targetId:'ext'}),user,config));});
test('lead requirement and consumption',()=>{const s=state();assert.throws(()=>E.create(s,request(s,'launch'),user,config));E.resolve(s,ready(s,'prototype'),20,user,config);assert.equal(E.hasLead(s,pc.uuid,'prototype'),true);E.resolve(s,ready(s,'launch'),20,user,config);assert.equal(E.hasLead(s,pc.uuid,'prototype'),false);});
test('expired effects do not help',()=>{const s=state();E.addEffect(s,{id:'x',pcUuid:pc.uuid},'survey','Market',['commerce'],1,2);s.month=3;assert.equal(E.effective(s,pc.uuid,'commerce').length,0);});
test('rush complication creates fatigue',()=>{const s=state(),a=ready(s,'marketing',{approach:'rush'});E.resolve(s,a,1,user,config);assert.equal(E.effective(s,pc.uuid,'commerce').find(e=>e.key==='fatigue').bonus,-1);});
test('recovery clears planner fatigue',()=>{const s=state();E.addEffect(s,{id:'x',pcUuid:pc.uuid},'fatigue','Fatigue',['*'],-1,1);E.resolve(s,ready(s,'recover'),20,user,config);assert.equal(E.effective(s,pc.uuid).filter(e=>e.key==='fatigue').length,0);});
test('weekly shares time',()=>{const s=state();E.weeklyReserve(s,[pc],5,20);E.weeklyFinish(s,1,1,true);ready(s,'prototype');assert.equal(E.daysUsed(s,pc.uuid),10);assert.throws(()=>E.weeklyReserve(s,[pc],5,20));s.week=2;E.weeklyReserve(s,[pc],5,20);E.weeklyFinish(s,1,2,false);assert.equal(E.daysUsed(s,pc.uuid),10);});
test('weekly cannot overbook accepted tasks',()=>{const s=state();for(let i=0;i<4;i++)ready(s,'prototype');s.week=1;assert.throws(()=>E.weeklyReserve(s,[pc],5,20));});
test('month budgets reset, old receipts retained',()=>{const s=state();E.resolve(s,ready(s,'marketing'),20,user,config);s.month=2;assert.equal(E.daysUsed(s,pc.uuid),0);assert.equal(E.companyReserved(s),0);assert.equal(E.monthSummary(s,1).count,1);});
test('cost charged exactly once via task contribution',()=>{const s=state(),a=ready(s,'marketing');const r=E.resolve(s,a,20,user,config);assert.equal(r.income,100-40);assert.equal(s.cash,10000);assert.equal(E.companyReserved(s),40);s.cash+=s.tasks.reduce((n,t)=>n+t.income,0);s.tasks=[];s.month++;assert.equal(s.cash,10060);assert.equal(E.companyReserved(s),0);});
test('JSON backup preserves all commitments',()=>{const s=state();ready(s,'marketing');const clone=JSON.parse(JSON.stringify(s));E.ensure(clone);assert.deepEqual(clone,s);});
test('stale assignment refused',()=>{const s=state(),a=ready(s,'marketing');s.month++;assert.throws(()=>E.resolve(s,a,20,user,config));});
console.log(JSON.stringify({passed:results.length,catalog:Object.keys(E.TASKS).length},null,2));
