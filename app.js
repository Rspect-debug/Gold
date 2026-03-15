// ================================================================
//  APP.JS  —  Main Application Logic
// ================================================================

// ---- Global State ----
const S = {
  role:'staff', userName:'', shopSettings:{},
  customers:[], activeCustId:null, activeCustName:null,
  activeOutstanding:0, page:'dashboard'
};

// ================================================================
//  BOOT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  applyTheme(localStorage.getItem('gm-theme')||'dark');
  // Start live clock
  startClock();
  // Firebase auth listener
  Auth.onStateChange(async user => {
    if(user) {
      try {
        S.role     = await DB.getUserRole(user.uid);
        S.userName = await DB.getUserName(user.uid)||user.email;
        S.shopSettings = await DB.getShopSettings();
        // Update top bar shop name + page title
        const sn = S.shopSettings.shopName||'Gold Manager';
        document.getElementById('tb-shop').textContent = sn;
        document.title = sn;
        // Hide settings nav for staff
        if(S.role!=='owner') document.getElementById('nav-settings').style.display='none';
        // Show app
        document.getElementById('page-login').style.display='none';
        document.getElementById('app').classList.remove('hidden');
        goTo('dashboard');
      } catch(e) {
        console.error('Boot error:', e);
        toast('App load nahi hua. Refresh karo.');
      }
    } else {
      document.getElementById('page-login').style.display='';
      document.getElementById('app').classList.add('hidden');
    }
  });
  bindAll();
});

// ================================================================
//  NAVIGATION
// ================================================================
function goTo(page) {
  if(page==='settings' && S.role!=='owner') { toast('⚠️ Sirf Owner ke liye!'); return; }
  S.page = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('pg-'+page)?.classList.add('active');
  document.querySelector(`.nav-btn[data-nav="${page}"]`)?.classList.add('active');
  document.getElementById('main').scrollTop=0;
  if(page==='dashboard') loadDash();
  else if(page==='customers') loadCusts();
  else if(page==='settings') loadSettings();
}

async function openDetail(custId, custName) {
  S.activeCustId=custId; S.activeCustName=custName;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('pg-detail').classList.add('active');
  document.getElementById('main').scrollTop=0;
  document.getElementById('d-name').textContent=custName;
  // Contact info
  const c=S.customers.find(x=>x.id===custId)||await DB.getCustomer(custId);
  const parts=[];
  if(c?.phone)   parts.push('📞 '+c.phone);
  if(c?.address) parts.push('📍 '+esc(c.address));
  document.getElementById('d-contact').innerHTML=parts.length
    ? parts.join('<br>')
    : '<em style="color:var(--text3)">Contact info nahi hai</em>';
  await refreshDetail();
}

async function refreshDetail() {
  document.getElementById('txn-list').innerHTML='<div class="loading">Loading...</div>';
  const txns=await DB.getCustomerTxns(S.activeCustId);
  const b=DB.calcBalance(txns);
  S.activeOutstanding=b.outstanding;
  document.getElementById('b-gold').textContent=fmtGold(b.totalGoldGrams);
  document.getElementById('b-paid').textContent=fmt(b.totalPaid);
  const outEl=document.getElementById('b-out');
  outEl.textContent=fmt(b.outstanding);
  outEl.style.color=b.outstanding>0?'var(--danger)':'var(--success)';
  renderTxns(txns);
}

// ================================================================
//  LIVE CLOCK
// ================================================================
function startClock() {
  function tick() {
    const n=nowIST();
    const ts=fmtTimeSec(n), td=fmtFullDate(n);
    // Top bar
    const tt=document.getElementById('tb-time'), td2=document.getElementById('tb-date');
    if(tt) tt.textContent=ts;
    if(td2) td2.textContent=td;
    // Login page
    const lt=document.getElementById('lc-time'), ld=document.getElementById('lc-date');
    if(lt) lt.textContent=ts;
    if(ld) ld.textContent=fmtDate(n);
    // Modal auto-dt previews
    const dtStr=fmtDate(n)+', '+fmtTime(n);
    const t=document.getElementById('t-dt'), p=document.getElementById('p-dt');
    if(t) t.textContent=dtStr;
    if(p) p.textContent=dtStr;
  }
  tick();
  setInterval(tick,1000);
}

