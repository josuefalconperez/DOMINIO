const KEY="dominio-v5";
const euro=n=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=()=>new Date().toISOString().slice(0,10);
const month=()=>new Date().toISOString().slice(0,7);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
let db=JSON.parse(localStorage.getItem(KEY)||"null")||{accounts:[],movements:[],plans:[],goals:[],subs:[],assets:[],debts:[]};
function save(){localStorage.setItem(KEY,JSON.stringify(db));renderAll()}
function sum(a){return a.reduce((x,y)=>x+(Number(y)||0),0)}
function accountType(t){return {bank:"Banco",savings:"Ahorro",cash:"Efectivo",card:"Tarjeta",investment:"Inversión",custom:"Personalizada"}[t]||t}
function fmtDate(d){if(!d)return "";const [y,m,day]=d.split("-");return `${day}/${m}/${y}`}
function monthlyEquivalent(p){let v=Number(p.amount)||0; return p.frequency==="monthly"?v:p.frequency==="quarterly"?v/3:p.frequency==="semiannual"?v/6:p.frequency==="annual"?v/12:v}
function reserved(){return sum(db.plans.map(monthlyEquivalent))}
function balances(){return sum(db.accounts.filter(a=>a.includeGlobal).map(a=>Number(a.balance)||0))}
function available(){return sum(db.accounts.filter(a=>a.includeAvailable).map(a=>Number(a.balance)||0))-reserved()}
function wealth(){return sum(db.accounts.filter(a=>a.includePatrimony).map(a=>Number(a.balance)||0))+sum(db.assets.map(a=>Number(a.value)||0))-sum(db.debts.map(d=>Number(d.outstanding)||0))}
function monthMovs(){return db.movements.filter(m=>(m.date||"").slice(0,7)===month())}
function income(){return sum(monthMovs().filter(m=>m.kind==="income").map(m=>m.amount))}
function expense(){return sum(monthMovs().filter(m=>m.kind==="expense").map(m=>m.amount))}
function optionsAccounts(){return db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${accountType(a.type)}</option>`).join("")}
function empty(msg){return `<div class="empty">${msg}</div>`}

function nav(id){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 document.getElementById(id).classList.add("active");
 document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
 window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>nav(b.dataset.nav));
document.querySelectorAll("[data-back]").forEach(b=>b.onclick=()=>nav(b.dataset.back));

function renderHome(){
 const inc=income(), exp=expense(), sav=inc-exp;
 availableTotal.textContent=euro(available()); incomeTotal.textContent=euro(inc); expenseTotal.textContent=euro(exp); savingTotal.textContent=euro(sav); wealthTotal.textContent=euro(wealth());
 const pct=inc?Math.round(sav/inc*100):0;
 homeInsight.textContent=db.movements.length?`Este mes has ahorrado ${euro(sav)} (${pct} % de tus ingresos). Cada pequeño avance cuenta.`:"Empieza donde estés. DOMINIO crece contigo.";
 upcomingCount.textContent=db.plans.length; homeGoalCount.textContent=db.goals.length; homeSubCount.textContent=db.subs.length;
 homeUpcoming.innerHTML=db.plans.length?db.plans.slice(0,4).map(p=>`<div class="item row"><div><b>${esc(p.name)}</b><small>${p.frequency==="annual"?"Anual":p.frequency==="semiannual"?"Semestral":p.frequency==="quarterly"?"Trimestral":"Mensual"} · reserva ${euro(monthlyEquivalent(p))}/mes</small></div><span class="amount">${euro(p.amount)}</span></div>`).join(""):empty("No tienes previsiones. Añade un gasto futuro para empezar a prepararte.");
 homeGoals.innerHTML=db.goals.length?db.goals.slice(0,4).map(goalHtml).join(""):empty("No tienes objetivos todavía.");
 homeSubs.innerHTML=db.subs.length?db.subs.slice(0,4).map(subHtml).join(""):empty("No tienes suscripciones todavía.");
}
function goalHtml(g){
 const pct=Math.min(100,Math.max(0,Number(g.target)?Number(g.current||0)/Number(g.target)*100:0));
 return `<div class="item"><div class="row"><div><b>${esc(g.name)}</b><small>${euro(g.current||0)} de ${euro(g.target||0)}</small></div><span>${Math.round(pct)}%</span></div><div class="progress"><i style="width:${pct}%"></i></div><small>+ ${euro(g.monthly||0)}/mes · ${esc(g.status||"En progreso")}</small></div>`;
}
function subHtml(s){
 const annual=s.billing==="monthly"?Number(s.amount||0)*12:Number(s.amount||0);
 const monthly=s.billing==="monthly"?Number(s.amount||0):Number(s.amount||0)/12;
 return `<div class="item row"><div><b>${esc(s.name)}</b><small>${s.billing==="monthly"?"Pago mensual":"Pago anual"} · equivalente ${euro(monthly)}/mes</small></div><div class="amount">${euro(annual)}/año <button class="danger" data-del="sub" data-id="${s.id}">×</button></div></div>`;
}
function renderMovements(){
 movementList.innerHTML=db.movements.length?db.movements.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(m=>{
  const ac=db.accounts.find(a=>a.id===m.accountId);
  return `<div class="item row"><div><b>${esc(m.concept)}</b><small>${fmtDate(m.date)} · ${esc(m.category)}${ac?" · "+esc(ac.name):""}</small></div><div class="amount ${m.kind==="income"?"positive":"negative"}">${m.kind==="income"?"+":"−"}${euro(m.amount)} <button class="danger" data-del="movement" data-id="${m.id}">×</button></div></div>`;
 }).join(""):empty("Todavía no hay movimientos. Registra tu primer ingreso o gasto.");
}
function renderPlanning(){
 reserveTotal.textContent=euro(reserved());
 planList.innerHTML=db.plans.length?db.plans.map(p=>`<div class="item row"><div><b>${esc(p.name)}</b><small>${esc(p.frequency)} · reserva ${euro(monthlyEquivalent(p))}/mes${p.date?" · "+fmtDate(p.date):""}</small></div><div><span class="amount">${euro(p.amount)}</span> <button class="danger" data-del="plan" data-id="${p.id}">×</button></div></div>`).join(""):empty("No hay previsiones. Ejemplo: 400 € al año = 33,33 € al mes.");
 goalList.innerHTML=db.goals.length?db.goals.map(g=>goalHtml(g)+`<button class="danger" data-del="goal" data-id="${g.id}">Eliminar objetivo</button>`).join(""):empty("No hay objetivos. Define una cantidad y un horizonte.");
 subList.innerHTML=db.subs.length?db.subs.map(subHtml).join(""):empty("No hay suscripciones. Añádelas para ver su coste mensual y anual.");
}
function renderWealth(){
 wealthBig.textContent=euro(wealth());
 const inc=db.accounts.filter(a=>a.includePatrimony);
 wealthAccounts.innerHTML=inc.length?inc.map(a=>`<div class="item row"><div><b>${esc(a.name)}</b><small>${accountType(a.type)}</small></div><span class="amount">${euro(a.balance)}</span></div>`).join(""):empty("Ninguna cuenta está incluida en patrimonio.");
 assetList.innerHTML=db.assets.length?db.assets.map(a=>`<div class="item row"><div><b>${esc(a.name)}</b><small>${esc(a.type||"Activo")}</small></div><div><span class="amount">${euro(a.value)}</span> <button class="danger" data-del="asset" data-id="${a.id}">×</button></div></div>`).join(""):empty("No hay activos adicionales.");
 debtList.innerHTML=db.debts.length?db.debts.map(d=>`<div class="item row"><div><b>${esc(d.name)}</b><small>${esc(d.type||"Deuda")}</small></div><div><span class="amount negative">−${euro(d.outstanding)}</span> <button class="danger" data-del="debt" data-id="${d.id}">×</button></div></div>`).join(""):empty("No hay deudas registradas.");
}
let accountFilter="all";
function renderAccounts(){
 const types=[["all","Todas"],["bank","Bancos"],["savings","Ahorro"],["cash","Efectivo"],["card","Tarjetas"],["investment","Inversión"],["custom","Personalizadas"]];
 accountFilters.innerHTML=types.map(x=>`<button class="filter ${accountFilter===x[0]?"on":""}" data-filter="${x[0]}">${x[1]}</button>`).join("");
 accountFilters.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{accountFilter=b.dataset.filter;renderAccounts()});
 const list=accountFilter==="all"?db.accounts:db.accounts.filter(a=>a.type===accountFilter);
 accountList.innerHTML=list.length?list.map(a=>`<div class="item"><div class="row"><div><b>${esc(a.name)}</b><small>${accountType(a.type)} · saldo ${euro(a.balance)}</small></div><button class="danger" data-del="account" data-id="${a.id}">×</button></div>
 <div class="divider"></div>
 <label class="check"><input type="checkbox" data-flag="available" data-id="${a.id}" ${a.includeAvailable?"checked":""}> Dinero disponible</label>
 <label class="check"><input type="checkbox" data-flag="global" data-id="${a.id}" ${a.includeGlobal?"checked":""}> Saldo global</label>
 <label class="check"><input type="checkbox" data-flag="patrimony" data-id="${a.id}" ${a.includePatrimony?"checked":""}> Patrimonio</label></div>`).join(""):empty("No hay cuentas de este tipo. Añade una para empezar.");
 accountList.querySelectorAll("[data-flag]").forEach(i=>i.onchange=()=>{const a=db.accounts.find(x=>x.id===i.dataset.id);a["include"+({available:"Available",global:"Global",patrimony:"Patrimony"}[i.dataset.flag])]=i.checked;save()});
}
function renderReports(){
 const inc=income(),exp=expense();reportIncome.textContent=euro(inc);reportExpense.textContent=euro(exp);reportSaving.textContent=euro(inc-exp);reportRate.textContent=(inc?Math.round((inc-exp)/inc*100):0)+" %";
 const cats={};monthMovs().filter(m=>m.kind==="expense").forEach(m=>cats[m.category]=(cats[m.category]||0)+Number(m.amount));
 const vals=Object.entries(cats).sort((a,b)=>b[1]-a[1]);categoryReport.innerHTML=vals.length?vals.map(([k,v])=>`<div class="row" style="padding:8px 0"><span>${esc(k)}</span><b>${euro(v)}</b></div>`).join(""):empty("Todavía no hay gastos este mes.");
}
function renderAll(){renderHome();renderMovements();renderPlanning();renderWealth();renderAccounts();renderReports();bindDeletes()}

function modal(title,body){
 modalContent.innerHTML=`<h2>${title}</h2>${body}`;modal.classList.remove("hidden");
}
function closeModal(){modal.classList.add("hidden")}
modalClose.onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()}

incomeBtn.onclick=()=>movementForm("income");expenseBtn.onclick=()=>movementForm("expense");
function movementForm(kind){
 modal(kind==="income"?"Nuevo ingreso":"Nuevo gasto",`<form class="form" id="f">
 <label>Concepto<input name="concept" required placeholder="${kind==="income"?"Nómina, devolución, venta...":"Supermercado, gasolina, alquiler..."}"></label>
 <label>Categoría<select name="category">${(kind==="income"?["Nómina","Autónomo","Alquiler","Inversión","Venta","Devolución","Otros"]:["Alimentación","Transporte","Vivienda","Salud y deporte","Ocio","Compras","Finanzas","Suscripciones","Educación","Impuestos","Otros"]).map(x=>`<option>${x}</option>`).join("")}</select></label>
 <label>Importe (€)<input name="amount" type="number" step="0.01" min="0" required></label>
 <label>Fecha<input name="date" type="date" value="${today()}" required></label>
 <label>Cuenta<select name="accountId"><option value="">Sin cuenta</option>${optionsAccounts()}</select></label>
 <button class="primary" type="submit">Guardar</button></form>`);
 f.onsubmit=e=>{e.preventDefault();const d=new FormData(f),v=Object.fromEntries(d);v.amount=Number(v.amount);v.kind=kind;v.id=uid();db.movements.push(v);if(v.accountId){const a=db.accounts.find(x=>x.id===v.accountId);if(a)a.balance+=kind==="income"?v.amount:-v.amount}save();closeModal()};
}
planBtn.onclick=()=>modal("Nueva previsión",`<form class="form" id="f"><label>Concepto<input name="name" required placeholder="Seguro, impuesto, reparación..."></label><label>Importe<input name="amount" type="number" step="0.01" required></label><label>Periodicidad<select name="frequency"><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></label><label>Fecha prevista<input name="date" type="date"></label><button class="primary">Guardar previsión</button></form>`)||null;
document.addEventListener("submit",e=>{if(e.target.id!=="f")return;if(e.target.dataset.type)return});
function addPlanSubmit(){
 const form=document.getElementById("f"); if(!form)return;
 form.onsubmit=e=>{e.preventDefault();const d=new FormData(form),v=Object.fromEntries(d);v.id=uid();v.amount=Number(v.amount);db.plans.push(v);save();closeModal()}
}
goalBtn.onclick=()=>{modal("Nuevo objetivo",`<form class="form" id="f"><label>Objetivo<input name="name" required placeholder="Ahorro, vivienda, viaje..."></label><label>Objetivo total (€)<input name="target" type="number" step="0.01" required></label><label>Ya conseguido (€)<input name="current" type="number" step="0.01" value="0"></label><label>Aportación mensual (€)<input name="monthly" type="number" step="0.01" value="0"></label><label>Fecha objetivo<input name="date" type="date"></label><button class="primary">Guardar objetivo</button></form>`);document.getElementById("f").onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));v.id=uid();["target","current","monthly"].forEach(k=>v[k]=Number(v[k]||0));v.status="En progreso";db.goals.push(v);save();closeModal()}};
subBtn.onclick=()=>{modal("Nueva suscripción",`<form class="form" id="f"><label>Nombre<input name="name" required placeholder="Streaming, software, gimnasio..."></label><label>Importe (€)<input name="amount" type="number" step="0.01" required></label><label>Forma de pago<select name="billing"><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label><button class="primary">Guardar suscripción</button></form>`);document.getElementById("f").onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));v.id=uid();v.amount=Number(v.amount);db.subs.push(v);save();closeModal()}};
assetBtn.onclick=()=>simpleForm("Nuevo activo",[["name","Nombre","Vivienda, coche, inversión..."],["value","Valor actual",""]],v=>{db.assets.push({id:uid(),name:v.name,value:Number(v.value||0),type:"Activo"})});
debtBtn.onclick=()=>simpleForm("Nueva deuda",[["name","Nombre","Hipoteca, préstamo, tarjeta..."],["outstanding","Capital pendiente",""]],v=>{db.debts.push({id:uid(),name:v.name,outstanding:Number(v.outstanding||0),type:"Deuda"})});
accountBtn.onclick=()=>{modal("Nueva cuenta",`<form class="form" id="f"><label>Nombre<input name="name" required placeholder="Cuenta principal, ahorro..."></label><label>Tipo<select name="type"><option value="bank">Banco</option><option value="savings">Ahorro</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="investment">Inversión</option><option value="custom">Personalizada</option></select></label><label>Saldo inicial<input name="balance" type="number" step="0.01" value="0"></label><label class="check"><input type="checkbox" name="includeAvailable" checked> Incluir en dinero disponible</label><label class="check"><input type="checkbox" name="includeGlobal" checked> Incluir en saldo global</label><label class="check"><input type="checkbox" name="includePatrimony" checked> Incluir en patrimonio</label><button class="primary">Guardar cuenta</button></form>`);document.getElementById("f").onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const type=v.type;if(type==="cash"||type==="card"){v.includeAvailable=false;v.includeGlobal=false;v.includePatrimony=false}else if(type==="investment"){v.includeAvailable=false;v.includeGlobal=true;v.includePatrimony=true}else{v.includeAvailable=!!v.includeAvailable;v.includeGlobal=!!v.includeGlobal;v.includePatrimony=!!v.includePatrimony}v.balance=Number(v.balance||0);v.id=uid();db.accounts.push(v);save();closeModal()}};
function simpleForm(title,fields,cb){modal(title,`<form class="form" id="f">${fields.map(x=>`<label>${x[1]}<input name="${x[0]}" ${x[0]!=="value"&&x[0]!=="outstanding"?"required":""} type="${x[0]==="value"||x[0]==="outstanding"?"number":"text"} step="0.01" placeholder="${x[2]}"></label>`).join("")}<button class="primary">Guardar</button></form>`);document.getElementById("f").onsubmit=e=>{e.preventDefault();cb(Object.fromEntries(new FormData(e.target)));save();closeModal()}}

function bindDeletes(){document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const type=b.dataset.del,id=b.dataset.id;if(!confirm("¿Eliminar este elemento?"))return;
 if(type==="movement"){const m=db.movements.find(x=>x.id===id);if(m&&m.accountId){const a=db.accounts.find(x=>x.id===m.accountId);if(a)a.balance+=m.kind==="income"?-m.amount:m.amount}db.movements=db.movements.filter(x=>x.id!==id)}
 else db[type+"s"]=db[type+"s"].filter(x=>x.id!==id);save()})}

accountsOpen.onclick=()=>nav("accounts");reportsOpen.onclick=()=>nav("reports");exportOpen.onclick=exportBackup;backupBtn.onclick=exportBackup;
function exportBackup(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`DOMINIO_copia_${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
/* Correctly attach plan form after modal creation. */
const oldPlan=planBtn.onclick;
planBtn.onclick=()=>{modal("Nueva previsión",`<form class="form" id="planForm"><label>Concepto<input name="name" required placeholder="Seguro, impuesto, reparación..."></label><label>Importe<input name="amount" type="number" step="0.01" required></label><label>Periodicidad<select name="frequency"><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></label><label>Fecha prevista<input name="date" type="date"></label><button class="primary">Guardar previsión</button></form>`);planForm.onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(planForm));v.id=uid();v.amount=Number(v.amount);db.plans.push(v);save();closeModal()}};
renderAll();
