// lil' bird chat widget v3
(function() {
  var style = document.createElement('style');
  style.textContent = `
    #lb-chat-btn{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;width:58px;height:58px;border-radius:50%;background:#F5C842;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(245,200,66,0.4);transition:transform 0.3s,box-shadow 0.3s;}
    #lb-chat-btn:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 8px 28px rgba(245,200,66,0.5);}
    #lb-chat-btn img{width:36px;height:36px;border-radius:8px;}
    .lb-notif{position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#e8734a;border-radius:50%;border:2px solid #1e2028;animation:lb-pulse 2s ease infinite;}
    @keyframes lb-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
    #lb-win{position:fixed;bottom:5.5rem;right:1.5rem;z-index:9998;width:360px;max-height:540px;background:#1e2028;border:1px solid rgba(245,200,66,0.2);border-radius:12px;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5);transform:scale(0.9) translateY(20px);opacity:0;pointer-events:none;transition:transform 0.3s cubic-bezier(0.22,1,0.36,1),opacity 0.3s ease;overflow:hidden;}
    #lb-win.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}
    .lb-hdr{padding:1rem 1.25rem;background:#252830;border-bottom:1px solid rgba(245,200,66,0.15);display:flex;align-items:center;gap:0.75rem;flex-shrink:0;}
    .lb-hdr img{width:32px;height:32px;border-radius:8px;flex-shrink:0;}
    .lb-hdr-name{font-family:'Playfair Display',serif;font-style:italic;font-size:0.95rem;color:#F5C842;flex:1;}
    .lb-hdr-sub{font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:#a09880;display:flex;align-items:center;gap:0.35rem;}
    .lb-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;}
    #lb-close{background:none;border:none;color:#a09880;cursor:pointer;font-size:1.1rem;padding:0.25rem;transition:color 0.2s;}
    #lb-close:hover{color:#F5C842;}
    #lb-msgs{flex:1;overflow-y:auto;padding:1.25rem;display:flex;flex-direction:column;gap:1rem;scrollbar-width:thin;scrollbar-color:rgba(245,200,66,0.2) transparent;}
    .lb-m{display:flex;flex-direction:column;max-width:88%;}
    .lb-m.bot{align-self:flex-start;}.lb-m.usr{align-self:flex-end;}
    .lb-b{padding:0.75rem 1rem;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:0.88rem;line-height:1.65;}
    .bot .lb-b{background:#2a2d38;border:1px solid rgba(245,200,66,0.12);color:#f0ead8;border-bottom-left-radius:4px;}
    .usr .lb-b{background:#F5C842;color:#1e2028;font-weight:500;border-bottom-right-radius:4px;}
    .lb-typing{display:flex;gap:4px;padding:0.75rem 1rem;background:#2a2d38;border:1px solid rgba(245,200,66,0.12);border-radius:12px 12px 12px 4px;width:fit-content;}
    .lb-typing span{width:6px;height:6px;border-radius:50%;background:#a09880;animation:lb-b 1.2s ease infinite;}
    .lb-typing span:nth-child(2){animation-delay:0.2s;}.lb-typing span:nth-child(3){animation-delay:0.4s;}
    @keyframes lb-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
    .lb-foot{padding:0.85rem 1rem;background:#252830;border-top:1px solid rgba(245,200,66,0.12);display:flex;gap:0.6rem;align-items:center;flex-shrink:0;}
    #lb-input{flex:1;background:#1e2028;border:1px solid rgba(245,200,66,0.2);border-radius:8px;padding:0.6rem 0.9rem;color:#f0ead8;font-family:'DM Sans',sans-serif;font-size:0.88rem;outline:none;resize:none;line-height:1.5;max-height:80px;overflow-y:auto;}
    #lb-input::placeholder{color:#a09880;}#lb-input:focus{border-color:rgba(245,200,66,0.45);}
    #lb-send{width:36px;height:36px;border-radius:8px;background:#F5C842;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#1e2028;font-size:1rem;transition:background 0.2s;}
    #lb-send:hover{background:#fff;}
    .lb-cta-btn{display:inline-block;margin-top:0.75rem;padding:0.6rem 1.2rem;background:#F5C842;color:#1e2028;border-radius:4px;font-family:monospace;font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;font-weight:600;}
    .lb-cta-btn:hover{background:#fff;}
    .lb-discount{display:block;margin-top:0.4rem;font-size:0.75rem;color:#c9a130;font-style:italic;}
    #lb-cal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;align-items:center;justify-content:center;}
    #lb-cal-overlay.open{display:flex;}
    #lb-cal-box{background:#1e2028;border:1px solid rgba(245,200,66,0.3);border-radius:12px;width:min(600px,95vw);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;}
    .lb-cal-hdr{padding:1rem 1.25rem;background:#252830;border-bottom:1px solid rgba(245,200,66,0.15);display:flex;align-items:center;justify-content:space-between;}
    .lb-cal-title{font-family:'Playfair Display',serif;font-style:italic;color:#F5C842;font-size:1rem;}
    #lb-cal-close{background:none;border:none;color:#a09880;cursor:pointer;font-size:1.2rem;}
    #lb-cal-close:hover{color:#F5C842;}
    #lb-cal-frame{flex:1;border:none;min-height:500px;background:#fff;}
    @media(max-width:480px){#lb-win{width:calc(100vw - 2rem);right:1rem;}#lb-chat-btn{right:1rem;bottom:1rem;}}
  `;
  document.head.appendChild(style);

  // Inject widget HTML
  var wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="lb-chat-btn" aria-label="Chat with lil' bird">
      <img src="data:image/png;base64,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" alt="lil' bird" />
      <span class="lb-notif"></span>
    </button>
    <div id="lb-win">
      <div class="lb-hdr">
        <img src="data:image/png;base64,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" alt="lil' bird" />
        <div style="flex:1">
          <div class="lb-hdr-name">lil' bird</div>
          <div class="lb-hdr-sub"><span class="lb-dot"></span>here with you</div>
        </div>
        <button id="lb-close" aria-label="Close">✕</button>
      </div>
      <div id="lb-msgs"></div>
      <div class="lb-foot">
        <textarea id="lb-input" placeholder="say something..." rows="1"></textarea>
        <button id="lb-send">→</button>
      </div>
    </div>
    <div id="lb-cal-overlay">
      <div id="lb-cal-box">
        <div class="lb-cal-hdr">
          <span class="lb-cal-title">book your first flight</span>
          <button id="lb-cal-close">✕</button>
        </div>
        <iframe id="lb-cal-frame" src="" title="Book a session"></iframe>
      </div>
    </div>
  `;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  var WORKER = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  var OPEN_MSG = "Hey. You showed up — that already says something.\n\nWhat's going on for you right now?";
  var SYSTEM_NOTE = `IMPORTANT BEHAVIOUR UPDATES:
- Keep responses SHORT — max 2-3 sentences. One question per response. No exceptions.
- Move the conversation forward efficiently. Don't linger on the same theme more than twice.
- Be warm but not probing — if something feels too personal for a chat, acknowledge it lightly and move on.
- When offering the First Flight, always mention the chat discount: use code FIRSTFLIGHT for 20% off.
- When ready to book, use this exact HTML for the button (it opens an in-app calendar, not a new page):
  <a href="#" class="lb-cta-btn lb-book-trigger" data-url="https://calendly.com/lukehaythorpe-orangery/first-flight-session">Book your First Flight →</a>
  <span class="lb-discount">Use code FIRSTFLIGHT for 20% off — exclusive to this chat</span>`;

  var msgs = [], isOpen = false, typing = false;
  var btn = document.getElementById('lb-chat-btn');
  var win = document.getElementById('lb-win');
  var closeBtn = document.getElementById('lb-close');
  var msgsEl = document.getElementById('lb-msgs');
  var input = document.getElementById('lb-input');
  var sendBtn = document.getElementById('lb-send');
  var notif = btn.querySelector('.lb-notif');
  var calOverlay = document.getElementById('lb-cal-overlay');
  var calFrame = document.getElementById('lb-cal-frame');
  var calClose = document.getElementById('lb-cal-close');

  // Open/close chat
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    if (isOpen) { notif.style.display = 'none'; if (!msgs.length) addBot(OPEN_MSG); setTimeout(function(){ input.focus(); }, 300); }
  });
  closeBtn.addEventListener('click', function() { isOpen = false; win.classList.remove('open'); });

  // Calendly overlay
  calClose.addEventListener('click', function() { calOverlay.classList.remove('open'); calFrame.src = ''; });
  calOverlay.addEventListener('click', function(e) { if (e.target === calOverlay) { calOverlay.classList.remove('open'); calFrame.src = ''; } });

  // Intercept booking button clicks inside chat
  msgsEl.addEventListener('click', function(e) {
    var t = e.target.closest('.lb-book-trigger');
    if (t) {
      e.preventDefault();
      var url = t.getAttribute('data-url');
      if (url) {
        calFrame.src = url + '?hide_event_type_details=1&hide_gdpr_banner=1&background_color=1e2028&text_color=f0ead8&primary_color=F5C842';
        calOverlay.classList.add('open');
      }
    }
  });

  // Send message
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
  sendBtn.addEventListener('click', doSend);
  input.addEventListener('input', function() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 80) + 'px'; });

  function addBot(t) {
    var m = document.createElement('div'); m.className = 'lb-m bot';
    var b = document.createElement('div'); b.className = 'lb-b';
    b.innerHTML = t.replace(/\n/g, '<br>');
    m.appendChild(b); msgsEl.appendChild(m);
    // Scroll to TOP of new message, not bottom
    m.scrollIntoView({ behavior: 'smooth', block: 'start' });
    msgs.push({role: 'assistant', content: t});
  }
  function addUsr(t) {
    var m = document.createElement('div'); m.className = 'lb-m usr';
    var b = document.createElement('div'); b.className = 'lb-b'; b.textContent = t;
    m.appendChild(b); msgsEl.appendChild(m);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    msgs.push({role: 'user', content: t});
  }
  function showTyping() {
    var e = document.createElement('div'); e.className = 'lb-m bot'; e.id = 'lb-typ';
    e.innerHTML = '<div class="lb-typing"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(e); msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function hideTyping() { var e = document.getElementById('lb-typ'); if (e) e.remove(); }

  function doSend() {
    var t = input.value.trim();
    if (!t || typing) return;
    addUsr(t); input.value = ''; input.style.height = 'auto';
    sendBtn.disabled = true; typing = true; showTyping();

    // Build messages with system note injected
    var apiMsgs = msgs.filter(function(m) { return m.role === 'user' || m.role === 'assistant'; });
    // Add behaviour reminder as first user turn context
    var payload = [{role: 'user', content: SYSTEM_NOTE + '\n\nUser: ' + apiMsgs[apiMsgs.length-1].content}];
    if (apiMsgs.length > 1) {
      payload = apiMsgs.slice(0, -1).concat([{role: 'user', content: SYSTEM_NOTE + '\n\nUser: ' + apiMsgs[apiMsgs.length-1].content}]);
    }

    fetch(WORKER, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: payload})
    }).then(function(r) { return r.json(); }).then(function(d) {
      hideTyping();
      if (d.content && d.content[0]) addBot(d.content[0].text);
      else addBot("Something got tangled on my end. Try again?");
    }).catch(function() {
      hideTyping(); addBot("Having a little trouble connecting. Try again in a moment?");
    }).finally(function() {
      typing = false; sendBtn.disabled = false; input.focus();
    });
  }
})();
