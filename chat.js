// lil' bird chat widget v4
(function() {
  var WORKER = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  var FF_URL = 'https://calendly.com/lilbirdlifecoaching/first-flight-session';
  var LCS_URL = 'https://calendly.com/lilbirdlifecoaching/packages/141b4b4c-dca7-46e5-9314-a8fc55f4320f';
  var DISC_URL = 'https://calendly.com/lilbirdlifecoaching/30min';

  // ── Styles ──────────────────────────────────────────────────────
  var s = document.createElement('style');
  s.textContent = `
    #lb-btn{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;width:58px;height:58px;border-radius:50%;background:#F5C842;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,200,66,0.4);transition:transform .3s,box-shadow .3s;}
    #lb-btn:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 8px 28px rgba(245,200,66,.5);}
    #lb-btn img{width:36px;height:36px;border-radius:8px;}
    .lb-notif{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#e8734a;border-radius:50%;border:2px solid #1e2028;animation:lbp 2s ease infinite;}
    @keyframes lbp{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
    #lb-win{position:fixed;bottom:5.5rem;right:1.5rem;z-index:9998;width:360px;max-height:560px;background:#1e2028;border:1px solid rgba(245,200,66,.2);border-radius:12px;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5);transform:scale(.9) translateY(20px);opacity:0;pointer-events:none;transition:transform .3s cubic-bezier(.22,1,.36,1),opacity .3s;overflow:hidden;}
    #lb-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
    .lb-hdr{padding:1rem 1.25rem;background:#252830;border-bottom:1px solid rgba(245,200,66,.15);display:flex;align-items:center;gap:.75rem;flex-shrink:0;}
    .lb-hdr img{width:32px;height:32px;border-radius:8px;}
    .lb-hdr-name{font-family:'Playfair Display',serif;font-style:italic;font-size:.95rem;color:#F5C842;flex:1;}
    .lb-hdr-sub{font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;color:#a09880;display:flex;align-items:center;gap:.35rem;}
    .lb-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;}
    #lb-x{background:none;border:none;color:#a09880;cursor:pointer;font-size:1.1rem;padding:.25rem;transition:color .2s;}
    #lb-x:hover{color:#F5C842;}
    #lb-msgs{flex:1;overflow-y:auto;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;scrollbar-width:thin;scrollbar-color:rgba(245,200,66,.2) transparent;}
    .lb-m{display:flex;flex-direction:column;max-width:90%;}
    .lb-m.bot{align-self:flex-start;}.lb-m.usr{align-self:flex-end;}
    .lb-b{padding:.75rem 1rem;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:.88rem;line-height:1.65;}
    .bot .lb-b{background:#2a2d38;border:1px solid rgba(245,200,66,.12);color:#f0ead8;border-bottom-left-radius:4px;}
    .usr .lb-b{background:#F5C842;color:#1e2028;font-weight:500;border-bottom-right-radius:4px;}
    .lb-opts{display:flex;flex-direction:column;gap:.5rem;margin-top:.75rem;}
    .lb-opt{background:none;border:1px solid rgba(245,200,66,.35);border-radius:8px;padding:.6rem .9rem;color:#F5C842;font-family:'DM Sans',sans-serif;font-size:.82rem;text-align:left;cursor:pointer;transition:all .2s;}
    .lb-opt:hover{background:rgba(245,200,66,.1);border-color:#F5C842;}
    .lb-typing{display:flex;gap:4px;padding:.75rem 1rem;background:#2a2d38;border:1px solid rgba(245,200,66,.12);border-radius:12px 12px 12px 4px;width:fit-content;}
    .lb-typing span{width:6px;height:6px;border-radius:50%;background:#a09880;animation:lbb 1.2s ease infinite;}
    .lb-typing span:nth-child(2){animation-delay:.2s;}.lb-typing span:nth-child(3){animation-delay:.4s;}
    @keyframes lbb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    .lb-foot{padding:.85rem 1rem;background:#252830;border-top:1px solid rgba(245,200,66,.12);display:flex;gap:.6rem;align-items:center;flex-shrink:0;}
    #lb-inp{flex:1;background:#1e2028;border:1px solid rgba(245,200,66,.2);border-radius:8px;padding:.6rem .9rem;color:#f0ead8;font-family:'DM Sans',sans-serif;font-size:.88rem;outline:none;resize:none;line-height:1.5;max-height:80px;overflow-y:auto;transition:border-color .2s;}
    #lb-inp::placeholder{color:#a09880;}#lb-inp:focus{border-color:rgba(245,200,66,.45);}
    #lb-snd{width:36px;height:36px;border-radius:8px;background:#F5C842;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#1e2028;font-size:1rem;transition:background .2s;flex-shrink:0;}
    #lb-snd:hover{background:#fff;}#lb-snd:disabled{opacity:.4;cursor:default;}
    .lb-book-wrap{margin-top:.75rem;}
    .lb-book-btn{display:inline-block;padding:.6rem 1.2rem;background:#F5C842;color:#1e2028;border-radius:4px;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;font-weight:600;cursor:pointer;border:none;transition:background .2s;}
    .lb-book-btn:hover{background:#fff;}
    .lb-disc{display:block;margin-top:.4rem;font-size:.75rem;color:#c9a130;font-style:italic;}
    #lb-cal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;align-items:center;justify-content:center;}
    #lb-cal.open{display:flex;}
    #lb-cal-box{background:#1e2028;border:1px solid rgba(245,200,66,.3);border-radius:12px;width:min(620px,96vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;}
    .lb-cal-hdr{padding:1rem 1.25rem;background:#252830;border-bottom:1px solid rgba(245,200,66,.15);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
    .lb-cal-title{font-family:'Playfair Display',serif;font-style:italic;color:#F5C842;font-size:1rem;}
    .lb-cal-disc{font-size:.72rem;color:#c9a130;font-style:italic;margin-top:.2rem;}
    #lb-cal-x{background:none;border:none;color:#a09880;cursor:pointer;font-size:1.2rem;}#lb-cal-x:hover{color:#F5C842;}
    #lb-cal-frame{flex:1;border:none;min-height:520px;}
    @media(max-width:480px){#lb-win{width:calc(100vw - 2rem);right:1rem;bottom:5rem;}#lb-btn{right:1rem;bottom:1rem;}}
  `;
  document.head.appendChild(s);

  // ── HTML ────────────────────────────────────────────────────────
  var wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="lb-btn" aria-label="Chat with lil' bird">
      <img src="data:image/png;base64,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" alt="lil' bird"/>
      <span class="lb-notif"></span>
    </button>
    <div id="lb-win">
      <div class="lb-hdr">
        <img src="data:image/png;base64,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" alt=""/>
        <div style="flex:1">
          <div class="lb-hdr-name">lil' bird</div>
          <div class="lb-hdr-sub"><span class="lb-dot"></span>here with you</div>
        </div>
        <button id="lb-x">✕</button>
      </div>
      <div id="lb-msgs"></div>
      <div class="lb-foot">
        <textarea id="lb-inp" placeholder="say something..." rows="1"></textarea>
        <button id="lb-snd">→</button>
      </div>
    </div>
    <div id="lb-cal">
      <div id="lb-cal-box">
        <div class="lb-cal-hdr">
          <div>
            <div class="lb-cal-title">book your first flight</div>
            <div class="lb-cal-disc">✦ use code FIRSTFLIGHT for 20% off</div>
          </div>
          <button id="lb-cal-x">✕</button>
        </div>
        <iframe id="lb-cal-frame" src="" title="Book a session"></iframe>
      </div>
    </div>
  `;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  // ── State ───────────────────────────────────────────────────────
  var msgs = [], isOpen = false, busy = false;
  var btn = document.getElementById('lb-btn');
  var win = document.getElementById('lb-win');
  var msgsEl = document.getElementById('lb-msgs');
  var inp = document.getElementById('lb-inp');
  var snd = document.getElementById('lb-snd');
  var cal = document.getElementById('lb-cal');
  var calFrame = document.getElementById('lb-cal-frame');

  // ── Open/close chat ─────────────────────────────────────────────
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    btn.querySelector('.lb-notif').style.display = 'none';
    if (isOpen && !msgs.length) showWelcome();
    if (isOpen) setTimeout(function(){ inp.focus(); }, 300);
  });
  document.getElementById('lb-x').addEventListener('click', function() {
    isOpen = false; win.classList.remove('open');
  });

  // ── Calendly overlay ────────────────────────────────────────────
  function openCal(url, isFF) {
    var themed = url + (url.includes('?') ? '&' : '?') + 'hide_event_type_details=1&hide_gdpr_banner=1&background_color=1e2028&text_color=f0ead8&primary_color=F5C842';
    calFrame.src = themed;
    // Update header
    var title = document.querySelector('.lb-cal-title');
    var disc = document.querySelector('.lb-cal-disc');
    if (isFF) {
      title.textContent = 'book your first flight';
      disc.style.display = 'block';
    } else {
      title.textContent = 'book a session';
      disc.style.display = 'none';
    }
    cal.classList.add('open');
  }
  document.getElementById('lb-cal-x').addEventListener('click', function() {
    cal.classList.remove('open'); calFrame.src = '';
  });
  cal.addEventListener('click', function(e) {
    if (e.target === cal) { cal.classList.remove('open'); calFrame.src = ''; }
  });

  // Intercept ANY click on a booking button or Calendly link inside chat
  msgsEl.addEventListener('click', function(e) {
    var t = e.target.closest('[data-cal-url]');
    if (t) { e.preventDefault(); openCal(t.getAttribute('data-cal-url'), t.getAttribute('data-ff') === '1'); return; }
    // Also catch plain calendly links
    var a = e.target.closest('a');
    if (a && a.href && a.href.includes('calendly.com')) {
      e.preventDefault();
      var isFF = a.href.includes('first-flight');
      openCal(a.href, isFF);
    }
  });

  // ── Welcome message with options ────────────────────────────────
  function showWelcome() {
    var m = document.createElement('div'); m.className = 'lb-m bot';
    var b = document.createElement('div'); b.className = 'lb-b';
    b.innerHTML = 'Hey. Glad you\'re here.<br><br>What brought you in today?';
    var opts = document.createElement('div'); opts.className = 'lb-opts';
    var options = [
      { label: '🔍 See if coaching is a good fit for me', val: 'I want to see if coaching is a good fit for me' },
      { label: '💬 Unpack something I\'m working through', val: 'I want to unpack a problem or situation I\'m working through' },
      { label: '📅 I\'m ready to book — just help me choose', val: 'I already know I want to book — can you help me choose the right option?' },
    ];
    options.forEach(function(o) {
      var btn = document.createElement('button'); btn.className = 'lb-opt';
      btn.textContent = o.label;
      btn.addEventListener('click', function() {
        opts.remove();
        addUsr(o.val);
        fetchReply(o.val);
      });
      opts.appendChild(btn);
    });
    m.appendChild(b); m.appendChild(opts); msgsEl.appendChild(m);
    msgs.push({role:'assistant', content:'Hey. Glad you\'re here. What brought you in today?'});
    m.scrollIntoView({behavior:'smooth', block:'start'});
  }

  // ── Booking shortcut for "ready to book" path ───────────────────
  function showBookingOptions() {
    var m = document.createElement('div'); m.className = 'lb-m bot';
    var b = document.createElement('div'); b.className = 'lb-b';
    b.innerHTML = 'Great — here\'s a quick look at the options:<br><br><strong style="color:#F5C842">🐦 The First Flight</strong> — one 2-hour session. Map your story, find the real issue, leave with your next step. Best starting point, no commitment beyond the conversation.<br><br><strong style="color:#F5C842">🌿 Life Change Sessions</strong> — the full journey. 7 sessions through the complete curriculum. Story, vision, identity, transitions, rhythms, relationships.<br><br><strong style="color:#F5C842">💛 Monthly Coaching</strong> — ongoing thinking partner. Recurring or once-off, flexible to what you need.';
    var wrap = document.createElement('div'); wrap.className = 'lb-opts'; wrap.style.marginTop = '.75rem';
    [
      { label: 'Book a First Flight (20% off via this chat)', url: FF_URL, ff: true },
      { label: 'Book Life Change Sessions', url: LCS_URL, ff: false },
      { label: 'Book a free Discovery Call first', url: DISC_URL, ff: false },
    ].forEach(function(o) {
      var btn = document.createElement('button'); btn.className = 'lb-opt';
      btn.textContent = o.label;
      btn.addEventListener('click', function() { openCal(o.url, o.ff); });
      wrap.appendChild(btn);
    });
    var disc = document.createElement('span'); disc.className = 'lb-disc';
    disc.textContent = '✦ Use code FIRSTFLIGHT at checkout for 20% off your First Flight';
    wrap.appendChild(disc);
    m.appendChild(b); m.appendChild(wrap); msgsEl.appendChild(m);
    msgs.push({role:'assistant', content:'Here are the session options...'});
    m.scrollIntoView({behavior:'smooth', block:'start'});
  }

  // ── Message helpers ─────────────────────────────────────────────
  function addBot(text) {
    // Convert any calendly links in AI response to in-app buttons
    var processed = text
      .replace(/href="(https:\/\/calendly\.com\/[^"]+first-flight[^"]*)"/g, 'data-cal-url="$1" data-ff="1" href="#"')
      .replace(/href="(https:\/\/calendly\.com\/[^"]+30min[^"]*)"/g, 'data-cal-url="$1" data-ff="0" href="#"')
      .replace(/href="(https:\/\/calendly\.com\/[^"]+coaching[^"]*)"/g, 'data-cal-url="$1" data-ff="0" href="#"')
      .replace(/href="(https:\/\/calendly\.com\/[^"]+packages[^"]*)"/g, 'data-cal-url="$1" data-ff="0" href="#"');

    var m = document.createElement('div'); m.className = 'lb-m bot';
    var b = document.createElement('div'); b.className = 'lb-b';
    b.innerHTML = processed.replace(/\n/g,'<br>');
    m.appendChild(b); msgsEl.appendChild(m);
    m.scrollIntoView({behavior:'smooth', block:'start'});
    msgs.push({role:'assistant', content:text});
  }
  function addUsr(text) {
    var m = document.createElement('div'); m.className = 'lb-m usr';
    var b = document.createElement('div'); b.className = 'lb-b'; b.textContent = text;
    m.appendChild(b); msgsEl.appendChild(m);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    msgs.push({role:'user', content:text});
  }
  function showTyping() {
    var e = document.createElement('div'); e.className = 'lb-m bot'; e.id = 'lb-typ';
    e.innerHTML = '<div class="lb-typing"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(e); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var e = document.getElementById('lb-typ'); if(e) e.remove(); }

  // ── Fetch reply ─────────────────────────────────────────────────
  function fetchReply(userText) {
    snd.disabled = true; busy = true; showTyping();
    fetch(WORKER, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({messages: msgs.filter(function(m){return m.role==='user'||m.role==='assistant';})})
    }).then(function(r){return r.json();}).then(function(d){
      hideTyping();
      if(d.content&&d.content[0]) addBot(d.content[0].text);
      else addBot("Something got tangled. Try again?");
    }).catch(function(){
      hideTyping(); addBot("Having trouble connecting. Try again in a moment?");
    }).finally(function(){busy=false;snd.disabled=false;inp.focus();});
  }

  // ── Send ────────────────────────────────────────────────────────
  function doSend() {
    var t = inp.value.trim(); if(!t||busy) return;
    addUsr(t); inp.value=''; inp.style.height='auto';
    fetchReply(t);
  }
  inp.addEventListener('keydown', function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});
  snd.addEventListener('click', doSend);
  inp.addEventListener('input', function(){inp.style.height='auto';inp.style.height=Math.min(inp.scrollHeight,80)+'px';});

})();
