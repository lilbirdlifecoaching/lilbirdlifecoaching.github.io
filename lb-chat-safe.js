/**
 * Shared client helpers for lil' bird chat: XSS-safe assistant HTML and Calendly embed allowlist.
 * Load before inline chat on index.html or before chat.js on other pages.
 */
(function (w) {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Only lilbirdlifecoaching Calendly HTTPS URLs (no javascript:, no other hosts). */
  function isAllowedCalendlyUrl(url) {
    try {
      var u = new URL(url);
      if (u.protocol !== 'https:' || u.hostname !== 'calendly.com') return false;
      return u.pathname.toLowerCase().indexOf('/lilbirdlifecoaching/') === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Assistant messages may include whitelisted booking <a> tags (lb-book-trigger + data-url).
   * Optional <span class="lb-discount">…</span> after a booking line (plain text inside only).
   * Everything else is escaped; newlines become <br>.
   */
  function sanitizeAssistantHtml(raw) {
    var placeholders = [];
    var ph = function (type, payload) {
      var i = placeholders.length;
      placeholders.push({ type: type, payload: payload });
      return '\x01' + type + i + '\x01';
    };

    var s = String(raw);
    // Whitelist discount spans (text only inside)
    s = s.replace(/<span\s+class="lb-discount"[^>]*>([\s\S]*?)<\/span>/gi, function (full, inner) {
      var text = String(inner).replace(/<[^>]+>/g, '').trim();
      return ph('DISC', { text: text });
    });

    var anchorTag = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    s = s.replace(anchorTag, function (full, attrs, inner) {
      if (!/\blb-book-trigger\b/.test(attrs)) return full;
      var dm = /\bdata-url="([^"]*)"/i.exec(attrs);
      if (!dm) return full;
      var url = dm[1];
      if (!isAllowedCalendlyUrl(url)) return full;
      var text = String(inner).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return ph('BOOK', { url: url, text: text || 'Book' });
    });

    var escaped = escapeHtml(s);
    for (var j = placeholders.length - 1; j >= 0; j--) {
      var p = placeholders[j];
      var rep;
      if (p.type === 'BOOK') {
        rep =
          '<a href="#" class="lb-cta-btn lb-book-trigger" data-url="' +
          escapeHtml(p.payload.url) +
          '">' +
          escapeHtml(p.payload.text) +
          '</a>';
      } else if (p.type === 'DISC') {
        rep = '<span class="lb-discount">' + escapeHtml(p.payload.text) + '</span>';
      } else {
        rep = '';
      }
      escaped = escaped.split('\x01' + p.type + j + '\x01').join(rep);
    }
    return escaped.replace(/\n/g, '<br>');
  }

  w.lbChatSafe = {
    escapeHtml: escapeHtml,
    isAllowedCalendlyUrl: isAllowedCalendlyUrl,
    sanitizeAssistantHtml: sanitizeAssistantHtml,
  };
})(typeof window !== 'undefined' ? window : this);