// ================================================================
//  THEME
// ================================================================
function applyTheme(th) {
  document.documentElement.setAttribute('data-theme',th);
  localStorage.setItem('gm-theme',th);
  const btn=document.getElementById('theme-btn');
  if(btn) btn.textContent=th==='dark'?'🌙':'☀️';
  const meta=document.getElementById('meta-theme');
  if(meta) meta.content=th==='dark'?'#0F0F14':'#F5F0E8';
}

// ================================================================
//  DASHBOARD
// ================================================================
async function loadDash() {
  document.getElementById('role-badge').textContent=S.role==='owner'?'Owner':'Staff';
  document.getElementById('s-out').textContent='...';
  document.getElementById('top-udhaar').innerHTML='<div class="loading">Loading...</div>';
  try {
    S.customers=await DB.getCustomers();
    const st=await DB.getDashStats(S.customers);
    document.getElementById('s-out').textContent=fmt(st.totalOut);
    document.getElementById('s-cust').textContent=st.totalCustomers;
    document.getElementById('s-month').textContent=fmt(st.monthRev);
    document.getElementById('s-gold').textContent=fmtGold(st.yearGold);
    const top=Object.entries(st.custBals)
      .filter(([,b])=>b.outstanding>0)
      .sort((a,b)=>b[1].outstanding-a[1].outstanding)
      .slice(0,5);
    const el=document.getElementById('top-udhaar');
    if(!top.length) {
      el.innerHTML='<div class="empty"><span class="empty-ico">✅</span><div class="empty-txt">Sabka hisaab saaf hai!</div></div>';
      return;
    }
    el.innerHTML=top.map(([id,b],i)=>`
      <div class="ud-item" onclick="openDetail('${id}','${esc(b.name)}')">
        <span class="ud-rank">${i+1}.</span>
        <span class="ud-name">${esc(b.name)}</span>
        <span class="ud-amt">${fmt(b.outstanding)}</span>
      </div>`).join('');
  } catch(e) {
    console.error(e);
    document.getElementById('s-out').textContent='Error';
    toast('Dashboard load nahi hua. Refresh karo.');
  }
}

// ================================================================
//  CUSTOMERS
// ================================================================
async function loadCusts() {
  document.getElementById('cust-list').innerHTML='<div class="loading">Loading...</div>';
  try {
    S.customers=await DB.getCustomers();
    renderCusts();
  } catch(e) {
    document.getElementById('cust-list').innerHTML='<div class="loading">Load error. Refresh karo.</div>';
  }
}

function renderCusts() {
  const container=document.getElementById('cust-list');
  const q=(document.getElementById('cust-search')?.value||'').toLowerCase().trim();
  const filtered=q ? S.customers.filter(c=>c.name.toLowerCase().includes(q)) : S.customers;
  if(!filtered.length) {
    container.innerHTML=`<div class="empty"><span class="empty-ico">${q?'🔍':'👥'}</span><div class="empty-txt">${q?'Koi customer nahi mila.':'Koi customer nahi. + Add se banao!'}</div></div>`;
    return;
  }
  // Group A-Z
  const grps={};
  filtered.forEach(c=>{ const l=(c.name[0]||'?').toUpperCase(); if(!grps[l]) grps[l]=[]; grps[l].push(c); });
  let html='';
  Object.keys(grps).sort().forEach(letter=>{
    html+=`<div class="alpha-grp"><div class="alpha-ltr">${letter}</div>`;
    grps[letter].forEach(c=>{
      html+=`<div class="cust-item" onclick="openDetail('${c.id}','${esc(c.name)}')">
        <div class="ci-left">
          <div class="cust-av">${initials(c.name)}</div>
          <div>
            <div class="ci-name">${esc(c.name)}</div>
            <div class="ci-phone">${c.phone||'Phone nahi'}</div>
          </div>
        </div>
        <div class="ci-right" id="cb-${c.id}"><div style="color:var(--text3);font-size:13px">...</div></div>
      </div>`;
    });
    html+='</div>';
  });
  container.innerHTML=html;
  // Load balances in background
  filtered.forEach(c=>{
    DB.getCustomerTxns(c.id).then(txns=>{
      const b=DB.calcBalance(txns);
      const el=document.getElementById('cb-'+c.id);
      if(!el) return;
      el.innerHTML=b.outstanding<=0
        ? '<div class="c-green">✅</div><div class="ci-sub">Clear</div>'
        : `<div class="ci-bal c-red">${fmt(b.outstanding)}</div><div class="ci-sub">Udhaar</div>`;
    }).catch(()=>{});
  });
}

