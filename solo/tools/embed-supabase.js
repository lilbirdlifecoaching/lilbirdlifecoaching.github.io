/** Shared Supabase client for Solo tools embedded in the course iframe. */
(function (global) {
  var SUPABASE_URL = 'https://mebqqzbuwkogdxvnihrq.supabase.co';
  var SUPABASE_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lYnFxemJ1d2tvZ2R4dm5paHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTMzMjAsImV4cCI6MjA5MzQ4OTMyMH0.AzBotw2siyolNEbzd9cp4VT9FjBrGetiZxGOZsOGZVU';

  function readEmbedAuth() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('token') ? decodeURIComponent(params.get('token')) : null;
    var uid = params.get('uid') || null;
    return { token: token, uid: uid, params: params };
  }

  /**
   * JWT in Authorization header so reads/writes honour RLS as the authenticated user.
   * Do NOT use setSession({ refresh_token: '' }) — that silently fails in Supabase JS v2.
   */
  function createEmbedClient() {
    var auth = readEmbedAuth();
    var sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: auth.token ? { headers: { Authorization: 'Bearer ' + auth.token } } : {},
    });
    return { sb: sb, token: auth.token, uid: auth.uid, params: auth.params };
  }

  function isRedo() {
    return new URLSearchParams(window.location.search).get('redo') === '1';
  }

  function readPreload() {
    var raw = new URLSearchParams(window.location.search).get('preload');
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      try {
        return JSON.parse(raw);
      } catch (e2) {
        return null;
      }
    }
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

  /** After a successful save in the Solo iframe — updates the chat card immediately and closes the embed. */
  function finishEmbedSave(toolKey, outputData) {
    notifyParent(toolKey, outputData || null, true);
  }

  global.LilbirdEmbed = {
    createEmbedClient: createEmbedClient,
    isRedo: isRedo,
    readPreload: readPreload,
    notifyParent: notifyParent,
    finishEmbedSave: finishEmbedSave,
    SUPABASE_URL: SUPABASE_URL,
    SUPABASE_ANON: SUPABASE_ANON,
  };
})(window);
