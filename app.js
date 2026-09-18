(() => {
  "use strict";

  const KEY = "dominio-v4";
  const state = JSON.parse(localStorage.getItem(KEY) || '{"movements":[],"plans":[],"goals":[],"assets":[],"debts":[],"accounts":[],"subscriptions":[]}');
  let movementFilter = "all";
  let deferredInstallPrompt = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const euro = n => new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(n)||0);
  const monthKey = d => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`;
  };
  const now = new Date();
  const currentMonth = monthKey(now);

  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); render(); }

  function totals(){
    const month = state.movements.filter(m => monthKey(m.date) === currentMonth);
    const income = month.filter(m=>m.type==="income").reduce((s,m)=>s+Number(m.amount),0);
    const expense = month.filter(m=>m.type==="expense").reduce((s,m)=>s+Number(m.amount),0);
    const accounts = state.accounts.reduce((s,a)=>s+Number(a.balance||0),0);
    const assets = state.assets.reduce((s,a)=>s+Number(a.value||0),0);
    const debts = state.debts.reduce((s,d)=>s+Number(d.outstanding||0),0);
    const provisions = state.plans.reduce((s,p)=>s+Number(p.monthly||0),0);
    return {income,expense,saving:income-expense,accounts,assets,debts,provisions,netWorth:accounts+assets-debts};
  }

  function render(){
    const t=totals();
    $("#availableBalance").textContent=euro(t.accounts);
    $("#incomeMonth").textContent=euro(t.income);
    $("#expenseMonth").textContent=euro(t.expense);
    $("#savingMonth").textContent=euro(t.saving);
    $("#netWorth").textContent=euro(t.netWorth);
    $("#wealthTotal").textContent=euro(t.netWorth);
    $("#assetsTotal").textContent=euro(t.accounts+t.assets);
    $("#debtsTotal").textContent=euro(t.debts);
    $("#monthlyProvision").textContent=euro(t.provisions);
    $("#goalsCount").textContent=state.goals.length;
    renderMovements();
    renderPlans();
    renderWealth();
    const upcoming=state.plans.length>0;
    $("#upcomingEmpty").style.display=upcoming?"none":"flex";
  }

  function renderMovements(){
    const list=$("#movementsList");
    const items=state.movements.filter(m=>movementFilter==="all"||m.type===movementFilter).sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!items.length){list.innerHTML='<div class="list-empty glass">Todavía no hay movimientos.<br>Añade tu primer ingreso o gasto.</div>';return;}
    list.innerHTML=items.map(m=>`
      <div class="movement glass">
        <div class="movement-left"><div class="movement-icon">${m.type==="income"?"↗":"↘"}</div>
        <div><div class="movement-name">${escapeHtml(m.concept)}</div><div class="movement-meta">${escapeHtml(m.category)} · ${formatDate(m.date)}</div></div></div>
        <div class="movement-amount ${m.type==="income"?"income":"expense"}">${m.type==="income"?"+":"−"}${euro(m.amount)}</div>
      </div>`).join("");
  }

  function renderPlans(){
    const list=$("#plansList");
    if(!state.plans.length){list.innerHTML='<div class="list-empty glass">Aquí aparecerán tus gastos futuros y reservas.</div>';return;}
    list.innerHTML=state.plans.map(p=>`
      <div class="movement glass"><div class="movement-left"><div class="movement-icon">◷</div>
      <div><div class="movement-name">${escapeHtml(p.name)}</div><div class="movement-meta">${escapeHtml(p.frequency)} · reservar ${euro(p.monthly)}/mes</div></div></div>
      <div class="movement-amount">${euro(p.amount)}</div></div>`).join("");
  }

  function renderWealth(){
    const list=$("#wealthList");
    const items=[
      ...state.assets.map(a=>({name:a.name,value:Number(a.value),meta:"Activo"})),
      ...state.debts.map(d=>({name:d.name,value:-Number(d.outstanding),meta:"Deuda"}))
    ];
    if(!items.length){list.innerHTML='<div class="list-empty glass">Añade un activo o una deuda para empezar a construir tu patrimonio.</div>';return;}
    list.innerHTML=items.map(x=>`<div class="movement glass"><div><div class="movement-name">${escapeHtml(x.name)}</div><div class="movement-meta">${x.meta}</div></div><div class="movement-amount ${x.value<0?"expense":"income"}">${x.value<0?"−":""}${euro(Math.abs(x.value))}</div></div>`).join("");
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
  function formatDate(d){return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short"}).format(new Date(d));}

  function navigate(view){
    $$(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===view));
    $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.viewTarget===view));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function openModal(kind){
    const configs={
      income:{title:"Añadir ingreso",subtitle:"Registra dinero que entra en una cuenta.",type:"income",concept:"Nómina",category:"Ingresos"},
      expense:{title:"Añadir gasto",subtitle:"Registra un gasto puntual o recurrente.",type:"expense",concept:"",category:"Otros"},
      plan:{title:"Nueva previsión",subtitle:"Reserva cada mes para un gasto futuro.",type:"plan"},
      goal:{title:"Nuevo objetivo",subtitle:"Define una meta y deja que DOMINIO siga tu progreso.",type:"goal"},
      asset:{title:"Añadir activo",subtitle:"Añade efectivo, ahorro, vehículo, inversión, inmueble u otro activo.",type:"asset"},
      debt:{title:"Añadir deuda",subtitle:"Registra una hipoteca, préstamo, tarjeta o financiación.",type:"debt"},
      account:{title:"Añadir cuenta",subtitle:"Crea una cuenta manual. DOMINIO no necesita tus credenciales bancarias.",type:"account"},
      subscription:{title:"Añadir suscripción",subtitle:"Controla pagos mensuales o anuales.",type:"subscription"}
    };
    const c=configs[kind];
    let body="";
    if(["income","expense"].includes(c.type)) body=`
      <div class="form">
        <div class="field"><label>Concepto</label><input id="fConcept" value="${c.concept}"></div>
        <div class="field"><label>Categoría</label><input id="fCategory" value="${c.category}"></div>
        <div class="field"><label>Importe</label><input id="fAmount" inputmode="decimal" type="number" step="0.01" min="0" placeholder="0,00"></div>
        <div class="field"><label>Fecha</label><input id="fDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="plan") body=`
      <div class="form">
        <div class="field"><label>Nombre del gasto</label><input id="fName" placeholder="Ej. Seguro del coche"></div>
        <div class="field"><label>Importe total</label><input id="fAmount" type="number" step="0.01" min="0" placeholder="400"></div>
        <div class="field"><label>Frecuencia</label><select id="fFrequency"><option>Anual</option><option>Semestral</option><option>Trimestral</option><option>Personalizada</option></select></div>
        <div class="field"><label>Mes del pago</label><input id="fDate" type="month"></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="goal") body=`
      <div class="form">
        <div class="field"><label>Objetivo</label><input id="fName" placeholder="Ej. Fondo de emergencia"></div>
        <div class="field"><label>Importe objetivo</label><input id="fAmount" type="number" step="0.01" min="0" placeholder="5000"></div>
        <div class="field"><label>Aportación mensual</label><input id="fMonthly" type="number" step="0.01" min="0" placeholder="250"></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="asset") body=`
      <div class="form">
        <div class="field"><label>Nombre</label><input id="fName" placeholder="Ej. Ahorros"></div>
        <div class="field"><label>Valor actual</label><input id="fAmount" type="number" step="0.01" min="0" placeholder="0"></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="debt") body=`
      <div class="form">
        <div class="field"><label>Nombre</label><input id="fName" placeholder="Ej. Préstamo"></div>
        <div class="field"><label>Capital pendiente</label><input id="fAmount" type="number" step="0.01" min="0" placeholder="0"></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="account") body=`
      <div class="form">
        <div class="field"><label>Nombre de la cuenta</label><input id="fName" placeholder="Ej. Cuenta corriente"></div>
        <div class="field"><label>Saldo inicial</label><input id="fAmount" type="number" step="0.01" placeholder="0"></div>
        <div class="field"><label>Tipo</label><select id="fType"><option>Cuenta corriente</option><option>Ahorro</option><option>Efectivo</option><option>Inversión</option><option>Personalizada</option></select></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    if(c.type==="subscription") body=`
      <div class="form">
        <div class="field"><label>Nombre</label><input id="fName" placeholder="Ej. Streaming"></div>
        <div class="field"><label>Importe</label><input id="fAmount" type="number" step="0.01" min="0" placeholder="0"></div>
        <div class="field"><label>Periodicidad</label><select id="fFrequency"><option>Mensual</option><option>Anual</option></select></div>
        <div class="form-actions"><button class="cancel-btn" data-close>Cancelar</button><button class="save-btn" id="saveForm">Guardar</button></div>
      </div>`;
    $("#modalContent").innerHTML=`<h2>${c.title}</h2><p>${c.subtitle}</p>${body}`;
    $("#modalBackdrop").hidden=false;
    $("#saveForm").onclick=()=>saveModal(c.type);
    $$("[data-close]").forEach(b=>b.onclick=closeModal);
  }

  function saveModal(type){
    const amount=Number($("#fAmount")?.value||0);
    if(type==="income"||type==="expense"){
      const concept=$("#fConcept").value.trim()||"Personalizado";
      const category=$("#fCategory").value.trim()||"Otros";
      if(amount<=0){toast("Introduce un importe.");return;}
      state.movements.push({id:crypto.randomUUID(),type,concept,category,amount,date:$("#fDate").value});
    } else if(type==="plan"){
      const name=$("#fName").value.trim()||"Gasto futuro";
      if(amount<=0){toast("Introduce un importe.");return;}
      const freq=$("#fFrequency").value;
      const monthly = freq==="Anual"?amount/12:freq==="Semestral"?amount/6:freq==="Trimestral"?amount/3:amount;
      state.plans.push({id:crypto.randomUUID(),name,amount,frequency:freq,monthly,date:$("#fDate").value});
    } else if(type==="goal"){
      const name=$("#fName").value.trim()||"Nuevo objetivo";
      if(amount<=0){toast("Introduce un objetivo.");return;}
      state.goals.push({id:crypto.randomUUID(),name,target:amount,monthly:Number($("#fMonthly").value||0),current:0});
    } else if(type==="asset"){
      const name=$("#fName").value.trim()||"Activo";
      state.assets.push({id:crypto.randomUUID(),name,value:amount});
    } else if(type==="debt"){
      const name=$("#fName").value.trim()||"Deuda";
      state.debts.push({id:crypto.randomUUID(),name,outstanding:amount});
    } else if(type==="account"){
      const name=$("#fName").value.trim()||"Cuenta";
      state.accounts.push({id:crypto.randomUUID(),name,balance:amount,type:$("#fType").value});
    } else if(type==="subscription"){
      const name=$("#fName").value.trim()||"Suscripción";
      state.subscriptions.push({id:crypto.randomUUID(),name,amount,frequency:$("#fFrequency").value});
    }
    closeModal();save();toast("Guardado correctamente.");
  }

  function closeModal(){$("#modalBackdrop").hidden=true;$("#modalContent").innerHTML="";}
  function toast(msg){let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}

  function exportBackup(){
    const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="DOMINIO_backup.json";a.click();URL.revokeObjectURL(a.href);toast("Copia de seguridad preparada.");
  }

  document.addEventListener("click",e=>{
    const viewTarget=e.target.closest("[data-view-target]");
    if(viewTarget){navigate(viewTarget.dataset.viewTarget);return;}
    const action=e.target.closest("[data-action]");
    if(action){openModal(action.dataset.action.replace("add-",""));return;}
    const filter=e.target.closest("[data-filter]");
    if(filter){movementFilter=filter.dataset.filter;$$(".chip").forEach(c=>c.classList.toggle("active",c===filter));renderMovements();return;}
    if(e.target.id==="modalClose"||e.target.id==="modalBackdrop")closeModal();
    if(e.target.id==="settingsBtn")toast("Ajustes avanzados estarán disponibles en la siguiente fase.");
    if(e.target.id==="installBtn"){
      if(deferredInstallPrompt){deferredInstallPrompt.prompt();deferredInstallPrompt=null}
      else toast("En iPhone: Safari → Compartir → Añadir a pantalla de inicio.");
    }
    if(e.target.closest("[data-action='backup']"))exportBackup();
  });

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;});
  render();
})();