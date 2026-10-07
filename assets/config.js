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
  /* Resolves true if the row was saved, false if not (including when no database is connected). */
  window.NF_save = function(table, row){
    var c = window.NF_CONFIG;
    if(!c.SUPABASE_URL || !c.SUPABASE_KEY) return Promise.resolve(false);
    return fetch(c.SUPABASE_URL.replace(/\/$/,"") + "/rest/v1/" + table, {
      method:"POST",
      headers:{ "apikey":c.SUPABASE_KEY, "Authorization":"Bearer "+c.SUPABASE_KEY, "Content-Type":"application/json", "Prefer":"return=minimal" },
      body: JSON.stringify(row)
    }).then(function(r){ return r.ok; }).catch(function(){ return false; });
  };
})();
