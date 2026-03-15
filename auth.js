// ================================================================
//  AUTH.JS  —  Login, Logout, Staff Creation
// ================================================================

const Auth = {
  async login(email, password) {
    return await auth.signInWithEmailAndPassword(email, password);
  },
  async logout() {
    await auth.signOut();
    window.location.reload();
  },
  async forgotPassword(email) {
    await auth.sendPasswordResetEmail(email);
  },
  // Creates staff account without logging out owner (uses secondary app)
  async createStaff(name, email, password) {
    let app2 = null;
    try {
      app2 = firebase.initializeApp(firebase.app().options, 'staff-' + Date.now());
      const auth2 = app2.auth();
      const r = await auth2.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(r.user.uid).set({
        name:name.trim(), email:email.trim(), role:'staff',
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),
        createdBy:auth.currentUser?.uid||''
      });
      await auth2.signOut();
      return r.user.uid;
    } finally {
      if(app2) { try{ await app2.delete(); }catch(_){} }
    }
  },
  onStateChange(cb) {
    return auth.onAuthStateChanged(cb);
  }
};
