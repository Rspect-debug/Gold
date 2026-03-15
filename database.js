// ================================================================
//  DATABASE.JS  —  All Firebase/Firestore operations
// ================================================================

const DB = {

  // ---- SETTINGS ----
  async getShopSettings() {
    try {
      const d = await db.collection('settings').doc('shop').get();
      if(d.exists) return d.data();
    } catch(e){}
    return {
      shopName:'Gold Manager', ownerName:'', address:'', phone:'', gst:'',
      waTemplate:'Namaste {customerName} ji! Aapka outstanding balance {shopName} mein {outstanding} hai. Kripya jald payment karein.'
    };
  },
  async saveShopSettings(data) {
    await db.collection('settings').doc('shop').set(data, {merge:true});
  },

  // ---- CUSTOMERS ----
  async addCustomer(name, phone, address) {
    const r = await db.collection('customers').add({
      name:name.trim(), phone:phone.trim(), address:address.trim(),
      createdAt:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:auth.currentUser?.uid||''
    });
    return r.id;
  },
  async getCustomers() {
    const s = await db.collection('customers').orderBy('name','asc').get();
    return s.docs.map(d=>({id:d.id,...d.data()}));
  },
  async getCustomer(id) {
    const d = await db.collection('customers').doc(id).get();
    return d.exists ? {id:d.id,...d.data()} : null;
  },

  // ---- TRANSACTIONS ----
  async addTransaction(customerId, type, fields) {
    const now = nowIST();
    const r = await db.collection('transactions').add({
      customerId, type, hidden:false,
      year:now.getFullYear(),
      dateIST:fmtDate(now), timeIST:fmtTime(now),
      timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      createdBy:auth.currentUser?.uid||'',
      createdByName:S.userName||'',
      ...fields
    });
    return r.id;
  },
  async getCustomerTxns(customerId) {
    const s = await db.collection('transactions')
      .where('customerId','==',customerId)
      .orderBy('timestamp','desc').get();
    return s.docs.map(d=>({id:d.id,...d.data()}));
  },
  async hideTxn(id)   { await db.collection('transactions').doc(id).update({hidden:true}); },
  async unhideTxn(id) { await db.collection('transactions').doc(id).update({hidden:false}); },

  // ---- BALANCE (calculated from transactions — no rounding issues) ----
  calcBalance(txns) {
    let sale=0, paid=0, gold=0;
    for(const t of txns) {
      if(t.hidden) continue;
      if(t.type==='sale') {
        sale += t.totalAmount||0;
        paid += t.amountPaid||0;
        gold += toGrams(t.goldWeight||0, t.goldUnit||'grams');
      } else if(t.type==='payment') {
        paid += t.amountPaid||0;
      }
    }
    return { outstanding:sale-paid, totalSale:sale, totalPaid:paid, totalGoldGrams:Math.round(gold*100)/100 };
  },

  // ---- DASHBOARD STATS ----
  async getDashStats(customers) {
    const curYear  = APP.currentYear;
    const curMonth = nowIST().getMonth();
    const snap = await db.collection('transactions')
      .where('year','==',curYear).where('hidden','==',false).get();
    const allTxns = snap.docs.map(d=>({id:d.id,...d.data()}));

    // Per-customer balances
    const custBals = {};
    for(const c of customers) {
      const txns = await DB.getCustomerTxns(c.id);
      const b    = DB.calcBalance(txns);
      custBals[c.id] = {name:c.name, outstanding:b.outstanding};
    }

    let totalOut=0, yearGold=0, monthRev=0;
    for(const cb of Object.values(custBals)) {
      if(cb.outstanding>0) totalOut+=cb.outstanding;
    }
    for(const t of allTxns) {
      if(t.type==='sale') {
        yearGold += toGrams(t.goldWeight||0, t.goldUnit||'grams');
        if(t.timestamp) {
          const ist = new Date(t.timestamp.toDate().getTime()+(t.timestamp.toDate().getTimezoneOffset()+330)*60000);
          if(ist.getMonth()===curMonth) monthRev += t.totalAmount||0;
        }
      }
    }
    return { totalOut, totalCustomers:customers.length, monthRev, yearGold:Math.round(yearGold*100)/100, custBals };
  },

  // ---- STAFF ----
  async getStaff() {
    const s = await db.collection('users').where('role','==','staff').get();
    return s.docs.map(d=>({id:d.id,...d.data()}));
  },
  async getUserRole(uid) {
    const d = await db.collection('users').doc(uid).get();
    return d.exists ? (d.data().role||'staff') : 'staff';
  },
  async getUserName(uid) {
    const d = await db.collection('users').doc(uid).get();
    return d.exists ? (d.data().name||'') : '';
  },

  // ---- EXPORT ----
  async getExportRows(year) {
    const custs = await DB.getCustomers();
    const cm = {}; custs.forEach(c=>cm[c.id]=c);
    const s = await db.collection('transactions').where('year','==',year).orderBy('timestamp','asc').get();
    return s.docs.map(d=>{
      const t=d.data(), c=cm[t.customerId]||{};
      return {
        'Date':t.dateIST||'', 'Time':t.timeIST||'',
        'Customer':c.name||'?', 'Phone':c.phone||'',
        'Type':t.type==='sale'?'Sale':'Payment',
        'Item':t.itemDescription||'',
        'Gold Weight':t.type==='sale'?`${t.goldWeight} ${t.goldUnit}`:'',
        'Total (₹)':t.totalAmount||'', 'Paid (₹)':t.amountPaid||0,
        'Balance (₹)':t.type==='sale'?(t.totalAmount||0)-(t.amountPaid||0):'',
        'Mode':t.paymentMode||'', 'Notes':t.notes||'',
        'Staff':t.createdByName||'', 'Hidden':t.hidden?'Yes':'No'
      };
    });
  },

  // ---- ARCHIVE ----
  async archiveYear(year, customers) {
    const snap = await db.collection('transactions').where('year','==',year).get();
    const batch = db.batch();

    // Copy to archives
    snap.docs.forEach(d=>{
      const ref = db.collection('archives').doc(String(year)).collection('transactions').doc(d.id);
      batch.set(ref, d.data());
    });

    // Carry forward outstanding balances
    const newYear = year+1;
    for(const c of customers) {
      const txns = await DB.getCustomerTxns(c.id);
      const b = DB.calcBalance(txns);
      if(b.outstanding>0) {
        const n = nowIST();
        batch.set(db.collection('transactions').doc(), {
          customerId:c.id, type:'sale',
          itemDescription:`Carry Forward from ${year}`,
          goldWeight:0, goldUnit:'grams',
          totalAmount:b.outstanding, amountPaid:0,
          paymentMode:'carry-forward', notes:`${year} ka baaki balance`,
          hidden:false, year:newYear,
          dateIST:fmtDate(n), timeIST:fmtTime(n),
          timestamp:firebase.firestore.FieldValue.serverTimestamp(),
          createdBy:auth.currentUser?.uid||'', createdByName:'System'
        });
      }
    }

    // Delete original transactions
    snap.docs.forEach(d=>batch.delete(d.ref));

    // Save archive metadata
    batch.set(db.collection('settings').doc('archive-meta'), {
      [String(year)]: { archivedAt:firebase.firestore.FieldValue.serverTimestamp(), count:snap.size }
    }, {merge:true});

    await batch.commit();
    APP.currentYear = newYear;
  },

  async getArchiveMeta() {
    const d = await db.collection('settings').doc('archive-meta').get();
    if(!d.exists) return [];
    return Object.keys(d.data())
      .map(y=>({year:parseInt(y),...d.data()[y]}))
      .sort((a,b)=>b.year-a.year);
  },
  async getArchiveExportRows(year) {
    const custs = await DB.getCustomers();
    const cm = {}; custs.forEach(c=>cm[c.id]=c);
    const s = await db.collection('archives').doc(String(year)).collection('transactions').orderBy('timestamp','asc').get();
    return s.docs.map(d=>{
      const t=d.data(), c=cm[t.customerId]||{};
      return {
        'Date':t.dateIST||'','Time':t.timeIST||'','Customer':c.name||'?',
        'Type':t.type==='sale'?'Sale':'Payment','Item':t.itemDescription||'',
        'Gold':t.type==='sale'?`${t.goldWeight} ${t.goldUnit}`:'',
        'Total':t.totalAmount||'','Paid':t.amountPaid||0,'Mode':t.paymentMode||''
      };
    });
  }
};
