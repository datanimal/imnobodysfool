/* Connection to the database that stores test results and sign-ups.
   Paste the two values from your Supabase project (Project Settings > API).
   The "anon public" key is designed to be visible in a web page. Never paste the "service_role" key here. */
window.NF_CONFIG = {
  SUPABASE_URL: "https://iqzxlxvtxvijusgjpqqy.supabase.co",
  SUPABASE_KEY: "sb_publishable_kVa0V7KT8QPk5UMFrsbC3Q_YsNKoN3Q"
};

/* Shared helpers: an anonymous device id, and a function that saves one row. */
(function(){
  var mem = {};
  window.NF_store = {
    get: function(k, d){ try{ var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }catch(e){ return k in mem ? mem[k] : d; } },
    set: function(k, v){ mem[k] = v; try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  };
  window.NF_anon = function(){
    var id = NF_store.get("nf_anon", null);
    if(!id){
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
         : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){ var r = Math.random()*16|0; return (c === "x" ? r : (r&3|8)).toString(16); });
      NF_store.set("nf_anon", id);
    }
    return id;
  };
  var KEY = "nf_session";
  function base(){ return window.NF_CONFIG.SUPABASE_URL.replace(/\/$/,""); }
  function on(){ var c = window.NF_CONFIG; return !!(c.SUPABASE_URL && c.SUPABASE_KEY); }
  function authCall(path, body, token){
    var k = window.NF_CONFIG.SUPABASE_KEY;
    return fetch(base() + "/auth/v1/" + path, {method:"POST",
      headers:{ "apikey":k, "Authorization":"Bearer " + (token || k), "Content-Type":"application/json" },
      body: JSON.stringify(body || {})
    }).then(function(r){ return r.text().then(function(t){ var j = {}; try{ j = t ? JSON.parse(t) : {}; }catch(e){} return {ok:r.ok, status:r.status, data:j}; }); })
      .catch(function(){ return {ok:false, status:0, data:{}}; });
  }
  function keep(d){
    var s = {access_token:d.access_token, refresh_token:d.refresh_token,
             expires_at: d.expires_at || Math.floor(Date.now()/1000) + (d.expires_in || 3600),
             email: d.user && d.user.email, user_id: d.user && d.user.id};
    NF_store.set(KEY, s); return s;
  }

  /* Sign-in by emailed code. No passwords anywhere. */
  window.NF_auth = {
    enabled: on,
    current: function(){ var s = NF_store.get(KEY, null); return s && s.access_token ? s : null; },
    sendCode: function(email){ return authCall("otp", {email: email, create_user: true}); },
    verify: function(email, code){
      return authCall("verify", {type:"email", email: email, token: code}).then(function(r){ if(r.ok && r.data.access_token) keep(r.data); return r; });
    },
    /* Resolves a valid access token, renewing it if it is about to expire, or null if signed out. */
    token: function(){
      var s = NF_auth.current();
      if(!s) return Promise.resolve(null);
      if(s.expires_at - 90 > Date.now()/1000) return Promise.resolve(s.access_token);
      return authCall("token?grant_type=refresh_token", {refresh_token: s.refresh_token}).then(function(r){
        if(r.ok && r.data.access_token) return keep(r.data).access_token;
        if(r.status >= 400 && r.status < 500) NF_store.set(KEY, null);   /* sign-in has ended */
        return null;
      });
    },
    signOut: function(){
      var s = NF_auth.current(); NF_store.set(KEY, null);
      return s ? authCall("logout", {}, s.access_token) : Promise.resolve();
    }
  };

  /* One request to the database, as the signed-in person if there is one. */
  window.NF_api = function(method, path, body, prefer){
    if(!on()) return Promise.resolve({ok:false, data:null});
    return NF_auth.token().then(function(tok){
      var k = window.NF_CONFIG.SUPABASE_KEY, h = { "apikey":k, "Authorization":"Bearer " + (tok || k), "Content-Type":"application/json" };
      if(prefer) h.Prefer = prefer;
      return fetch(base() + "/rest/v1/" + path, {method:method, headers:h, body: body ? JSON.stringify(body) : undefined});
    }).then(function(r){ return r.text().then(function(t){ var j = null; try{ j = t ? JSON.parse(t) : null; }catch(e){} return {ok:r.ok, data:j}; }); })
      .catch(function(){ return {ok:false, data:null}; });
  };

  /* Resolves true if the row was saved, false if not (including when no database is connected). */
  window.NF_save = function(table, row){
    return NF_api("POST", table, row, "return=minimal").then(function(r){ return r.ok; });
  };

  /* A signed-in person's level and seen questions follow them between devices. */
  window.NF_profile = {
    load: function(){
      if(!NF_auth.current()) return Promise.resolve();
      return NF_api("GET", "profiles?select=skill,seen").then(function(r){
        if(!r.ok || !r.data) return;
        if(r.data.length){ NF_store.set("nf_skill", Number(r.data[0].skill) || 1); NF_store.set("nf_seen", r.data[0].seen || []); }
        else return NF_profile.save();          /* first sign-in: send this device's progress up */
      });
    },
    save: function(){
      if(!NF_auth.current()) return Promise.resolve();
      return NF_api("POST", "profiles?on_conflict=user_id",
        {skill: NF_store.get("nf_skill", 1), seen: NF_store.get("nf_seen", []), updated_at: new Date().toISOString()},
        "resolution=merge-duplicates,return=minimal");
    }
  };
})();
