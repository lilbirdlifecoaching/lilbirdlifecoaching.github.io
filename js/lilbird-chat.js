/**
 * lil' bird chat widget (same wiring as live site; themed via CSS)
 */
(function (global) {
  var WORKER = 'https://lilbird-chat.cwwq46sn7m.workers.dev/';
  var OPEN_MSG =
    "Hey. You showed up — that already says something.\n\nI'm here to listen, not lecture. What's going on for you right now?";

  function boot() {
    var btn = document.getElementById('lb-chat-btn');
    var pathTrig = document.getElementById('pathfinder-chat-trigger');
    var win = document.getElementById('lb-win');
    var closeBtn = document.getElementById('lb-close');
    var msgsEl = document.getElementById('lb-msgs');
    var input = document.getElementById('lb-input');
    var send = document.getElementById('lb-send');
    if (!btn || !win || !msgsEl || !input || !send) return;

    var msgs = [];
    var isOpen = false;
    var typing = false;
    var notif = btn.querySelector('.lb-notif');

    if (pathTrig) pathTrig.addEventListener('click', function () { btn.click(); });

    btn.addEventListener('click', function () {
      isOpen = !isOpen;
      win.classList.toggle('open', isOpen);
      if (isOpen) {
        if (notif) notif.style.display = 'none';
        if (!msgs.length) addBot(OPEN_MSG);
        setTimeout(function () { input.focus(); }, 300);
      }
    });

    msgsEl.addEventListener('click', function (e) {
      var trigger = e.target.closest('.lb-book-trigger');
      if (!trigger) return;
      e.preventDefault();
      var url = trigger.getAttribute('data-url');
      if (!url || !(global.lbChatSafe && global.lbChatSafe.isAllowedBookingUrl(url))) return;
      // Intensive enrol is a site page — navigate (do not iframe Calendly-style).
      if (global.lbChatSafe.isAllowedSiteBookingUrl(url)) {
        global.location.href = url;
        return;
      }
      if (global.LbFirstFlight && global.LbFirstFlight.isFirstFlightUrl(url)) {
        global.LbFirstFlight.openModal();
        return;
      }
      var overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
      var inner = document.createElement('div');
      inner.style.cssText =
        'position:relative;width:min(680px,95vw);height:min(700px,90vh);background:#fff;border-radius:12px;overflow:hidden;';
      var closeO = document.createElement('button');
      closeO.textContent = '✕';
      closeO.style.cssText =
        'position:absolute;top:10px;right:14px;z-index:2;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#555;';
      closeO.addEventListener('click', function () { overlay.remove(); });
      var iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.cssText = 'width:100%;height:100%;border:none;';
      inner.appendChild(closeO);
      inner.appendChild(iframe);
      overlay.appendChild(inner);
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) overlay.remove();
      });
      document.body.appendChild(overlay);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        isOpen = false;
        win.classList.remove('open');
      });
    }

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
    send.addEventListener('click', doSend);
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });

    function scroll() { msgsEl.scrollTop = msgsEl.scrollHeight; }

    function addBot(t) {
      var m = document.createElement('div');
      m.className = 'lb-m bot';
      var b = document.createElement('div');
      b.className = 'lb-b';
      var html =
        global.lbChatSafe && global.lbChatSafe.sanitizeAssistantHtml
          ? global.lbChatSafe.sanitizeAssistantHtml(t)
          : String(t).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      b.innerHTML = html;
      m.appendChild(b);
      msgsEl.appendChild(m);
      scroll();
      msgs.push({ role: 'assistant', content: t });
    }

    function addUsr(t) {
      var m = document.createElement('div');
      m.className = 'lb-m usr';
      var b = document.createElement('div');
      b.className = 'lb-b';
      b.textContent = t;
      m.appendChild(b);
      msgsEl.appendChild(m);
      scroll();
      msgs.push({ role: 'user', content: t });
    }

    function showTyping() {
      var e = document.createElement('div');
      e.className = 'lb-m bot';
      e.id = 'lb-typ';
      e.innerHTML =
        '<div class="lb-typing"><span></span><span></span><span></span></div>';
      msgsEl.appendChild(e);
      scroll();
    }

    function hideTyping() {
      var e = document.getElementById('lb-typ');
      if (e) e.remove();
    }

    function doSend() {
      var t = input.value.trim();
      if (!t || typing) return;
      addUsr(t);
      input.value = '';
      input.style.height = 'auto';
      send.disabled = true;
      typing = true;
      showTyping();
      var hist = msgs
        .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
        .slice(-6);
      var userTurnCount = msgs.filter(function (m) { return m.role === 'user'; }).length;
      fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: hist, userTurnCount: userTurnCount }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error('chat-unavailable');
          return r.json();
        })
        .then(function (d) {
          hideTyping();
          if (d.content && d.content[0]) addBot(d.content[0].text);
          else addBot('Something got tangled. Try again in a moment?');
        })
        .catch(function (err) {
          hideTyping();
          if (err && err.message === 'chat-unavailable') {
            addBot('The chat service is unavailable right now. Please try again in a moment.');
          } else {
            addBot('Having a little trouble connecting. Try again in a moment?');
          }
        })
        .finally(function () {
          typing = false;
          send.disabled = false;
          input.focus();
        });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
