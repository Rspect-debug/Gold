// ================================================================
//  HELPERS.JS  —  Utility functions (change mat karo)
// ================================================================

// ---- IST Date/Time ----
function nowIST() {
  const n = new Date();
  return new Date(n.getTime() + (n.getTimezoneOffset() + 330) * 60000);
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d)     { return `${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()}`; }
function fmtTime(d)     { let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${m} ${ap}`; }
function fmtTimeSec(d)  { let h=d.getHours(),m=String(d.getMinutes()).padStart(2,'0'),s=String(d.getSeconds()).padStart(2,'0'),ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${m}:${s} ${ap}`; }
function fmtFullDate(d) { return `${DAY[d.getDay()]}, ${fmtDate(d)}`; }

// ---- Currency ----
function fmt(n) {
  if(n===null||n===undefined||isNaN(n)) return APP.currency+'0';
  return APP.currency + Math.round(n).toLocaleString('en-IN');
}

// ---- Gold Weight ----
function toGrams(w, unit) { return unit==='tola' ? w*11.6638 : w; }
function fmtGold(g)       { if(!g) return '0g'; return (Math.round(g*100)/100)+'g'; }

// ---- String ----
function esc(s) {
  if(!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function initials(name) {
  if(!name) return '?';
  const p = name.trim().split(' ').filter(Boolean);
  return p.length===1 ? p[0][0].toUpperCase() : (p[0][0]+p[p.length-1][0]).toUpperCase();
}
function cap(s) { if(!s) return ''; return s[0].toUpperCase()+s.slice(1); }

// ---- UI ----
function toast(msg, ms=3000) {
  const old = document.getElementById('gm-toast');
  if(old) old.remove();
  const t = document.createElement('div');
  t.id='gm-toast'; t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{ if(t.parentNode) t.remove(); }, ms);
}
function showErr(id, msg) { const e=document.getElementById(id); if(!e) return; e.textContent=msg; e.classList.remove('hidden'); }
function clearErr(id)     { const e=document.getElementById(id); if(!e) return; e.textContent=''; e.classList.add('hidden'); }
function btnLoad(id, txt='Saving...') { const b=document.getElementById(id); if(!b) return; b.disabled=true; b._t=b.textContent; b.textContent=txt; }
function btnReset(id)                 { const b=document.getElementById(id); if(!b) return; b.disabled=false; if(b._t) b.textContent=b._t; }

// ---- Firebase error messages ----
function fbErr(code) {
  const m = {
    'auth/user-not-found':        'Email nahi mila!',
    'auth/wrong-password':        'Password galat hai!',
    'auth/invalid-credential':    'Email ya password galat hai!',
    'auth/invalid-email':         'Email format sahi nahi!',
    'auth/too-many-requests':     'Zyada attempts! Thodi der baad try karo.',
    'auth/network-request-failed':'Internet check karo!',
    'auth/email-already-in-use':  'Ye email already use ho rahi hai!',
    'auth/weak-password':         'Password kam se kam 6 characters ka hona chahiye!',
  };
  return m[code] || 'Kuch error hua. Please try again.';
}