// ================================================================
//  RENDER TRANSACTIONS
// ================================================================
function renderTxns(txns) {
  const container=document.getElementById('txn-list');
  if(!txns.length) {
    container.innerHTML='<div class="empty"><span class="empty-ico">📋</span><div class="empty-txt">Koi transaction nahi abhi</div></div>';
    return;
  }
  container.innerHTML=txns.map(t=>{
    const isSale=t.type==='sale', isPayment=t.type==='payment', isOwner=S.role==='owner';
    const txnBal=isSale?(t.totalAmount||0)-(t.amountPaid||0):0;
    let details='';
    if(isSale){
      details=`<div class="txn-details">
        <span>⚖️ ${t.goldWeight}${t.goldUnit==='tola'?' tola':'g'}</span>
        <span>💰 ${fmt(t.totalAmount)}</span>
        <span>✅ Paid: ${fmt(t.amountPaid)}</span>
        <span>💳 ${cap(t.paymentMode||'cash')}</span>
      </div>`;
    } else {
      details=`<div class="txn-details">
        <span>✅ Received: ${fmt(t.amountPaid)}</span>
        <span>💳 ${cap(t.paymentMode||'cash')}</span>
      </div>`;
    }
    const notes=t.notes?`<div class="txn-notes">📝 ${esc(t.notes)}</div>`:'';
    const chip=isSale
      ?`<span class="chip ${txnBal>0?'chip-due':'chip-clr'}">${txnBal>0?'Due: '+fmt(txnBal):'Fully Paid ✅'}</span>`:'';
    const hideBtn=isOwner
      ?`<button class="txn-hide" onclick="toggleHide('${t.id}',${t.hidden})">${t.hidden?'👁️ Show':'🙈 Hide'}</button>`:'';
    return `<div class="txn-card${t.hidden?' is-hidden':''}">
      <div class="txn-top">
        <div class="txn-title">${isSale?esc(t.itemDescription||'Sale'):'💰 Payment Received'}</div>
        <span class="txn-badge ${isSale?'badge-sale':'badge-payment'}">${isSale?'Sale':'Payment'}</span>
      </div>
      ${details}${notes}
      <div class="txn-foot">
        <span class="txn-dt">📅 ${t.dateIST||'—'} ${t.timeIST||''}${t.createdByName?' · '+esc(t.createdByName):''}${t.hidden?' · <em>Hidden</em>':''}</span>
        <div class="txn-fr">${chip}${hideBtn}</div>
      </div>
    </div>`;
  }).join('');
}

async function toggleHide(txnId, isHidden) {
  if(!isHidden && !confirm('Transaction hide karna chahte ho? Data delete nahi hoga.')) return;
  try {
    isHidden ? await DB.unhideTxn(txnId) : await DB.hideTxn(txnId);
    await refreshDetail();
    toast(isHidden?'Transaction wapas dikhaya ✅':'Transaction hide ho gaya');
  } catch(e) { toast('Error: '+e.message); }
}

