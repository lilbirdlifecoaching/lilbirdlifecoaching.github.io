/** Shared Supabase client for Solo tools embedded in the course iframe. */
(function (global) {
  var SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  var SUPABASE_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';

  function readEmbedAuth() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token') ? decodeURIComponent(params.get('token')) : null;
    var uid = params.get('uid') || null;
    return { token: token, uid: uid };
  }

  function createEmbedClient() {
    var auth = readEmbedAuth();
    var sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: auth.token ? { headers: { Authorization: 'Bearer ' + auth.token } } : {},
    });
    return { sb: sb, token: auth.token, uid: auth.uid };
  }

  function notifyParent(toolKey, outputData, closeAfter) {
    if (window.parent === window) return;
    try {
      window.parent.postMessage(
        { type: 'tool-saved', toolKey: toolKey, output: outputData || null, close: !!closeAfter },
        '*'
      );
    } catch (e) {}
  }

  global.LilbirdEmbed = {
    createEmbedClient: createEmbedClient,
    notifyParent: notifyParent,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON: SUPABASE_ANON,
  };
})(window);
