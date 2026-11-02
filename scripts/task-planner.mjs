import { LedgerApp } from "./app.mjs";
import { MID, getState, saveState, routeCalc, threatTN } from "./data.mjs";
import * as E from "./monthly-engine.mjs";
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const config=()=>({days:game.settings.get(MID,"plannerDays"),weeklyDays:game.settings.get(MID,"plannerWeeklyDays")});
let queue=Promise.resolve();
const serial=fn=>{const p=queue.then(fn);queue=p.catch(e=>console.error(`${MID} | planner`,e));return p;};
const isActiveGM=()=>game.user.isGM&&game.user.id===game.users.activeGM?.id;
const requestKey="monthlyPlannerCommand";
const draftByApp=new WeakMap();
const renderEpoch=new WeakMap();
const actorOf=async uuid=>{const a=await fromUuid(uuid);if(!a||a.documentName!=="Actor")throw Error("Assigned Actor is missing.");return a;};
const owns=(a,u)=>u?.isGM||!!a.testUserPermission(u,"OWNER");
const cfg=()=>{
 const c=config(),s=getState(),targetNumbers={};
 for(const r of s.routes??[])targetNumbers[`route:${r.id}`]=routeCalc(r,s).tn;
 for(const e of s.events??[])targetNumbers[`${e.kind}:${e.id}`]=threatTN(e,s);
 return {...c,targetNumbers};
};
async function fresh(){const s=getState();E.ensure(s);return s;}
async function command(op,payload={}){
 if(!game.users.activeGM)return ui.notifications.warn("A GM must be online to process assignments.");
 const s=await fresh();
 const c={op,payload,revision:s.planning.revision,month:s.month};
 if(isActiveGM())return serial(()=>process(c,game.user,foundry.utils.randomID()));
 await ChatMessage.create({content:`<p>Monthly planner request: ${escape(op)}</p>`,whisper:[game.users.activeGM.id],flags:{[MID]:{[requestKey]:c}}});
 ui.notifications.info("Request sent to the active GM.");
}
async function process(c,user,requestId){
 if(!isActiveGM())return;
 try{
  const s=await fresh(),p=E.ensure(s);
  if(p.audit.some(x=>x.requestId===requestId))return;
  if(c.month!==s.month||c.revision!==p.revision)throw Error("The ledger changed. Review the current costs and submit again.");
  const principal={id:user.id,name:user.name,isGM:user.isGM,override:false};
  const payload=c.payload??{};
  let a;
  if(c.op==="create"){
   const actor=await actorOf(payload.pcUuid);
   if(!(actor.type==="pc"||actor.hasPlayerOwner))throw Error("Delegate to a player character, not an unowned NPC.");
   // A proposal may be sent to another PC; it reserves nothing until its owner accepts.
   if(E.TASKS[payload.task]?.target==="branch"&&!user.isGM){
    const b=s.branches.find(b=>b.id===payload.targetId);if(!b||b.userId!==user.id)throw Error("Only the branch owner or GM can propose a task for that branch.");
   }
   a=E.create(s,{...payload,pcName:actor.name},principal,cfg());
  }else{
   a=p.assignments.find(x=>x.id===payload.id);if(!a)throw Error("Assignment no longer exists.");
   let actor=null;try{actor=await actorOf(a.pcUuid);}catch(e){if(!user.isGM&&a.createdBy!==user.id)throw e;}
   const owner=user.isGM||!!actor&&owns(actor,user);
   if(c.op==="accept"){
    if(!owner)throw Error("Only this PC's owner or the GM can accept.");
    principal.override=user.isGM&&!!payload.override;
    if(user.isGM&&!principal.override)throw Error("Use the explicit GM override button.");
    E.accept(s,a,principal,cfg());
   }else if(c.op==="approveFunding"){
    if(!user.isGM)throw Error("Only a GM can approve alternative funding.");
    if(a.status!=="proposed")throw Error("Funding can only be approved before acceptance.");
    a.fundingApprovedBy=user.id;E.log(s,`${user.name} approved the stated alternative resource combination for ${a.id}; no currency conversion applied.`);E.tick(s);
   }else if(c.op==="cancel"||c.op==="decline"){
    if(!owner&&a.createdBy!==user.id)throw Error("Only the proposer, PC owner, or GM can cancel.");
    if(c.op==="decline"&&!owner)throw Error("Only the PC owner can decline.");
    if(a.payment)throw Error("Payment was already recorded; the GM must settle any manual refund outside the planner before cancellation.");
    E.cancel(s,a,principal,c.op==="decline");
   }else if(c.op==="paid"){
    if(!owner)throw Error("Only the PC owner or GM can record personal payment.");
    principal.override=user.isGM&&!!payload.override;
    E.paid(s,a,principal);
   }else if(c.op==="refund"){
    if(!owner)throw Error("Only the PC owner or GM can acknowledge a manual refund.");
    if(a.status!=="accepted"||!a.payment)throw Error("No recorded payment to refund.");
    if(user.isGM&&!payload.override)throw Error("Use an explicit GM override.");
    a.payment=null;a.refundBy=user.id;E.log(s,`${user.name} confirmed personal/pool costs refunded manually for ${a.id}${user.isGM?" (GM override)":""}.`);E.tick(s);
   }else if(c.op==="resolve"){
    if(!owner)throw Error("Only the PC owner or GM can resolve this assignment.");
    // Validation before rolling, then authoritative GM-generated randomness.
    if(a.status!=="accepted")throw Error("Accept the assignment first.");
    E.eligibility(s,a,cfg());
    if(E.needsPayment(a)&&!a.payment)throw Error("Confirm personal/pool payment before rolling.");
    const nat=(await new Roll("1d20").evaluate()).total;
    const record=E.resolve(s,a,nat,principal,cfg());
    E.log(s,"Processed resolve.");p.audit.at(-1).requestId=requestId;
    await LedgerApp.commit(s);
    // A separate receipt acknowledges this command before any retry can spend again.
    await ChatMessage.create({content:`<div class="cel-chat ${record.success?"win":"loss"}"><h3>${escape(a.pcName)} · ${escape(record.label)}</h3><p>d20 ${nat} + ${a.result.bonus} = ${record.total} vs ${record.tn}</p><p>${escape(record.text)}</p><p>Time ${a.days} days · company ${a.cost.company} · gross ${a.result.income} · net ${a.result.net}</p><p>Company cost and income settle once at month close. Personal/pool payment is manually recorded, not deducted by this module.</p></div>`});
    return;
   }else throw Error("Unknown planner command.");
  }
  E.log(s,`Processed ${c.op}.`);p.audit.at(-1).requestId=requestId;
  await saveState(s);
  if(user.id!==game.user.id)await ChatMessage.create({content:`<p>Monthly planner: ${escape(c.op)} completed.</p>`,whisper:[user.id]});
 }catch(e){
  ui.notifications.warn(e.message);
  if(user.id!==game.user.id)await ChatMessage.create({content:`<p>Planner request refused: ${escape(e.message)}</p>`,whisper:[user.id]});
 }
}
function options(choices,selected){return choices.map(([k,v])=>`<option value="${escape(k)}" ${k===selected?"selected":""}>${escape(v)}</option>`).join("");}
function targetOptions(s,task){const d=E.TASKS[task];let list=[];switch(d.target){case"staff":list=s.staff;break;case"route":list=s.routes;break;case"contract":list=s.contracts.filter(x=>x.status==="active");break;case"rival":list=s.rivals;break;case"division":list=s.divisions;break;case"branch":list=s.branches;break;case"internal":case"external":list=s.events.filter(e=>e.kind===d.target);break;}return [["","— select target if needed —"],...list.map(x=>[x.id,x.name??x.title])];}
const button=(op,id,label,extra="")=>`<button type="button" data-plan-op="${op}" data-plan-id="${escape(id)}" ${extra}>${escape(label)}</button>`;
function costText(cost){return E.COST_KEYS.filter(k=>cost[k]>0).map(k=>`${k}: ${cost[k]}`).join(" · ")||"No resource cost";}
async function mount(app){
 if(app.tab!=="tasks"||!app.element)return;
 const epoch=(renderEpoch.get(app)??0)+1;renderEpoch.set(app,epoch);
 const body=app.element.querySelector(".cel-body");if(!body)return;
 const s=await fresh();if(app.tab!=="tasks"||!app.element.contains(body))return;
 const p=s.planning,user=game.user,actors=new Map();
 for(const pc of s.pcs??[]){try{actors.set(pc.uuid,await actorOf(pc.uuid));}catch{}}
 const pcs=[...new Map((s.pcs??[]).filter(x=>actors.has(x.uuid)).map(x=>[x.uuid,x])).values()];
 let d=draftByApp.get(app)??{task:"marketing",pcUuid:pcs.find(x=>owns(actors.get(x.uuid),user))?.uuid??pcs[0]?.uuid??"",approach:"standard",funding:"standard",targetId:"",notes:""};
 if(!E.TASKS[d.task])d.task="marketing";
 const qDefault=Math.ceil(E.TASKS[d.task].coins*Math.max(1,s.level)*E.FUNDING[d.funding].factor);
 d.cost??={company:qDefault,personal:0,might:0,speed:0,intellect:0};draftByApp.set(app,d);
 let preview="";try{const q=E.quote(s,d,cfg());preview=`${q.days} days · TN ${q.tn} · modifier ${q.bonus>=0?"+":""}${q.bonus} (preparation ${q.prep}, role ${q.roleBonus}, effects ${q.effectBonus})${q.alternativeFunding?" · ALTERNATIVE FUNDING: GM approval required":""}`;}catch(e){preview=e.message;}
 const assigned=pcs.map(pc=>{const used=E.daysUsed(s,pc.uuid);return `<div class="plan-budget"><img src="${escape(actors.get(pc.uuid).img)}" alt=""><div><b>${escape(pc.name)}</b><small>${used} / ${cfg().days} days allocated · ${Math.max(0,cfg().days-used)} remaining</small></div></div>`;}).join("");
 const cards=p.assignments.filter(a=>a.month===s.month).slice().reverse().map(a=>{
  const actor=actors.get(a.pcUuid),owner=!!actor&&owns(actor,user),canCancel=owner||a.createdBy===user.id,def=E.TASKS[a.task];
  let actions="";
  if(a.status==="proposed"){
   if(user.isGM&&a.alternativeFunding&&!a.fundingApprovedBy)actions+=button("approveFunding",a.id,"Approve alternative funding");
   if(owner)actions+=button("accept",a.id,user.isGM?"GM override: accept":"Accept",user.isGM?'data-override="1"':'');
   if(owner)actions+=button("decline",a.id,"Decline");
  }
  if(a.status==="accepted"&&owner){
   if(a.payment)actions+=button("refund",a.id,user.isGM?"GM override: refund recorded":"Confirm manual refund",user.isGM?'data-override="1"':'');
   if(E.needsPayment(a)&&!a.payment)actions+=button("paid",a.id,user.isGM?"GM override: payment recorded":"Confirm manual personal/pool payment",user.isGM?'data-override="1"':'');
   actions+=button("resolve",a.id,"Resolve · GM rolls d20");
  }
  if(!E.CLOSED.has(a.status)&&canCancel&&!a.payment)actions+=button("cancel",a.id,"Cancel & release reservations");
  const result=a.result?`<p>${a.result.success?"SUCCESS":"SETBACK"} · d20 ${a.result.nat} + ${a.result.bonus} vs ${a.result.tn}</p><p>${escape(a.result.text)}</p><p>Gross ${a.result.income} · expense ${a.result.expense} · net ${a.result.net}</p>`:"";
  return `<article class="plan-assignment"><div class="plan-top"><h4>${escape(def?.label??a.task)}</h4><span class="badge">${escape(a.status)}</span></div><p><b>${escape(a.pcName)}</b> · ${a.days} days · ${escape(a.approach)} / ${escape(a.funding)}</p><p>${escape(costText(a.cost))}</p>${a.alternativeFunding?`<p>${a.fundingApprovedBy?"Alternative funding approved":"Awaiting GM funding approval"}</p>`:""}${a.notes?`<p>${escape(a.notes)}</p>`:""}${a.payment?"<p>Manual personal/pool payment recorded.</p>":""}${result}<div class="cel-toolbar">${actions}</div></article>`;
 }).join("")||"<p>No assignments proposed this month.</p>";
 const effects=E.effective(s,d.pcUuid).map(e=>`<span class="badge">${escape(e.label)} · ${e.bonus>=0?"+":""}${e.bonus} · ${e.uses} use(s) · through M${e.expiresAfter}</span>`).join("")||"No active planner effects for this PC.";
 if(renderEpoch.get(app)!==epoch||app.tab!=="tasks"||!app.element.contains(body))return;
 body.innerHTML=`<section class="cel-plan"><div class="page-heading"><div><p class="eyebrow">MONTH ${s.month} · ${Object.keys(E.TASKS).length} TASKS</p><h2>Monthly task planner</h2></div><span class="badge">Company available ${Math.max(0,s.cash-E.companyReserved(s))}</span></div><p>Propose → PC owner accepts → confirm personal payment if selected → resolve. Company expenses and task income settle once at month close. Time is tracked per PC.</p><div class="plan-budgets">${assigned}</div><article class="cel-panel"><h3>Plan or delegate a task</h3><div class="plan-form"><label>Task<select data-plan-field="task">${options(Object.entries(E.TASKS).map(([k,v])=>[k,`${v.label} · ${v.category}`]),d.task)}</select></label><label>Delegate to PC<select data-plan-field="pcUuid">${options(pcs.map(pc=>[pc.uuid,`${pc.name}${owns(actors.get(pc.uuid),user)?" (yours)":" (acceptance required)"}`]),d.pcUuid)}</select></label><label>Target<select data-plan-field="targetId">${options(targetOptions(s,d.task),d.targetId)}</select></label><label>Time approach<select data-plan-field="approach">${options(Object.entries(E.APPROACHES).map(([k,v])=>[k,v.label]),d.approach)}</select></label><label>Funding approach<select data-plan-field="funding">${options(Object.entries(E.FUNDING).map(([k,v])=>[k,v.label]),d.funding)}</select></label>${E.COST_KEYS.map(k=>`<label>${escape(k==='company'?'Company ledger coins':k==='personal'?'PC personal currency (manual)':`${k} pool (manual)`)}<input type="number" min="0" step="1" ${["might","speed","intellect"].includes(k)?'max="10"':''} data-plan-cost="${k}" value="${d.cost[k]??0}"></label>`).join("")}</div><p>${escape(E.TASKS[d.task].desc)}</p><div class="plan-preview">${escape(preview)}</div><p class="plan-note">Set any resource to 0 to exclude it. Default funding is company coins. Personal currency and pool costs never auto-deduct from sheets. Replacing required company funding with other resources needs GM approval; there is no automatic exchange rate.</p><label>Notes / personal currency denomination<textarea data-plan-field="notes" maxlength="1000">${escape(d.notes)}</textarea></label><div class="cel-toolbar"><button type="button" class="primary" data-plan-propose ${pcs.length?'':'disabled'}>Propose assignment</button></div><div class="token-row">${effects}</div></article><div class="plan-list">${cards}</div><details class="cel-panel"><summary>Task catalog and consequences</summary><div class="plan-catalog">${Object.values(E.TASKS).map(t=>`<div><b>${escape(t.label)}</b><p>${t.days} standard days · ${t.coins} × company rank standard company coins</p><small>${escape(t.desc)}</small></div>`).join("")}</div></details><details class="cel-panel"><summary>Audit trail</summary>${p.audit.filter(l=>l.month===s.month).slice(-30).reverse().map(l=>`<p>${escape(l.text)}</p>`).join("")}</details><p class="plan-note">Configurable budgets: ${cfg().days} days/PC/month; ${cfg().weeklyDays} days per active weekly duty. Waiting proposals reserve nothing. Accepted and resolved assignments count against capacity.</p></section>`;
 body.querySelectorAll('[data-plan-field],[data-plan-cost]').forEach(el=>el.addEventListener("change",()=>{
  const draft=draftByApp.get(app);if(el.dataset.planCost)draft.cost[el.dataset.planCost]=Number(el.value);else draft[el.dataset.planField]=el.value;
  if(["task","funding"].includes(el.dataset.planField)){draft.cost.company=Math.ceil(E.TASKS[draft.task].coins*Math.max(1,s.level)*E.FUNDING[draft.funding].factor);if(el.dataset.planField==="task")draft.targetId="";}
  draftByApp.set(app,draft);mount(app);
 }));
 body.querySelector('[data-plan-propose]')?.addEventListener("click",async ev=>{ev.currentTarget.disabled=true;try{await command("create",draftByApp.get(app));}catch(e){ui.notifications.error(e.message);}finally{mount(app);}});
 body.querySelectorAll('[data-plan-op]').forEach(b=>b.addEventListener("click",async()=>{
  const op=b.dataset.planOp;
  if(["paid","refund","resolve","approveFunding"].includes(op)){
   const text=op==="refund"?"Confirm that personal currency and pool points have been refunded manually. The module does not restore them on the actor sheet.":op==="paid"?"Confirm that the listed personal currency and pool points have already been paid manually. This module will not deduct them again.":op==="approveFunding"?"Approve this exact alternative resource combination without converting currencies?":"Resolve this assignment? Time and resources are consumed even on failure. Company funds settle at month close.";
   if(!await foundry.applications.api.DialogV2.confirm({window:{title:"Confirm planner action"},content:`<p>${text}</p>`}))return;
  }
  b.disabled=true;try{await command(op,{id:b.dataset.planId,override:b.dataset.override==="1"});}catch(e){ui.notifications.error(e.message);}finally{mount(app);}
 }));
}
Hooks.once("init",()=>{
 game.settings.register(MID,"plannerDays",{name:"Planner: days available per PC per month",hint:"Shared by monthly tasks and weekly duties.",scope:"world",config:true,type:Number,default:20,range:{min:1,max:60,step:1},onChange:()=>LedgerApp.instance?.render()});
 game.settings.register(MID,"plannerWeeklyDays",{name:"Planner: days per active weekly duty",scope:"world",config:true,type:Number,default:5,range:{min:1,max:10,step:1},onChange:()=>LedgerApp.instance?.render()});
 const baseRender=LedgerApp.prototype._onRender;
 LedgerApp.prototype._onRender=function(...args){const r=baseRender.apply(this,args);Promise.resolve(r).then(()=>mount(this)).catch(e=>console.error(`${MID} | planner render`,e));return r;};
 // Prevent the old per-user task form/socket from bypassing per-PC commitments.
 LedgerApp.onDoTask=async()=>{const a=LedgerApp.instance;if(a){a.tab="tasks";a.render();}};
 LedgerApp.applyTask=async()=>ui.notifications.warn("Monthly tasks now use the PC task planner.");
 LedgerApp.DEFAULT_OPTIONS.actions.celDoTask=LedgerApp.onDoTask;
 const baseWeek=LedgerApp.onResolveWeek,baseMonth=LedgerApp.onCloseMonth;
 LedgerApp.onResolveWeek=async function(){
  if(!isActiveGM())return ui.notifications.warn("The active GM must close the week.");
  return serial(async()=>{
   const s=await fresh(),active=[...new Map((s.pcs??[]).filter(pc=>pc.task&&pc.task!=="rest").map(pc=>[pc.uuid,pc])).values()];
   if(!active.length)return baseWeek.call(this);
   const month=s.month,week=s.week;
   try{E.weeklyReserve(s,active,cfg().weeklyDays,cfg().days);await saveState(s);await baseWeek.call(this);}
   catch(e){ui.notifications.warn(e.message);}
   finally{const current=await fresh();if(current.planning.weekly.some(w=>w.month===month&&w.week===week&&w.status==="reserved")){E.weeklyFinish(current,month,week,current.week>week);await saveState(current);}}
  });
 };
 LedgerApp.onCloseMonth=async function(){
  if(!isActiveGM())return ui.notifications.warn("The active GM must close the month.");
  return serial(async()=>{
   const s=await fresh(),month=s.month,p=s.planning;
   const unresolved=p.assignments.filter(a=>a.month===month&&["accepted","proposed"].includes(a.status));
   if(unresolved.length)return ui.notifications.warn(`Resolve, decline or cancel ${unresolved.length} monthly assignment(s) before closing the month.`);
   const summary=E.monthSummary(s,month);
   await baseMonth.call(this);
   const current=await fresh();if(current.month<=month)return;
   E.log(current,`Closed M${month}: ${summary.count} assignments, gross ${summary.gross}, company cost ${summary.expense}, net ${summary.net}; already included in monthly task income.`);E.tick(current);await saveState(current);
   if(summary.count)await ChatMessage.create({content:`<div class="cel-chat"><h3>Monthly planning · Month ${month}</h3><p>${summary.count} assignments · ${summary.days} PC-days · gross ${summary.gross} · company expenses ${summary.expense} · net ${summary.net}.</p><p>These amounts were already included once in the month-close task contribution. Personal currency and pool costs are recorded separately in assignment receipts.</p></div>`});
  });
 };
 LedgerApp.DEFAULT_OPTIONS.actions.celResolveWeek=LedgerApp.onResolveWeek;
 LedgerApp.DEFAULT_OPTIONS.actions.celCloseMonth=LedgerApp.onCloseMonth;
});
Hooks.on("createChatMessage",message=>{
 if(!isActiveGM())return;const c=message.flags?.[MID]?.[requestKey];if(!c)return;
 const user=message.author??message.user;if(!user?.id)return;
 serial(()=>process(c,user,message.id));
});
Hooks.once("ready",()=>{
 const mod=game.modules.get(MID);if(mod?.api)mod.api.planner={tasks:E.TASKS,open:()=>{LedgerApp.open();LedgerApp.instance.tab="tasks";LedgerApp.instance.render();},state:()=>E.ensure(getState())};
});
