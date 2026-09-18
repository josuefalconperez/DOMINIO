(() => {
"use strict";

const KEY = "dominio-v7";
const $ = id => document.getElementById(id);

const defaults = {
  accounts: [], movements: [], plans: [], goals: [], subs: [], assets: [], debts: []
};

function loadDB(){
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return Object.assign({}, defaults, data || {});
  } catch(e) {
    return Object.assign({}, defaults);
  }
}
let db = loadDB();

const euro = n => new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const today = () => new Date().toISOString().slice(0,10);
const month = () => today().slice(0,7);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const empty = msg => `<div class="empty">${msg}</div>`;
const typeName = t => ({bank:"Banco",savings:"Ahorro",cash:"Efectivo",card:"Tarjeta",investment:"Inversión",custom:"Personalizada"}[t] || t);
const sum = arr => arr.reduce((a,b)=>a+(Number(b)||0),0);

function save(){
  localStorage.setItem(KEY, JSON.stringify(db));
  renderAll();
}
function monthMovements(){
  return db.movements.filter(m => String(m.date||"").slice(0,7) === month());
}
function monthlyEquivalent(p){
  const v = Number(p.amount)||0;
  if(!p.prorate) return p.frequency==="monthly" ? v : 0;
  return p.frequency==="quarterly" ? v/3 : p.frequency==="semiannual" ? v/6 : p.frequency==="annual" ? v/12 : v;
}
function monthlyCommittedExpenses(){ return sum(db.plans.filter(p=>p.countAsMonthlyExpense).map(monthlyEquivalent)); }
function reserveMonthly(){ return monthlyCommittedExpenses(); }
function globalBalance(){ return sum(db.accounts.filter(a=>a.includeGlobal).map(a=>a.balance)); }
function availableMoney(){ return sum(db.accounts.filter(a=>a.includeAvailable).map(a=>a.balance)) - monthlyCommittedExpenses(); }
function netWorth(){
  return sum(db.accounts.filter(a=>a.includePatrimony).map(a=>a.balance))
    + sum(db.assets.map(a=>a.value))
    - sum(db.debts.map(d=>d.outstanding));
}
function incomes(){ return sum(monthMovements().filter(m=>m.kind==="income").map(m=>m.amount)); }
function actualExpenses(){ return sum(monthMovements().filter(m=>m.kind==="expense").map(m=>m.amount)); }
function expenses(){ return actualExpenses() + monthlyCommittedExpenses(); }

function go(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  const target = $(id);
  if(target) target.classList.add("active");
  document.querySelectorAll(".nav button").forEach(b=>b.classList.toggle("active",b.dataset.nav===id));
  window.scrollTo(0,0);
}

document.querySelectorAll("[data-nav]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.nav)));
document.querySelectorAll("[data-back]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.back)));

const modal = $("modal");
const modalContent = $("modalContent");
function openModal(title, html, submit){
  modalContent.innerHTML = `<h2>${title}</h2>${html}`;
  modal.classList.remove("hidden");
  const form = modalContent.querySelector("form");
  if(form && submit) form.addEventListener("submit", e => {
    e.preventDefault();
    submit(new FormData(form), form);
  });
}
function closeModal(){ modal.classList.add("hidden"); modalContent.innerHTML=""; }
$("modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", e => { if(e.target === modal) closeModal(); });

function accountOptions(){
  return db.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} · ${typeName(a.type)}</option>`).join("");
}

function movementForm(kind){
  openModal(kind==="income" ? "Nuevo ingreso" : "Nuevo gasto", `
    <form class="form">
      <label>Concepto<input name="concept" required placeholder="${kind==="income"?"Nómina, devolución, venta...":"Supermercado, gasolina, alquiler..."}"></label>
      <label>Categoría<select name="category">${(kind==="income"?["Nómina","Autónomo","Alquiler","Inversión","Venta","Devolución","Otros"]:["Alimentación","Transporte","Vivienda","Salud y deporte","Ocio","Compras","Finanzas","Suscripciones","Educación","Impuestos","Otros"]).map(x=>`<option>${x}</option>`).join("")}</select></label>
      <label>Importe (€)<input name="amount" type="number" min="0" step="0.01" required></label>
      <label>Fecha<input name="date" type="date" value="${today()}" required></label>
      <label>Cuenta<select name="accountId"><option value="">Sin cuenta</option>${accountOptions()}</select></label>
      <button class="primary" type="submit">Guardar</button>
    </form>`,
    fd=>{
      const v=Object.fromEntries(fd);
      v.id=uid(); v.kind=kind; v.amount=Number(v.amount);
      db.movements.push(v);
      if(v.accountId){
        const a=db.accounts.find(x=>x.id===v.accountId);
        if(a) a.balance += kind==="income" ? v.amount : -v.amount;
      }
      save(); closeModal();
    });
}

function planForm(){
  openModal("Nueva previsión", `
    <form class="form" id="planForm">
      <label>Concepto<input name="name" required placeholder="Seguro, impuesto, reparación..."></label>
      <label>Importe del gasto (€)<input name="amount" type="number" min="0" step="0.01" required></label>
      <label>Periodicidad<select name="frequency">
        <option value="monthly">Mensual</option>
        <option value="quarterly">Trimestral</option>
        <option value="semiannual">Semestral</option>
        <option value="annual">Anual</option>
      </select></label>
      <label>Fecha de pago prevista<input name="date" type="date"></label>
      <label class="check"><input type="checkbox" name="prorate" checked> Prorratear este gasto durante el año</label>
      <small class="tiny">Ejemplo: 413 € anuales → 34,42 €/mes. DOMINIO lo tendrá en cuenta desde el día 1 de cada mes.</small>
      <label class="check"><input type="checkbox" name="countAsMonthlyExpense" checked> Contabilizar como gasto mensual previsto</label>
      <small class="tiny">Así el cálculo de dinero disponible y ahorro mensual incluye esta cantidad aunque el pago real llegue más adelante.</small>
      <button class="primary">Guardar previsión</button>
    </form>`,
    fd=>{
      const v=Object.fromEntries(fd);
      v.id=uid(); v.amount=Number(v.amount);
      v.prorate=!!v.prorate;
      v.countAsMonthlyExpense=!!v.countAsMonthlyExpense;
      // A monthly expense is inherently a monthly commitment.
      if(v.frequency==="monthly") v.prorate=true;
      db.plans.push(v);
      save(); closeModal();
    });
}

function goalForm(){
  openModal("Nuevo objetivo", `
    <form class="form">
      <label>Nombre del objetivo<input name="name" required placeholder="Ahorro, vivienda, viaje..."></label>
      <label>Objetivo total (€)<input name="target" type="number" min="0" step="0.01" required></label>
      <label>Ya conseguido (€)<input name="current" type="number" min="0" step="0.01" value="0"></label>
      <label>Aportación mensual (€)<input name="monthly" type="number" min="0" step="0.01" value="0"></label>
      <label>Fecha objetivo<input name="date" type="date"></label>
      <button class="primary">Guardar objetivo</button>
    </form>`,
    fd=>{ const v=Object.fromEntries(fd); v.id=uid(); ["target","current","monthly"].forEach(k=>v[k]=Number(v[k]||0)); v.status="En progreso"; db.goals.push(v); save(); closeModal(); });
}

function subForm(){
  openModal("Nueva suscripción", `
    <form class="form">
      <label>Nombre<input name="name" required placeholder="Streaming, software, gimnasio..."></label>
      <label>Importe (€)<input name="amount" type="number" min="0" step="0.01" required></label>
      <label>Forma de pago<select name="billing"><option value="monthly">Mensual</option><option value="annual">Anual</option></select></label>
      <button class="primary">Guardar suscripción</button>
    </form>`,
    fd=>{ const v=Object.fromEntries(fd); v.id=uid(); v.amount=Number(v.amount); db.subs.push(v); save(); closeModal(); });
}

function accountForm(){
  openModal("Nueva cuenta", `
    <form class="form">
      <label>Nombre<input name="name" required placeholder="Cuenta principal, ahorro..."></label>
      <label>Tipo<select name="type"><option value="bank">Banco</option><option value="savings">Ahorro</option><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="investment">Inversión</option><option value="custom">Personalizada</option></select></label>
      <label>Saldo inicial (€)<input name="balance" type="number" step="0.01" value="0"></label>
      <label class="check"><input type="checkbox" name="includeAvailable" checked> Incluir en dinero disponible</label>
      <label class="check"><input type="checkbox" name="includeGlobal" checked> Incluir en saldo global</label>
      <label class="check"><input type="checkbox" name="includePatrimony" checked> Incluir en patrimonio</label>
      <button class="primary">Guardar cuenta</button>
    </form>`,
    fd=>{
      const v=Object.fromEntries(fd), t=v.type;
      v.id=uid(); v.balance=Number(v.balance||0);
      if(t==="cash" || t==="card"){v.includeAvailable=false;v.includeGlobal=false;v.includePatrimony=false}
      else if(t==="investment"){v.includeAvailable=false;v.includeGlobal=true;v.includePatrimony=true}
      else {v.includeAvailable=!!v.includeAvailable;v.includeGlobal=!!v.includeGlobal;v.includePatrimony=!!v.includePatrimony}
      db.accounts.push(v); save(); closeModal();
    });
}

function simpleForm(title, nameLabel, amountLabel, cb){
  openModal(title, `<form class="form"><label>${nameLabel}<input name="name" required></label><label>${amountLabel}<input name="amount" type="number" min="0" step="0.01" required></label><button class="primary">Guardar</button></form>`,
    fd=>{const v=Object.fromEntries(fd);cb(v);save();closeModal();});
}

$("incomeBtn").addEventListener("click",()=>movementForm("income"));
$("expenseBtn").addEventListener("click",()=>movementForm("expense"));
$("planBtn").addEventListener("click",planForm);
$("goalBtn").addEventListener("click",goalForm);
$("subBtn").addEventListener("click",subForm);
$("accountBtn").addEventListener("click",accountForm);
$("assetBtn").addEventListener("click",()=>simpleForm("Nuevo activo","Nombre","Valor actual (€)",v=>db.assets.push({id:uid(),name:v.name,value:Number(v.amount||0),type:"Activo"})));
$("debtBtn").addEventListener("click",()=>simpleForm("Nueva deuda","Nombre","Capital pendiente (€)",v=>db.debts.push({id:uid(),name:v.name,outstanding:Number(v.amount||0),type:"Deuda"})));
$("accountsOpen").addEventListener("click",()=>go("accounts"));
$("reportsOpen").addEventListener("click",()=>go("reports"));
$("exportOpen").addEventListener("click",exportBackup);
$("backupBtn").addEventListener("click",exportBackup);

function exportBackup(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`DOMINIO_copia_${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function goalHTML(g){
  const pct=Math.min(100,Math.max(0,Number(g.target)?Number(g.current||0)/Number(g.target)*100:0));
  return `<div class="item"><div class="row"><div><b>${esc(g.name)}</b><small>${euro(g.current)} de ${euro(g.target)}</small></div><span>${Math.round(pct)}%</span></div><div class="progress"><i style="width:${pct}%"></i></div><small>+ ${euro(g.monthly)}/mes · ${esc(g.status||"En progreso")}</small></div>`;
}
function subHTML(s){
  const annual=s.billing==="monthly"?Number(s.amount)*12:Number(s.amount);
  const monthly=annual/12;
  return `<div class="item row"><div><b>${esc(s.name)}</b><small>${s.billing==="monthly"?"Pago mensual":"Pago anual"} · equivalente ${euro(monthly)}/mes</small></div><div class="amount">${euro(annual)}/año <button class="danger" data-delete="sub" data-id="${s.id}">×</button></div></div>`;
}

function renderHome(){
  const inc=incomes(), exp=expenses(), sav=inc-exp;
  $("availableTotal").textContent=euro(availableMoney());
  $("incomeTotal").textContent=euro(inc);
  $("expenseTotal").textContent=euro(exp);
  $("savingTotal").textContent=euro(sav);
  $("wealthTotal").textContent=euro(netWorth());
  $("homeInsight").textContent=(db.movements.length || db.plans.length)?`Este mes tienes ${euro(monthlyCommittedExpenses())} de gastos previstos comprometidos. Cada pequeño avance cuenta.`:"Empieza donde estés. DOMINIO crece contigo.";
  $("upcomingCount").textContent=db.plans.length;
  $("homeGoalCount").textContent=db.goals.length;
  $("homeSubCount").textContent=db.subs.length;
  $("homeUpcoming").innerHTML=db.plans.length?db.plans.slice(0,4).map(p=>`<div class="item row"><div><b>${esc(p.name)}</b><small>Reserva ${euro(monthlyEquivalent(p))}/mes</small></div><span class="amount">${euro(p.amount)}</span></div>`).join(""):empty("No tienes previsiones todavía.");
  $("homeGoals").innerHTML=db.goals.length?db.goals.slice(0,4).map(goalHTML).join(""):empty("No tienes objetivos todavía.");
  $("homeSubs").innerHTML=db.subs.length?db.subs.slice(0,4).map(subHTML).join(""):empty("No tienes suscripciones todavía.");
}

function renderMovements(){
  $("movementList").innerHTML=db.movements.length?db.movements.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(m=>{
    const ac=db.accounts.find(a=>a.id===m.accountId);
    return `<div class="item row"><div><b>${esc(m.concept)}</b><small>${esc(m.date)} · ${esc(m.category)}${ac?" · "+esc(ac.name):""}</small></div><div class="amount ${m.kind==="income"?"positive":"negative"}">${m.kind==="income"?"+":"−"}${euro(m.amount)} <button class="danger" data-delete="movement" data-id="${m.id}">×</button></div></div>`;
  }).join(""):empty("Todavía no hay movimientos. Registra tu primer ingreso o gasto.");
}

function renderPlanning(){
  $("reserveTotal").textContent=euro(monthlyCommittedExpenses());
  $("actualExpensePlanning").textContent=euro(actualExpenses());
  $("plannedExpensePlanning").textContent=euro(monthlyCommittedExpenses());
  $("planList").innerHTML=db.plans.length?db.plans.map(p=>`<div class="item row"><div><b>${esc(p.name)}</b><small>${esc(p.frequency)} · ${p.prorate?"prorrateado":"sin prorratear"} · ${p.countAsMonthlyExpense?"gasto mensual previsto":"solo previsión"} · ${euro(monthlyEquivalent(p))}/mes</small></div><div><span class="amount">${euro(p.amount)}</span> <button class="danger" data-delete="plan" data-id="${p.id}">×</button></div></div>`).join(""):empty("No hay previsiones. Ejemplo: 400 € al año = 33,33 € al mes.");
  $("goalList").innerHTML=db.goals.length?db.goals.map(g=>goalHTML(g)+`<button class="danger" data-delete="goal" data-id="${g.id}">Eliminar objetivo</button>`).join(""):empty("No hay objetivos.");
  $("subList").innerHTML=db.subs.length?db.subs.map(subHTML).join(""):empty("No hay suscripciones.");
}

function renderWealth(){
  $("wealthBig").textContent=euro(netWorth());
  const included=db.accounts.filter(a=>a.includePatrimony);
  $("wealthAccounts").innerHTML=included.length?included.map(a=>`<div class="item row"><div><b>${esc(a.name)}</b><small>${typeName(a.type)}</small></div><span class="amount">${euro(a.balance)}</span></div>`).join(""):empty("Ninguna cuenta está incluida en patrimonio.");
  $("assetList").innerHTML=db.assets.length?db.assets.map(a=>`<div class="item row"><div><b>${esc(a.name)}</b><small>Activo</small></div><div><span class="amount">${euro(a.value)}</span> <button class="danger" data-delete="asset" data-id="${a.id}">×</button></div></div>`).join(""):empty("No hay activos adicionales.");
  $("debtList").innerHTML=db.debts.length?db.debts.map(d=>`<div class="item row"><div><b>${esc(d.name)}</b><small>Deuda</small></div><div><span class="amount negative">−${euro(d.outstanding)}</span> <button class="danger" data-delete="debt" data-id="${d.id}">×</button></div></div>`).join(""):empty("No hay deudas registradas.");
}

let accountFilter="all";
function renderAccounts(){
  const types=[["all","Todas"],["bank","Bancos"],["savings","Ahorro"],["cash","Efectivo"],["card","Tarjetas"],["investment","Inversión"],["custom","Personalizadas"]];
  $("accountFilters").innerHTML=types.map(([v,t])=>`<button class="filter ${accountFilter===v?"on":""}" data-filter="${v}">${t}</button>`).join("");
  $("accountFilters").querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{accountFilter=b.dataset.filter;renderAccounts();}));
  const list=accountFilter==="all"?db.accounts:db.accounts.filter(a=>a.type===accountFilter);
  $("accountList").innerHTML=list.length?list.map(a=>`<div class="item">
    <div class="row"><div><b>${esc(a.name)}</b><small>${typeName(a.type)} · saldo ${euro(a.balance)}</small></div><button class="danger" data-delete="account" data-id="${a.id}">×</button></div>
    <div class="divider"></div>
    <label class="check"><input type="checkbox" data-flag="includeAvailable" data-id="${a.id}" ${a.includeAvailable?"checked":""}> Dinero disponible</label>
    <label class="check"><input type="checkbox" data-flag="includeGlobal" data-id="${a.id}" ${a.includeGlobal?"checked":""}> Saldo global</label>
    <label class="check"><input type="checkbox" data-flag="includePatrimony" data-id="${a.id}" ${a.includePatrimony?"checked":""}> Patrimonio</label>
  </div>`).join(""):empty("No hay cuentas de este tipo.");
  $("accountList").querySelectorAll("[data-flag]").forEach(i=>i.addEventListener("change",()=>{const a=db.accounts.find(x=>x.id===i.dataset.id);if(a){a[i.dataset.flag]=i.checked;save();}}));
}

function renderReports(){
  const inc=incomes(),exp=expenses(),sav=inc-exp;
  $("reportIncome").textContent=euro(inc); $("reportExpense").textContent=euro(exp); $("reportSaving").textContent=euro(sav);
  $("reportRate").textContent=(inc?Math.round(sav/inc*100):0)+" %";
  const cats={}; monthMovements().filter(m=>m.kind==="expense").forEach(m=>cats[m.category]=(cats[m.category]||0)+Number(m.amount));
  const vals=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  $("categoryReport").innerHTML=vals.length?vals.map(([k,v])=>`<div class="row" style="padding:8px 0"><span>${esc(k)}</span><b>${euro(v)}</b></div>`).join(""):empty("Todavía no hay gastos este mes.");
}

function bindDeletes(){
  document.querySelectorAll("[data-delete]").forEach(btn=>{
    btn.onclick=()=>{
      const type=btn.dataset.delete,id=btn.dataset.id;
      if(!confirm("¿Eliminar este elemento?")) return;
      if(type==="movement"){
        const m=db.movements.find(x=>x.id===id);
        if(m && m.accountId){const a=db.accounts.find(x=>x.id===m.accountId);if(a)a.balance += m.kind==="income"?-m.amount:m.amount;}
        db.movements=db.movements.filter(x=>x.id!==id);
      } else {
        const key=type==="sub"?"subs":type==="plan"?"plans":type==="goal"?"goals":type==="asset"?"assets":type==="debt"?"debts":"accounts";
        db[key]=db[key].filter(x=>x.id!==id);
      }
      save();
    };
  });
}
function renderAll(){renderHome();renderMovements();renderPlanning();renderWealth();renderAccounts();renderReports();bindDeletes();}
renderAll();
})();