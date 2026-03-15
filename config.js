// ================================================================
//  CONFIG.JS  —  SIRF YEH FILE EDIT KARO
// ================================================================
//
//  Firebase Setup (5 minutes mein):
//  ─────────────────────────────────────────────────────────────
//  STEP 1: https://console.firebase.google.com jaao
//  STEP 2: "Add project" → naam rakho → Continue
//  STEP 3: Project banne ke baad, left sidebar → "Web" icon (</>)
//  STEP 4: App naam daalo → "Register App"
//  STEP 5: Config copy karo → neeche paste karo (YOUR_ wali jagah)
//
//  Firestore Database:
//  ─────────────────────────────────────────────────────────────
//  Left sidebar → "Firestore Database" → "Create database"
//  → "Start in test mode" → Next → Done
//
//  Authentication:
//  ─────────────────────────────────────────────────────────────
//  Left sidebar → "Authentication" → "Get started"
//  → "Email/Password" → Enable → Save
//  → "Users" tab → "Add user":
//      Email: owner ka email
//      Password: owner ka password
//  Note karo owner ka UID (users list mein dikhega)
//
//  Owner Document (Firestore mein manually):
//  ─────────────────────────────────────────────────────────────
//  Firestore → "Start collection" → ID: "users"
//  → Document ID: [owner ka UID jo upar note kiya]
//  → Fields:
//      role  (string) = "owner"
//      name  (string) = "Aapka Naam"
//      email (string) = "owner@email.com"
//  → Save
//
// ================================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDN_bhmBvpNCtuy8P9y5NzogCw5lyuRIBw",
  authDomain:        "dashboard2026-v2.firebaseapp.com",
  projectId:         "dashboard2026-v2",
  storageBucket:     "dashboard2026-v2.firebasestorage.app",
  messagingSenderId: "573017863222",
  appId:             "1:573017863222:web:e45313b7a37e12304f9497",
  measurementId:     "G-QXR3BWZ2LN"
};

// ---- Initialize (mat chhona) ----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Offline support (data cache)
db.enablePersistence({ synchronizeTabs: true })
  .catch(e => { /* ignore — works fine without it */ });

// ---- Global App Config ----
const APP = {
  currency:    "₹",
  currentYear: new Date().getFullYear(),
};