// ================================================================
//  MODALS
// ================================================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); document.body.style.overflow='hidden'; }
function closeModals() { document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')); document.body.style.overflow=''; }

function openTxnModal() {
  clearErr('err-txn');
  ['t-item','t-notes'].forEach(id=>document.getElementById(id).value='');
  ['t-weight','t-total','t-paid'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('t-bal-preview').classList.add('hidden');
  openModal('modal-txn');
}

function openPayModal() {
  clearErr('err-pay');
  document.getElementById('p-amount').value='';
  document.getElementById('p-notes').value='';
  document.getElementById('p-curr-out').textContent=fmt(S.activeOutstanding);
  openModal('modal-pay');
}

// ================================================================
//  SAVE OPERATIONS
// ================================================================
async function saveCust() {
  clearErr('err-cust');
  const name=document.getElementById('cn-name').value.trim();
  const phone=document.getElementById('cn-phone').value.trim();
  const addr=document.getElementById('cn-addr').value.trim();
  if(!name) return showErr('err-cust','Customer ka naam zaroori hai!');
  if(phone && !/^\d{10}$/.test(phone)) return showErr('err-cust','Phone 10 digits ka hona chahiye!');
  btnLoad('sv-cust-btn');
  try {
    await DB.addCustomer(name,phone,addr);
    closeModals();
    ['cn-name','cn-phone','cn-addr'].forEach(id=>document.getElementById(id).value='');
    toast('Customer add ho gaya! ✅');
    if(S.page==='customers') loadCusts(); else loadDash();
  } catch(e) { showErr('err-cust', fbErr(e.code)||e.message); }
  btnReset('sv-cust-btn');
}

async function saveTxn() {
  clearErr('err-txn');
  const item=document.getElementById('t-item').value.trim();
  const weight=parseFloat(document.getElementById('t-weight').value);
  const unit=document.getElementById('t-unit').value;
  const total=parseFloat(document.getElementById('t-total').value);
  const paid=parseFloat(document.getElementById('t-paid').value)||0;
  const mode=document.getElementById('t-mode').value;
  const notes=document.getElementById('t-notes').value.trim();
  if(!item) return showErr('err-txn','Item description zaroori hai!');
  if(!weight||isNaN(weight)||weight<=0) return showErr('err-txn','Gold weight daalo!');
  if(!total||isNaN(total)||total<=0) return showErr('err-txn','Total amount daalo!');
  if(paid<0) return showErr('err-txn','Amount paid negative nahi ho sakta!');
  if(paid>total) return showErr('err-txn',`Paid amount (${fmt(paid)}) total (${fmt(total)}) se zyada nahi ho sakta!`);
  btnLoad('sv-txn-btn');
  try {
    await DB.addTransaction(S.activeCustId,'sale',{
      itemDescription:item, goldWeight:weight, goldUnit:unit,
      totalAmount:total, amountPaid:paid, paymentMode:mode, notes
    });
    closeModals();
    toast('Transaction save ho gaya! ✅');
    await refreshDetail();
  } catch(e) { showErr('err-txn',e.message); }
  btnReset('sv-txn-btn');
}

async function savePay() {
  clearErr('err-pay');
  const amount=parseFloat(document.getElementById('p-amount').value);
  const mode=document.getElementById('p-mode').value;
  const notes=document.getElementById('p-notes').value.trim();
  if(!amount||isNaN(amount)||amount<=0) return showErr('err-pay','Amount daalo!');
  if(amount>S.activeOutstanding+0.01)
    return showErr('err-pay',`Amount (${fmt(amount)}) outstanding (${fmt(S.activeOutstanding)}) se zyada hai! Sahi amount daalo.`);
  btnLoad('sv-pay-btn');
  try {
    await DB.addTransaction(S.activeCustId,'payment',{amountPaid:amount,paymentMode:mode,notes});
    closeModals();
    toast('Payment record ho gaya! ✅');
    await refreshDetail();
  } catch(e) { showErr('err-pay',e.message); }
  btnReset('sv-pay-btn');
}

// ================================================================
//  SETTINGS
// ================================================================
async function loadSettings() {
  S.shopSettings=await DB.getShopSettings();
  document.getElementById('s-sname').value=S.shopSettings.shopName||'';
  document.getElementById('s-oname').value=S.shopSettings.ownerName||'';
  document.getElementById('s-addr').value=S.shopSettings.address||'';
  document.getElementById('s-phone').value=S.shopSettings.phone||'';
  document.getElementById('s-gst').value=S.shopSettings.gst||'';
  document.getElementById('s-watemplate').value=S.shopSettings.waTemplate||'';
  // Load staff
  loadStaffList();
  // Load archive
  loadArchiveList();
}

async function saveSettings() {
  const data={
    shopName: document.getElementById('s-sname').value.trim(),
    ownerName:document.getElementById('s-oname').value.trim(),
    address:  document.getElementById('s-addr').value.trim(),
    phone:    document.getElementById('s-phone').value.trim(),
    gst:      document.getElementById('s-gst').value.trim(),
    waTemplate:document.getElementById('s-watemplate').value.trim()
  };
  if(!data.shopName) return toast('Dukaan ka naam zaroori hai!');
  btnLoad('save-settings-btn');
  try {
    await DB.saveShopSettings(data);
    S.shopSettings=data;
    document.getElementById('tb-shop').textContent=data.shopName;
    document.title=data.shopName;
    toast('Settings save ho gayi! ✅');
  } catch(e) { toast('Save error: '+e.message); }
  btnReset('save-settings-btn');
}

async function loadStaffList() {
  document.getElementById('staff-list').innerHTML='<div class="loading">Loading...</div>';
  try {
    const staff=await DB.getStaff();
    if(!staff.length) {
      document.getElementById('staff-list').innerHTML='<div class="loading">Koi staff nahi abhi. + Add Staff se banao.</div>';
      return;
    }
    document.getElementById('staff-list').innerHTML=staff.map(m=>`
      <div class="staff-card">
        <div>
          <div class="staff-name">${esc(m.name)}</div>
          <div class="staff-email">${esc(m.email)}</div>
        </div>
        <span class="role-badge" style="color:var(--text2);border-color:var(--bdr)">Staff</span>
      </div>`).join('');
  } catch(e) {
    document.getElementById('staff-list').innerHTML='<div class="loading">Load error.</div>';
  }
}

async function saveStaff() {
  clearErr('err-staff');
  const name=document.getElementById('st-name').value.trim();
  const email=document.getElementById('st-email').value.trim();
  const pass=document.getElementById('st-pass').value;
  if(!name) return showErr('err-staff','Naam zaroori hai!');
  if(!email) return showErr('err-staff','Email zaroori hai!');
  if(!pass||pass.length<6) return showErr('err-staff','Password kam se kam 6 characters!');
  btnLoad('sv-staff-btn');
  try {
    await Auth.createStaff(name,email,pass);
    closeModals();
    ['st-name','st-email','st-pass'].forEach(id=>document.getElementById(id).value='');
    toast('Staff member add ho gaya! ✅');
    loadStaffList();
  } catch(e) { showErr('err-staff', fbErr(e.code)||e.message); }
  btnReset('sv-staff-btn');
}

async function loadArchiveList() {
  const el=document.getElementById('arch-list');
  el.innerHTML='<div class="loading">Loading...</div>';
  try {
    const meta=await DB.getArchiveMeta();
    if(!meta.length) { el.innerHTML='<div class="loading">Koi archive nahi abhi.</div>'; return; }
    el.innerHTML=meta.map(m=>`
      <div class="arch-card">
        <div>
          <strong>${m.year}</strong>
          <div style="font-size:12px;color:var(--text2)">${m.count||'?'} transactions</div>
        </div>
        <button class="btn-sec btn-sm" onclick="exportArchive(${m.year})">⬇️ Export</button>
      </div>`).join('');
  } catch(e) {
    el.innerHTML='<div class="loading">Load error.</div>';
  }
}

async function doExport() {
  toast('Exporting...');
  try {
    const rows=await DB.getExportRows(APP.currentYear);
    if(!rows.length) { toast('Koi data nahi is saal!'); return; }
    const ws=XLSX.utils.json_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,`${APP.currentYear} Transactions`);
    XLSX.writeFile(wb,`GoldManager_${APP.currentYear}.xlsx`);
    toast('Excel download ho gayi! ✅');
  } catch(e) { toast('Export error: '+e.message); }
}

async function exportArchive(year) {
  toast('Exporting '+year+'...');
  try {
    const rows=await DB.getArchiveExportRows(year);
    if(!rows.length) { toast('Koi data nahi '+year+' mein!'); return; }
    const ws=XLSX.utils.json_to_sheet(rows);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,`${year} Archive`);
    XLSX.writeFile(wb,`GoldManager_Archive_${year}.xlsx`);
    toast(year+' archive export ho gaya! ✅');
  } catch(e) { toast('Export error: '+e.message); }
}

