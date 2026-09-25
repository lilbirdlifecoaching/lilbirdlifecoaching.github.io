(function () {
  'use strict';

  var WORKER_URL = 'https://worker-solo.cwwq46sn7m.workers.dev/immersion-enquiry';
  var form = document.getElementById('immersion-form');
  if (!form) return;

  var submitBtn = document.getElementById('imm-submit');
  var errEl = document.getElementById('imm-error');
  var okEl = document.getElementById('imm-success');

  function showError(msg) {
    if (okEl) {
      okEl.hidden = true;
      okEl.textContent = '';
    }
    if (errEl) {
      errEl.hidden = !msg;
      errEl.textContent = msg || '';
    }
  }

  function showSuccess(msg) {
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    if (okEl) {
      okEl.hidden = false;
      okEl.textContent = msg;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');

    var name = (document.getElementById('imm-name').value || '').trim();
    var email = (document.getElementById('imm-email').value || '').trim().toLowerCase();
    var phone = (document.getElementById('imm-phone').value || '').trim();
    var setting = (document.getElementById('imm-setting').value || '').trim();
    var partySize = parseInt(document.getElementById('imm-party').value, 10);
    var timing = (document.getElementById('imm-timing').value || '').trim();
    var message = (document.getElementById('imm-message').value || '').trim();

    if (!name || !email || !setting || !timing || !(partySize >= 1 && partySize <= 4)) {
      showError('Please fill in name, email, setting, party size, and rough timing.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('That email doesn’t look quite right.');
      return;
    }

    var original = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: phone || null,
        setting: setting,
        party_size: partySize,
        timing: timing,
        message: message || null,
        source: 'intensive-immersion'
      })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error((result.data && result.data.error) || 'Could not send enquiry.');
        }
        form.reset();
        showSuccess('Enquiry sent. Luke will follow up by email about dates and fit.');
        submitBtn.textContent = 'Sent ✓';
      })
      .catch(function (err) {
        console.error('Immersion enquiry:', err);
        showError(err.message || 'Something went wrong. Email hello@lilbird.life instead.');
        submitBtn.disabled = false;
        submitBtn.textContent = original;
      });
  });
})();
