/* I'm Nobody's Fool: the test engine.
   NF_run({ test, title, intro, fixed:[ids] })  plays a fixed list of questions.
   NF_run({ test, title, intro, length:10 })    plays an adaptive test from the whole bank. */
(function(){
var WIN = 100, LEARN = 25, PASS = 80;          /* PASS = percent correct that unlocks inbox tests */
var STEP_UP = 0.35, STEP_DOWN = 0.35;          /* how far difficulty moves after each answer */
var LEVELS = ["", "Warm-up", "Getting tricky", "Sneaky", "Crafty", "Master forger"];
var BANK = window.NF_QUESTIONS, BY_ID = {};
BANK.forEach(function(q){ BY_ID[q.id] = q; });

function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
function clamp(n){ return Math.max(1, Math.min(5, n)); }

/* Pick the next question: unseen, closest in difficulty to the player's level, not the same topic twice running. */
function pickNext(skill, used, seen, lastTopic){
  var target = Math.round(skill);
  var pool = BANK.filter(function(q){ return used.indexOf(q.id) < 0; });
  var fresh = pool.filter(function(q){ return seen.indexOf(q.id) < 0; });
  if(fresh.length) pool = fresh;
  var best = null, bestScore = 1e9;
  pool.forEach(function(q){
    var s = Math.abs(q.d - target) + (q.topic === lastTopic ? 0.6 : 0) + Math.random()*0.5;
    if(s < bestScore){ bestScore = s; best = q; }
  });
  return best;
}
window.NF_pickNext = pickNext;

window.NF_run = function(cfg){
  var screen = document.getElementById("screen");
  var adaptive = !cfg.fixed;
  var total = adaptive ? cfg.length : cfg.fixed.length;
  var st;

  function fresh(){
    var start = adaptive ? clamp(NF_store.get("nf_skill", 1) - 0.5) : 1;
    return {i:-1, score:0, right:0, picked:null, skill:start, startSkill:start, used:[], answers:[], cur:null, saved:false};
  }
  function current(){ return BY_ID[st.cur]; }
  function advance(){
    st.i++; st.picked = null;
    if(st.i >= total){ st.cur = null; return; }
    var q;
    if(adaptive){
      var last = st.used.length ? BY_ID[st.used[st.used.length-1]].topic : null;
      q = pickNext(st.skill, st.used, NF_store.get("nf_seen", []), last);
    } else q = BY_ID[cfg.fixed[st.i]];
    st.cur = q.id; st.used.push(q.id);
  }

  function textThread(r){
    var phone = el("div","phone");
    phone.setAttribute("role","group");
    phone.setAttribute("aria-label","Text message from "+r.from+(r.known?", saved in your contacts":", not in your contacts"));
    var head = el("div","ph-head");
    var back = el("span","ph-back","‹"); back.setAttribute("aria-hidden","true");
    var who = el("div","ph-who");
    var av = el("div","ph-av"+(r.known?"":" anon"), r.known ? r.from.charAt(0) : ""); av.setAttribute("aria-hidden","true");
    who.append(av, el("div","ph-name",r.from+" ›"));
    head.append(back, who, el("span"));
    var body = el("div","ph-body");
    var time = el("div","ph-time");
    time.append(el("b",null,r.known?"iMessage":"Text Message"), document.createElement("br"), r.time);
    body.append(time);
    r.said.forEach(function(t){ body.append(el("div","bub",t)); });
    if(!r.known){
      var junk = el("div","ph-junk","The sender is not in your contact list. ");
      junk.append(el("span",null,"Report Junk")); body.append(junk);
    }
    phone.append(head, body);
    return phone;
  }
  function emailView(r){
    var mail = el("div","mail");
    mail.setAttribute("role","group"); mail.setAttribute("aria-label","Email from "+r.from+", address "+r.addr);
    var head = el("div","mail-head");
    head.append(el("b",null,r.subject), el("div",null,r.from), el("div","addr","<"+r.addr+">"));
    var body = el("div","mail-body");
    r.body.forEach(function(p){ body.append(el("div",null,p)); });
    if(r.link){
      body.append(el("div","mail-btn",r.link.label));
      var u = el("div","mail-url","Press and hold the button and it shows: "); u.append(el("span",null,r.link.url));
      body.append(u);
    }
    mail.append(head, body);
    return mail;
  }

  function render(){
    if(st.i < 0) return;
    screen.textContent = "";
    if(st.i >= total) return renderEnd();
    var r = current();

    var bar = el("div","bar");
    bar.append(el("span",null,"Question "+(st.i+1)+" of "+total), el("span",null,st.score+" points"));
    var track = el("div","track"); var fill = el("span"); fill.style.width = (st.i/total*100)+"%"; track.append(fill);
    screen.append(bar, track);
    if(adaptive){
      var lv = el("div","level","Difficulty ");
      lv.append(el("i",null,"●●●●●".slice(0,r.d)+"○○○○○".slice(0,5-r.d)), " "+LEVELS[r.d]);
      screen.append(lv);
    }
    if(r.setup) screen.append(el("p","setup",r.setup));
    screen.append(r.kind === "email" ? emailView(r) : textThread(r));

    var q = el("h2",null,r.q);
    var opts = el("div","opts");
    r.opts.forEach(function(o, n){
      var b = el("button","opt",o[0]); b.type="button";
      if(st.picked !== null){
        b.disabled = true;
        if(o[1]){ b.classList.add("right"); b.textContent = "✓ " + o[0]; }
        else if(n === st.picked){ b.classList.add("wrong"); b.textContent = "✗ " + o[0]; }
      } else b.onclick = function(){ pick(n); };
      opts.append(b);
    });
    screen.append(q, opts);

    if(st.picked !== null){
      var ok = r.opts[st.picked][1] === 1;
      var res = el("div","result"+(ok?"":" miss")); res.setAttribute("role","status");
      res.append(el("strong","pts", ok ? "Correct. +"+WIN+" points" : "That is the one they count on. +"+LEARN+" points for learning it"), el("p",null,r.why));
      var next = el("button","go", st.i === total-1 ? "See my score" : "Next");
      next.type="button"; next.onclick = function(){ advance(); render(); window.scrollTo(0,0); };
      screen.append(res, next);
      next.focus({preventScroll:true}); res.scrollIntoView({block:"nearest"});
    }
  }

  function pick(n){
    var r = current(), ok = r.opts[n][1] === 1;
    st.picked = n; st.score += ok ? WIN : LEARN; if(ok) st.right++;
    st.answers.push({id:r.id, ok:ok, d:r.d});
    if(adaptive) st.skill = clamp(st.skill + (ok ? STEP_UP : -STEP_DOWN));
    render();
  }

  function rank(pct){
    if(pct === 100) return ["Nobody's Fool","A perfect round. A scammer would have given up on you."];
    if(pct >= PASS) return ["Sharp as a Tack","You caught nearly all of them, and now you know the rest."];
    return ["Wiser Than This Morning","You finished, and every miss here is one you will catch in real life."];
  }

  function finish(pct){
    if(st.saved) return;
    st.saved = true;
    var seen = NF_store.get("nf_seen", []);
    st.used.forEach(function(id){ if(seen.indexOf(id) < 0) seen.push(id); });
    if(seen.length >= BANK.length) seen = [];
    NF_store.set("nf_seen", seen);
    if(adaptive) NF_store.set("nf_skill", st.skill);
    NF_save("results", {
      anon_id: NF_anon(), test: cfg.test, correct: st.right, total: total, pct: pct,
      level_start: Math.round(st.startSkill*100)/100, level_end: Math.round(st.skill*100)/100, answers: st.answers
    });
  }

  function inboxCard(pct){
    if(pct < PASS){
      var locked = el("div","card locked");
      locked.append(el("h2",null,"Unlock live inbox tests"),
        el("p",null,"Score "+PASS+"% or better on any test and we can send practice scam emails to your real inbox, to see how you do when you are not expecting one."));
      return locked;
    }
    if(!window.NF_CONFIG.SUPABASE_URL){
      var soon = el("div","card locked");
      soon.append(el("h2",null,"You have earned live inbox tests"),
        el("p",null,"You scored "+pct+"%. That is good enough for practice scam emails sent to your real inbox. Sign-ups open soon, so please check back."));
      return soon;
    }
    var card = el("div","card");
    card.append(el("h2",null,"You have earned live inbox tests"),
      el("p",null,"You scored "+pct+"%. That is good enough for the real thing. If you like, we will send a pretend scam email to your inbox now and then, mixed in with your ordinary mail. If you click, you land on a page that shows you what you missed. No harm done either way."));
    var form = el("form"); form.noValidate = false;
    var lab = el("label",null,"Your own email address"); lab.htmlFor = "inbox-email";
    var input = el("input"); input.type="email"; input.id="inbox-email"; input.name="email"; input.required=true; input.autocomplete="email"; input.placeholder="you@example.com";
    var chk = el("label","check"); var box = el("input"); box.type="checkbox"; box.id="inbox-ok"; box.required=true;
    chk.append(box, el("span",null,"This is my own email address. I agree to receive practice scam emails from I'm Nobody's Fool, and I can stop them at any time."));
    var send = el("button","go","Send me inbox tests"); send.type="submit";
    var note = el("p","note"); note.setAttribute("role","status"); note.hidden = true;
    form.append(lab, input, chk, send, note);
    form.addEventListener("submit", function(e){
      e.preventDefault();
      send.disabled = true;
      NF_save("inbox_signups", {email: input.value.trim(), anon_id: NF_anon(), pct: pct, test: cfg.test}).then(function(ok){
        note.hidden = false;
        if(ok){ note.textContent = "You are on the list. First we will send one ordinary email asking you to confirm. Tests start only after you say yes."; input.disabled = true; box.disabled = true; }
        else { note.textContent = "Inbox tests are not open yet, so nothing was saved. Please try again another day."; send.disabled = false; }
      });
    });
    var priv = el("p","muted small"); priv.append("We use your address only for these tests. ");
    var a = el("a",null,"How we handle your information"); a.href="privacy.html"; priv.append(a, ".");
    card.append(form, priv);
    return card;
  }

  function renderEnd(){
    var pct = Math.round(st.right/total*100), rk = rank(pct);
    finish(pct);
    var ribbon = el("div","ribbon"); ribbon.append(el("span",null,"You got"), el("b",null,pct+"%"), el("span",null,st.right+" of "+total+" correct"));
    var h = el("h1",null,rk[0]); h.tabIndex=-1;
    var sum = st.score+" points."; if(adaptive) sum += " You finished at difficulty level "+Math.round(st.skill)+" of 5, "+LEVELS[Math.round(st.skill)]+".";
    screen.append(ribbon, h, el("p",null,rk[1]), el("p","muted",sum));

    screen.append(el("h2",null,"What next?"), inboxCard(pct));
    var more = el("div","card");
    more.append(el("h2",null,"Take another test"), el("p",null,"Ten new messages. The questions get a little harder each time you get one right."));
    var go = el("a","go","Start a new test"); go.href = "quiz.html"; go.style.textDecoration="none"; go.style.display="inline-flex"; go.style.alignItems="center";
    if(adaptive){ go.href="#"; go.onclick = function(e){ e.preventDefault(); st = fresh(); advance(); render(); window.scrollTo(0,0); }; }
    more.append(go);
    screen.append(more);

    var rules = el("ol","rules");
    ["Don't reply, and hang up if they call. You are never being rude to a stranger who asks for money.",
     "Reach the person or company yourself, using a number or website you already have.",
     "Ask for the family password. If you don't have one, pick one this week."].forEach(function(t){ rules.append(el("li",null,t)); });
    var brag = "I just got "+pct+"% on an I'm Nobody's Fool scam test. My title: "+rk[0]+". Try to beat me: https://imnobodysfool.com";
    var box = el("div","copybox",brag);
    var copy = el("button","opt","Copy this message"); copy.type="button";
    copy.onclick = function(){
      function sel(){ var g=document.createRange(); g.selectNodeContents(box); var s=getSelection(); s.removeAllRanges(); s.addRange(g); copy.textContent="Selected. Now press and hold to copy"; }
      try{ navigator.clipboard.writeText(brag).then(function(){ copy.textContent = "Copied. Paste it into a text or email"; }, sel); }catch(e){ sel(); }
    };
    var rep = el("p","muted"); rep.append("If a message like these ever arrives for real, you can report it at ");
    var a = el("a",null,"ReportFraud.ftc.gov"); a.href="https://reportfraud.ftc.gov"; rep.append(a, ".");
    screen.append(el("h2",null,"Three things to keep"), rules, el("h2",null,"Tell your family"), box, copy, rep);
    h.focus({preventScroll:true});
  }

  st = fresh();
  document.getElementById("start").onclick = function(){ advance(); render(); window.scrollTo(0,0); };
};
})();