async function doArchive() {
  const year=APP.currentYear;
  if(!confirm(`${year} ka data archive karna chahte ho?\n\n✅ Outstanding balances carry forward honge.\n✅ ${year} ka data archive folder mein safe rahega.\n✅ New ${year+1} ka record shuru ho jaayega.\n\nPehle Excel export kar lo backup ke liye!`)) return;
  toast('Archiving... thodi der rukao...');
  try {
    const custs=await DB.getCustomers();
    await DB.archiveYear(year,custs);
    toast(`${year} archive ho gaya! ${year+1} shuru ✅`);
    loadArchiveList();
  } catch(e) { toast('Archive error: '+e.message); }
}

// ================================================================
//  WHATSAPP
// ================================================================
function sendWA() {
  const ph=S.customers.find(c=>c.id===S.activeCustId)?.phone;
  if(!ph) { toast('Customer ka phone number nahi hai!'); return; }
  const template=S.shopSettings.waTemplate||'Namaste {customerName}! Outstanding: {outstanding}';
  const msg=template
    .replace('{customerName}',S.activeCustName||'')
    .replace('{outstanding}',fmt(S.activeOutstanding))
    .replace('{shopName}',S.shopSettings.shopName||'Gold Manager');
  window.open(`https://wa.me/91${ph}?text=${encodeURIComponent(msg)}`,'_blank');
}

