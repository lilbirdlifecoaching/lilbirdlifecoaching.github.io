from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re, os
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
STUB='''<script>
window.supabase={createClient(){let q=new Proxy(function(){},{get(t,k){if(k==='then')return (r)=>Promise.resolve({data:null,error:null}).then(r);return ()=>q;},apply(){return q;}});return {auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})},from(){return q;}};}};
window.fetch=async function(){return {ok:false,json:async()=>({})};};
</script>'''
BOOT='''(async()=>{
 currentUser={id:'local-review-only',email:'review@example.invalid'};
 userProfile={purchased_at:'2026-01-01',full_name:'Maya'};
 soloEntitlements=new Set(['solo_course']);
 sessionData=SESSIONS.map(s=>({session_number:s.number,status:s.number<3?'complete':s.number===3?'in_progress':'locked'}));
 await openSession(3);
})();'''
class Handler(SimpleHTTPRequestHandler):
 def end_headers(self):
  self.send_header('Content-Security-Policy', "connect-src 'none'; frame-src 'self'; media-src 'self'; form-action 'none';")
  super().end_headers()
 def do_GET(self):
  if self.path.split('?')[0]=='/solo/review/':
   html=(ROOT/'solo/index.html').read_text()
   html=re.sub(r'<script src="(?:https://js.stripe.com/[^"\n]*|/js/vendor/supabase[^"\n]*|/lilbird-auth-bridge[^"\n]*|/lilbird-nest-nav[^"\n]*)"></script>','',html)
   html=html.replace('  <script>\n    const SUPABASE_URL',STUB+'\n  <script>\n    const SUPABASE_URL')
   a=html.index('    (async()=>{\n      try {\n        var purchaseParams')
   b=html.index('    // ── Voice input',a)
   html=html[:a]+BOOT+'\n'+html[b:]
   html=html.replace('<head>', '<head><base href="/solo/">')
   html=html.replace('<body>', '<body><div style="position:fixed;bottom:0;left:0;z-index:1000;background:#173f4c;color:white;padding:3px 12px;font:11px system-ui">LOCAL REVIEW · sample progress · services disconnected</div>')
   data=html.encode(); self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',len(data));self.end_headers();self.wfile.write(data)
  else:super().do_GET()
ThreadingHTTPServer(('127.0.0.1',8873),Handler).serve_forever()
