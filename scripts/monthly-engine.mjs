// Monthly task planner. Pure rules, all external authority checked by task-planner.mjs.
export const PLANNER_VERSION=1;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
export const APPROACHES={rush:{label:"Rush",factor:.5,bonus:-2},standard:{label:"Standard",factor:1,bonus:0},thorough:{label:"Thorough",factor:1.5,bonus:2}};
export const FUNDING={lean:{label:"Minimum",factor:.5,bonus:-1},standard:{label:"Standard",factor:1,bonus:0},enhanced:{label:"Enhanced",factor:1.5,bonus:1}};
export const TASKS=Object.fromEntries([
 ["marketing","Marketing campaign","commerce",2,20,"none","Earn level × 25 income; a critical doubles it.","marketing"],
 ["morale","Rally the crew","people",1,10,"none","Crew morale +5, or +10 on a critical.","morale"],
 ["repair","Repair and maintain","production",3,25,"internal","Resolve one internal threat.","repair"],
 ["counter","Counter rivals and spies","security",3,25,"external","Resolve one external threat.","counter"],
 ["escort","Escort a caravan","trade",3,15,"route","Selected route gets +3 at the next month close.","escort"],
 ["work","Work a contract","contracts",3,15,"contract","Add 1 contract progress, or 2 on a critical.","work"],
 ["shadow","Shadow a rival","intrigue",3,20,"rival","Gain 15 intel, or 30 on a critical.","shadow"],
 ["foil","Foil a rival plan","security",4,30,"rival","Requires a known plan and intel 40; blocks that plan.","foil"],
 ["court","Court a rival board","diplomacy",3,30,"rival","Prepare the existing +3 takeover/merger advantage.","court"],
 ["integrate","Integrate a division","management",4,25,"division","Add 20 integration, or 40 on a critical.","integrate"],
 ["venture","Run a local venture","commerce",3,20,"branch","Earn branch tier × 50; a setback loses tier × 10 income.","venture"],
 ["supply","Negotiate supply agreement","commerce",3,20,"none","Book savings against this month's wages; prepare one production roll.","supply"],
 ["audit","Audit the books","management",3,10,"none","Recover level × 30 income and prepare one management roll.","audit"],
 ["prototype","Develop a prototype","production",5,40,"none","Unlock a product launch for this PC for the current and following month.","prototype"],
 ["launch","Launch a tested product","production",5,60,"none","Needs a prototype. Earn level × 120 income; a setback loses level × 30.","launch","prototype"],
 ["premium","Find a premium client","contracts",4,35,"none","Prepare a premium opportunity for this PC.","premium"],
 ["premiumOrder","Secure a premium order","contracts",5,50,"none","Needs a premium lead. Earn level × 100 income and +2 reputation.","premiumOrder","premiumLead"],
 ["exhibition","Organize a public exhibition","diplomacy",4,45,"none","Reputation +5 and level × 35 income; a setback costs 2 reputation.","exhibition"],
 ["training","Train a worker","people",4,25,"staff","Selected worker gains 10 morale; prepare a production task.","training"],
 ["conditions","Improve working conditions","people",3,30,"none","Crew morale +6; prepare one people task.","conditions"],
 ["recruit","Recruit a specialist","people",4,25,"none","Unlock a hiring lead, redeemable for a trained worker record.","recruit"],
 ["hireLead","Hire from specialist lead","people",2,50,"none","Needs a hiring lead. Add a worker with craft specialty, wage 60, morale 70.","hireLead","hiringLead"],
 ["survey","Survey a new market","trade",4,25,"none","Selected PC gets two prepared trade/commerce rolls.","survey"],
 ["passage","Negotiate safe passage","trade",3,30,"route","Selected route gets +2 escort bonus this month and prepares one trade task.","passage"],
 ["reserve","Organize contingency supplies","management",3,35,"none","Prepare two production/management rolls.","reserve"],
 ["counterintel","Run counter-intelligence","security",4,25,"rival","Intel +20 and heat −5; a complication alerts the rival.","counterintel"],
 ["contact","Cultivate a guild contact","diplomacy",3,35,"none","Prepare two diplomacy/contracts rolls.","contact"],
 ["investigate","Investigate an acquisition","intrigue",4,30,"rival","Intel +25; a complication raises aggression.","investigate"],
 ["standardize","Standardize a division","management",5,40,"division","Integration +25; a setback lowers crew morale by 2.","standardize"],
 ["expansion","Prepare branch expansion","management",5,40,"branch","Branch growth +3 and morale +3.","expansion"],
 ["debts","Recover outstanding debts","commerce",3,15,"none","Earn level × 60 income; a complication costs reputation.","debts"],
 ["speculate","Take a speculative order","commerce",4,50,"none","Earn level × 100 income; a setback loses level × 25 income.","speculate"],
 ["recover","Rest and reorganize","recovery",2,0,"none","Remove this PC's planner fatigue. Does not refill sheet pools.","recover"]
].map(([id,label,category,days,coins,target,desc,effect,requires])=>[id,{id,label,category,days,coins,target,desc,effect,requires}]));
export const COST_KEYS=["company","personal","might","speed","intellect"];
export const CLOSED=new Set(["resolved","cancelled","declined"]);
export function ensure(s){
 s.planning??={};const p=s.planning;p.version=PLANNER_VERSION;p.revision=Math.max(0,Math.floor(num(p.revision)));p.assignments=Array.isArray(p.assignments)?p.assignments:[];p.effects=Array.isArray(p.effects)?p.effects:[];p.weekly=Array.isArray(p.weekly)?p.weekly:[];p.receipts=Array.isArray(p.receipts)?p.receipts:[];p.audit=Array.isArray(p.audit)?p.audit:[];p.seq=Math.max(0,Math.floor(num(p.seq)));return p;
}
const id=s=>`plan${++ensure(s).seq}`;
export function log(s,text){const p=ensure(s);p.audit.push({month:s.month,text});p.audit=p.audit.slice(-300);}
export function tick(s){ensure(s).revision++;}
export function effective(s,uuid,category){return ensure(s).effects.filter(e=>e.uuid===uuid&&e.uses>0&&e.expiresAfter>=s.month&&(!category||e.categories.includes(category)||e.categories.includes("*")));}
export function hasLead(s,uuid,key){return effective(s,uuid).some(e=>e.key===key);}
export function addEffect(s,a,key,label,categories,bonus,uses=1){const p=ensure(s);p.effects.push({id:id(s),uuid:a.pcUuid,key,label,categories,bonus,uses,expiresAfter:s.month+1,source:a.id});}
export function daysUsed(s,uuid,ignore){const p=ensure(s);return p.assignments.filter(a=>a.id!==ignore&&a.pcUuid===uuid&&a.month===s.month&&["accepted","resolved"].includes(a.status)).reduce((n,a)=>n+a.days,0)+p.weekly.filter(w=>w.month===s.month&&w.uuid===uuid).reduce((n,w)=>n+w.days,0);}
export function companyReserved(s,ignore){return ensure(s).assignments.filter(a=>a.id!==ignore&&a.month===s.month&&["accepted","resolved"].includes(a.status)).reduce((n,a)=>n+a.cost.company,0);}
export function quote(s,request,config={}){
 const d=TASKS[request.task];if(!d)throw Error("Unknown task.");
 if(!APPROACHES[request.approach??"standard"]||!FUNDING[request.funding??"standard"])throw Error("Unknown approach or funding level.");
 const approach=request.approach??"standard",funding=request.funding??"standard",days=Math.ceil(d.days*APPROACHES[approach].factor);
 const raw=request.cost??{},cost=Object.fromEntries(COST_KEYS.map(k=>[k,num(raw[k])]));
 for(const k of COST_KEYS)if(!Number.isInteger(cost[k])||cost[k]<0||cost[k]>1000000)throw Error("Costs must be non-negative whole numbers.");
 const base=Math.ceil(d.coins*Math.max(1,s.level)*FUNDING[funding].factor);
 if(base>0&&COST_KEYS.every(k=>cost[k]===0))throw Error("This task requires a resource commitment. Default is company coins; alternative funding requires GM approval.");
 if(cost.might>10||cost.speed>10||cost.intellect>10)throw Error("A pool commitment cannot exceed 10 points per pool.");
 const role=(s.pcs??[]).find(p=>p.uuid===request.pcUuid)?.role;
 const domains={foreman:["production","people"],broker:["trade","commerce"],warden:["security","people"],spymaster:["intrigue"],envoy:["diplomacy","contracts"]};
 const roleBonus=domains[role]?.includes(d.category)?1:0;
 const investment=cost.company>=base+25*Math.max(1,s.level)&&base>0?1:0;
 const personalBonus=cost.personal>=25?1:0;
 const poolBonus=Math.min(2,Math.floor((cost.might+cost.speed+cost.intellect)/2));
 const effects=effective(s,request.pcUuid,d.category).filter(e=>e.bonus!==0);
 const effectBonus=effects.reduce((n,e)=>n+e.bonus,0);
 const prep=clamp(APPROACHES[approach].bonus+FUNDING[funding].bonus+investment+personalBonus+poolBonus,-3,3);
 let tn=Math.min(18,3*(Math.ceil(s.level/2)+1));
 if(["internal","external"].includes(d.target)){const t=s.events.find(t=>t.id===request.targetId);if(t)tn=Math.max(3,t.level*3);}
 if(d.target==="route"){const t=s.routes.find(t=>t.id===request.targetId);if(t)tn=clamp(6+Math.round((t.legs??1)*1.5),6,18);}
 if(d.target==="contract"){const t=s.contracts.find(t=>t.id===request.targetId);if(t)tn=Math.min(19,4+2*t.level);}
 if(d.target==="branch"){const t=s.branches.find(t=>t.id===request.targetId);if(t)tn=Math.min(18,6+2*t.tier);}
 if(Number.isFinite(config.targetNumbers?.[`${d.target}:${request.targetId}`]))tn=config.targetNumbers[`${d.target}:${request.targetId}`];
 return {days,cost,base,alternativeFunding:cost.company<base,approach,funding,tn,bonus:clamp(prep+roleBonus+effectBonus,-6,6),roleBonus,prep,effectBonus,effects:effects.map(e=>e.id),dayBudget:Math.max(1,num(config.days,20))};
}
export function validateTarget(s,request){
 const d=TASKS[request.task],map={staff:"staff",route:"routes",contract:"contracts",rival:"rivals",division:"divisions",branch:"branches",internal:"events",external:"events"};
 if(d.target==="none")return null;
 const target=(s[map[d.target]]??[]).find(t=>t.id===request.targetId);if(!target)throw Error("Select an existing target of the required type.");
 if(["internal","external"].includes(d.target)&&target.kind!==d.target)throw Error("Incorrect threat type.");
 if(d.target==="contract"&&target.status!=="active")throw Error("The contract is not active.");
 if(d.id==="foil"&&(!(target.intel>=40)||!target.plan||target.plan.blocked))throw Error("Foiling needs intel 40 and an unblocked known plan.");return target;
}
export function eligibility(s,a,config={}){
 if(a.month!==s.month)throw Error("This assignment belongs to a different month.");
 if(!(s.pcs??[]).some(p=>p.uuid===a.pcUuid))throw Error("The assigned PC is no longer on the duty board.");
 const d=TASKS[a.task];if(!d)throw Error("Unknown task.");validateTarget(s,a);
 if(d.requires&&!hasLead(s,a.pcUuid,d.requires))throw Error("This PC does not have the required unexpired opportunity.");
 if(daysUsed(s,a.pcUuid,a.id)+a.days>Math.max(1,num(config.days,20)))throw Error("Not enough PC time remains this month.");
 if(companyReserved(s,a.id)+a.cost.company>Math.max(0,num(s.cash)))throw Error("Not enough unreserved company funds.");
}
export function create(s,request,principal,config={}){
 ensure(s);if(!(s.pcs??[]).some(p=>p.uuid===request.pcUuid))throw Error("Choose a PC from the duty board.");
 
 const q=quote(s,request,config),a={id:id(s),month:s.month,task:request.task,pcUuid:request.pcUuid,pcName:String(request.pcName??"PC").slice(0,100),targetId:request.targetId??"",createdBy:principal.id,status:"proposed",...q,payment:null,notes:String(request.notes??"").slice(0,1000)};
 eligibility(s,a,config);ensure(s).assignments.push(a);log(s,`${principal.name} proposed ${TASKS[a.task].label} for ${a.pcName}.`);tick(s);return a;
}
export function accept(s,a,principal,config={}){if(a.status!=="proposed")throw Error("Only proposed assignments can be accepted.");eligibility(s,a,config);if(a.alternativeFunding&&!a.fundingApprovedBy)throw Error("The GM must approve alternative funding before acceptance.");a.status="accepted";a.acceptedBy=principal.id;a.override=!!principal.override;log(s,`${principal.name} ${a.override?"GM override: ":""}accepted ${a.id}; ${a.days} days and ${a.cost.company} company coins reserved.`);tick(s);return a;}
export function cancel(s,a,principal,decline=false){if(CLOSED.has(a.status))throw Error("This assignment is already closed.");a.status=decline?"declined":"cancelled";log(s,`${principal.name} ${a.status} ${a.id}; reservations released.`);tick(s);}
export function paid(s,a,principal){if(a.status!=="accepted")throw Error("Accept the assignment before confirming payment.");if(principal.isGM&&!principal.override)throw Error("GM payment confirmation must be an explicit override.");a.payment={by:principal.id,manual:true,override:!!principal.override};log(s,`${principal.name} recorded manual personal/pool payment for ${a.id}${principal.override?" (GM override)":""}.`);tick(s);}
export function needsPayment(a){return a.cost.personal+a.cost.might+a.cost.speed+a.cost.intellect>0;}
export function resolve(s,a,nat,principal,config={}){
 if(a.status!=="accepted")throw Error("Only accepted assignments can be resolved.");eligibility(s,a,config);if(a.alternativeFunding&&!a.fundingApprovedBy)throw Error("Alternative funding has not been approved.");
 if(needsPayment(a)&&!a.payment)throw Error("PC owner must confirm manual payment of personal currency and pool costs first.");
 if(!Number.isInteger(nat)||nat<1||nat>20)throw Error("Invalid d20 roll.");
 const d=TASKS[a.task],q=quote(s,a,config),target=validateTarget(s,a),big=nat===20,success=big||(nat>1&&nat+q.bonus>=q.tn),complication=nat===1||(!success&&a.approach==="rush");
 let income=0,mor=0,text="",mult=big?2:1;const lvl=Math.max(1,s.level),p=ensure(s);
 // Consume one use of the modifiers actually used by this roll, only after validation.
 for(const e of p.effects)if(q.effects.includes(e.id))e.uses=Math.max(0,e.uses-1);
 const buff=(key,label,cats,uses=1)=>addEffect(s,a,key,label,cats,1,uses);
 if(success)switch(d.effect){
  case "marketing":income=lvl*25*mult;text=`Campaign income +${income}.`;break;
  case "morale":mor=5*mult;text=`Crew morale +${mor} at month close.`;break;
  case "repair":case "counter":s.events=s.events.filter(e=>e.id!==target.id);s.stats[d.effect==="repair"?"resolvedInternal":"resolvedExternal"]++;text=`${target.title} resolved.`;break;
  case "escort":target.escort=num(target.escort)+3*mult;text=`${target.name}: escort +${3*mult} this month.`;break;
  case "work":target.progress=Math.min(target.required,target.progress+mult);text=`${target.title}: progress ${target.progress}/${target.required}.`;break;
  case "shadow":target.intel=clamp(target.intel+15*mult,0,100);text=`Intel now ${target.intel}.`;break;
  case "foil":target.plan.blocked=true;text="Rival plan foiled.";break;
  case "court":target.courted=2;text="Board courted: existing deal bonus prepared.";break;
  case "integrate":target.integration=clamp(target.integration+20*mult,0,100);text=`Integration now ${target.integration}%.`;break;
  case "venture":income=target.tier*50*mult;text=`Local venture income +${income}.`;break;
  case "supply":income=Math.round(s.staff.reduce((n,w)=>n+num(w.wage),0)*.10*mult);buff("supplier","Supplier agreement",["production"]);text=`Savings +${income}; one prepared production roll.`;break;
  case "audit":income=lvl*30*mult;buff("audit","Clean books",["management"]);text=`Recovered income +${income}; management prepared.`;break;
  case "prototype":addEffect(s,a,"prototype","Tested prototype",[],0,1);text="Product launch unlocked for this PC.";break;
  case "launch":income=lvl*120*mult;text=`Product launch income +${income}.`;break;
  case "premium":addEffect(s,a,"premiumLead","Premium-client lead",[],0,1);text="Premium-order opportunity unlocked for this PC.";break;
  case "premiumOrder":income=lvl*100*mult;s.reputation=clamp(s.reputation+2*mult,0,100);text=`Premium order +${income}, reputation +${2*mult}.`;break;
  case "exhibition":income=lvl*35*mult;s.reputation=clamp(s.reputation+5*mult,0,100);text=`Exhibition +${income}, reputation +${5*mult}.`;break;
  case "training":target.happiness=clamp(target.happiness+10*mult,0,100);buff("training","Workforce training",["production"]);text="Worker morale improved; production prepared.";break;
  case "conditions":mor=6*mult;buff("conditions","Staff confidence",["people"]);text=`Crew morale +${mor} at month close; people task prepared.`;break;
  case "recruit":addEffect(s,a,"hiringLead","Specialist lead",[],0,1);text="Specialist hiring opportunity unlocked.";break;
  case "hireLead":s.staff.push({id:id(s),uuid:"",name:"Recruited specialist",img:"icons/svg/mystery-man.svg",role:"Specialist",spec:"craft",wage:60,happiness:70});text="Craft specialist hired; wage 60, morale 70.";break;
  case "survey":buff("survey","Market survey",["trade","commerce"],2);text="Two prepared trade/commerce rolls.";break;
  case "passage":target.escort=num(target.escort)+2*mult;addEffect(s,a,"passage","Safe passage",["trade"],1,1);text=`Route escort +${2*mult}; one prepared trade roll.`;break;
  case "reserve":buff("contingency","Contingency supplies",["production","management"],2);text="Two prepared production/management rolls.";break;
  case "counterintel":target.intel=clamp(target.intel+20*mult,0,100);s.heat=clamp(s.heat-5*mult,0,100);text=`Intel ${target.intel}, heat ${s.heat}.`;break;
  case "contact":buff("contact","Guild introduction",["diplomacy","contracts"],2);text="Two prepared diplomacy/contracts rolls.";break;
  case "investigate":target.intel=clamp(target.intel+25*mult,0,100);text=`Acquisition intel now ${target.intel}.`;break;
  case "standardize":target.integration=clamp(target.integration+25*mult,0,100);text=`Division integration ${target.integration}%.`;break;
  case "expansion":target.growth+=3*mult;target.morale=clamp(target.morale+3*mult,0,100);text=`Branch growth +${3*mult}, morale +${3*mult}.`;break;
  case "debts":income=lvl*60*mult;text=`Debts recovered +${income}.`;break;
  case "speculate":income=lvl*100*mult;text=`Speculative order +${income}.`;break;
  case "recover":for(const e of p.effects)if(e.uuid===a.pcUuid&&e.key==="fatigue")e.uses=0;text="Planner fatigue removed; no sheet-pool recovery applied.";break;
 }
 if(!success){text="Setback: time and committed resources are consumed.";if(d.effect==="venture")income=-target.tier*10;if(d.effect==="speculate")income=-lvl*25;if(d.effect==="launch")income=-lvl*30;if(d.effect==="exhibition")s.reputation=clamp(s.reputation-2,0,100);if(d.effect==="standardize")mor=-2;}
 if(d.requires){const lead=p.effects.find(e=>e.uuid===a.pcUuid&&e.key===d.requires&&e.uses>0&&e.expiresAfter>=s.month);if(lead)lead.uses--;}
 if(complication){s.heat=clamp(s.heat+2,0,100);addEffect(s,a,"fatigue","Overextended",["*"],-1,1);text+=" Complication: heat +2 and −1 on the next planner roll.";if(["investigate","counterintel"].includes(d.effect))target.aggression=clamp(target.aggression+1,0,3);if(d.effect==="debts")s.reputation=clamp(s.reputation-2,0,100);}
 if(big)s.stats.nat20++;
 // Company costs are earmarked now and settle ONCE through the existing month-close task income.
 const record={id:a.id,userId:a.createdBy,userName:principal.name,who:a.pcName,task:a.task,label:d.label,total:nat+q.bonus,nat,tn:q.tn,income:income-a.cost.company,mor,success,text,planner:true,plannerGross:income,plannerExpense:a.cost.company};
 s.tasks.push(record);a.status="resolved";a.result={nat,bonus:q.bonus,tn:q.tn,total:nat+q.bonus,success,complication,income,expense:a.cost.company,net:income-a.cost.company,text};
 p.receipts.push({id:a.id,month:s.month,pcUuid:a.pcUuid,days:a.days,cost:{...a.cost},income,net:income-a.cost.company});
 log(s,`${principal.name} resolved ${a.id}: ${success?"success":"setback"}, ${a.days} days, company ${a.cost.company}, net ${income-a.cost.company}.`);tick(s);return record;
}
export function weeklyReserve(s,pcs,days,budget){const p=ensure(s);if(p.weekly.some(w=>w.month===s.month&&w.week===s.week))throw Error("This week is already being processed.");for(const pc of pcs)if(daysUsed(s,pc.uuid)+days>budget)throw Error(`${pc.name} has insufficient time for weekly duty.`);for(const pc of pcs)p.weekly.push({uuid:pc.uuid,name:pc.name,month:s.month,week:s.week,days,status:"reserved"});tick(s);}
export function weeklyFinish(s,month,week,success){const p=ensure(s);p.weekly=p.weekly.filter(w=>!(w.month===month&&w.week===week&&!success));for(const w of p.weekly)if(w.month===month&&w.week===week)w.status="spent";tick(s);}
export function monthSummary(s,month){const p=ensure(s),r=p.receipts.filter(r=>r.month===month);return {month,count:r.length,days:r.reduce((n,r)=>n+r.days,0),gross:r.reduce((n,r)=>n+r.income,0),expense:r.reduce((n,r)=>n+r.cost.company,0),net:r.reduce((n,r)=>n+r.net,0)};}