// ================================================================
//  RECEIPT (simple print)
// ================================================================
function printReceipt() {
  const shop=S.shopSettings;
  const w=window.open('','_blank','width=400,height=600');
  const txnEl=document.getElementById('txn-list').innerHTML;
  w.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body{font-family:sans-serif;padding:20px;max-width:380px;margin:0 auto;}
      h2{text-align:center;margin-bottom:4px;}
      .sub{text-align:center;color:#666;font-size:13px;margin-bottom:16px;}
      .row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:14px;}
      .bold{font-weight:bold;}
      hr{border:none;border-top:1px dashed #ccc;margin:12px 0;}
      .danger{color:#c0392b;font-weight:bold;}
      @media print{button{display:none}}
    </style>
    </head><body>
    <h2>💎 ${esc(shop.shopName||'Gold Manager')}</h2>
    <div class="sub">
      ${esc(shop.address||'')}${shop.phone?'<br>📞 '+esc(shop.phone):''}
      ${shop.gst?'<br>GST: '+esc(shop.gst):''}
    </div>
    <hr>
    <div class="row bold"><span>Customer:</span><span>${esc(S.activeCustName)}</span></div>
    <div class="row"><span>Date:</span><span>${fmtDate(nowIST())}</span></div>
    <hr>
    <div class="row"><span>Total Paid:</span><span>${document.getElementById('b-paid').textContent}</span></div>
    <div class="row"><span class="danger">Outstanding:</span><span class="danger">${document.getElementById('b-out').textContent}</span></div>
    <hr>
    <button onclick="window.print()" style="width:100%;padding:10px;background:#C8981E;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;margin-bottom:10px;">🖨️ Print</button>
    <div style="text-align:center;font-size:11px;color:#aaa;margin-top:8px;">Generated by Gold Manager</div>
    </body></html>`);
  w.document.close();
}

// ================================================================
//  BIND ALL EVENTS  (called once on boot)
// ================================================================
function bindAll() {

  // ---- LOGIN ----
  document.getElementById('login-form').addEventListener('submit', async e=>{
    e.preventDefault();
    clearErr('login-err');
    const email=document.getElementById('l-email').value.trim();
    const pass=document.getElementById('l-pass').value;
    if(!email||!pass) return showErr('login-err','Email aur password dono daalo!');
    btnLoad('login-btn','Logging in...');
    try { await Auth.login(email,pass); }
    catch(e) { showErr('login-err', fbErr(e.code)||e.message); btnReset('login-btn'); }
  });

  // ---- PASSWORD TOGGLE ----
  document.getElementById('eye-btn').addEventListener('click',()=>{
    const inp=document.getElementById('l-pass');
    inp.type=inp.type==='password'?'text':'password';
  });

  // ---- FORGOT PASSWORD ----
  document.getElementById('forgot-link').addEventListener('click',async e=>{
    e.preventDefault();
    const email=document.getElementById('l-email').value.trim();
    if(!email) return showErr('login-err','Pehle email daalo!');
    try {
      await Auth.forgotPassword(email);
      toast('Password reset email bhej di! Inbox check karo.');
    } catch(er) { showErr('login-err', fbErr(er.code)||er.message); }
  });

  // ---- LOGOUT ----
  document.getElementById('logout-btn').addEventListener('click',()=>{
    if(confirm('Logout karna chahte ho?')) Auth.logout();
  });

  // ---- THEME ----
  document.getElementById('theme-btn').addEventListener('click',()=>{
    const cur=document.documentElement.getAttribute('data-theme')||'dark';
    applyTheme(cur==='dark'?'light':'dark');
  });

  // ---- BOTTOM NAV ----
  document.querySelectorAll('.nav-btn[data-nav]').forEach(btn=>{
    btn.addEventListener('click',()=>goTo(btn.dataset.nav));
  });

  // ---- CENTER + BUTTON ----
  document.getElementById('nav-add').addEventListener('click',()=>{
    if(S.page==='detail') openTxnModal();
    else openModal('modal-quick');
  });

  // ---- BACK BUTTON ----
  document.getElementById('back-btn').addEventListener('click',()=>goTo('customers'));

  // ---- WHATSAPP ----
  document.getElementById('wa-btn').addEventListener('click',sendWA);

  // ---- ADD CUSTOMER NAV ----
  document.getElementById('add-cust-btn').addEventListener('click',()=>{
    clearErr('err-cust'); openModal('modal-cust');
  });

  // ---- TRANSACTION BUTTONS ----
  document.getElementById('add-txn-btn').addEventListener('click',openTxnModal);
  document.getElementById('add-pay-btn').addEventListener('click',openPayModal);
  document.getElementById('receipt-btn').addEventListener('click',printReceipt);

  // ---- SAVE BUTTONS ----
  document.getElementById('sv-cust-btn').addEventListener('click',saveCust);
  document.getElementById('sv-txn-btn').addEventListener('click',saveTxn);
  document.getElementById('sv-pay-btn').addEventListener('click',savePay);
  document.getElementById('save-settings-btn').addEventListener('click',saveSettings);
  document.getElementById('sv-staff-btn').addEventListener('click',saveStaff);

  // ---- CUSTOMER SEARCH ----
  document.getElementById('cust-search').addEventListener('input', renderCusts);

  // ---- TRANSACTION BALANCE PREVIEW ----
  ['t-total','t-paid'].forEach(id=>{
    document.getElementById(id).addEventListener('input',()=>{
      const total=parseFloat(document.getElementById('t-total').value)||0;
      const paid=parseFloat(document.getElementById('t-paid').value)||0;
      const preview=document.getElementById('t-bal-preview');
      const val=document.getElementById('t-bal-val');
      if(total>0) {
        preview.classList.remove('hidden');
        const bal=total-paid;
        val.textContent=fmt(bal>0?bal:0);
        val.style.color=bal>0?'var(--warn)':'var(--success)';
      } else { preview.classList.add('hidden'); }
    });
  });

  // ---- CLOSE MODALS (overlay click or X button) ----
  document.querySelectorAll('.mo').forEach(o=>o.addEventListener('click',closeModals));
  document.querySelectorAll('.mc-btn').forEach(b=>b.addEventListener('click',closeModals));

  // ---- QUICK ADD MODAL ----
  document.getElementById('q-cust').addEventListener('click',()=>{ closeModals(); setTimeout(()=>{ clearErr('err-cust'); openModal('modal-cust'); },100); });
  document.getElementById('q-txn').addEventListener('click',()=>{
    closeModals();
    // If not on detail page, go to customers first
    if(!S.activeCustId) { toast('Pehle koi customer select karo!'); goTo('customers'); return; }
    setTimeout(openTxnModal,100);
  });
  document.getElementById('q-pay').addEventListener('click',()=>{
    closeModals();
    if(!S.activeCustId) { toast('Pehle koi customer select karo!'); goTo('customers'); return; }
    setTimeout(openPayModal,100);
  });

  // ---- ADD STAFF BUTTON ----
  document.getElementById('add-staff-btn').addEventListener('click',()=>{
    clearErr('err-staff'); openModal('modal-staff');
  });

  // ---- SETTINGS TABS ----
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-'+btn.dataset.tab)?.classList.add('active');
    });
  });

  // ---- EXPORT / ARCHIVE (Owner only) ----
  document.getElementById('export-btn').addEventListener('click',doExport);
  document.getElementById('archive-btn').addEventListener('click',doArchive);

  // ---- KEYBOARD ESC CLOSES MODAL ----
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModals(); });
}
