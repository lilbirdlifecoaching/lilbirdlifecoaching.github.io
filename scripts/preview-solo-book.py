from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re, os
from urllib.parse import urlsplit, parse_qs
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
NARRATION_ROOT = Path(os.environ['LILBIRD_NARRATION_DIR']) if os.environ.get('LILBIRD_NARRATION_DIR') else None
NARRATIONS = {
 1: "lil' bird story.m4a", 2: "lil' bird vision.m4a",
 3: "lil' bird Identity & Insight.m4a", 4: "lil' bird navigating transitions.m4a",
 5: "lil' bird Routines & Rhythms.m4a", 6: "lil' bird Relationships.m4a",
}

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
 def serve_narration(self, head_only=False):
  match = re.fullmatch(r'/__review_media__/session-([1-6])\.m4a', urlsplit(self.path).path)
  if not match:
   return False
  source = NARRATION_ROOT / NARRATIONS[int(match.group(1))] if NARRATION_ROOT else None
  if not source or not source.is_file():
   self.send_error(404, 'No local narration configured'); return True
  size = source.stat().st_size
  start, end, status = 0, size - 1, 200
  byte_range = self.headers.get('Range')
  if byte_range:
   parsed = re.fullmatch(r'bytes=(\d*)-(\d*)', byte_range)
   if not parsed or not any(parsed.groups()):
    self.send_error(416); return True
   first, last = parsed.groups()
   if first:
    start = int(first); end = min(int(last), size - 1) if last else size - 1
   else:
    start = max(0, size - int(last))
   if start >= size or start > end:
    self.send_response(416); self.send_header('Content-Range', f'bytes */{size}'); self.end_headers(); return True
   status = 206
  self.send_response(status)
  self.send_header('Content-Type', 'audio/mp4')
  self.send_header('Accept-Ranges', 'bytes')
  self.send_header('Cache-Control', 'no-store')
  self.send_header('Content-Length', str(end - start + 1))
  if status == 206: self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
  self.end_headers()
  if not head_only:
   with source.open('rb') as recording:
    recording.seek(start); self.wfile.write(recording.read(end - start + 1))
  return True
 def do_HEAD(self):
  if not self.serve_narration(head_only=True): super().do_HEAD()
 def do_GET(self):
  if self.serve_narration(): return
  if self.path.split('?')[0]=='/solo/review/':
   query = parse_qs(urlsplit(self.path).query)
   try: session = max(0, min(7, int(query.get('session', ['3'])[0])))
   except ValueError: session = 3
   boot = BOOT.replace('s.number<3', 's.number<' + str(session)).replace('s.number===3', 's.number===' + str(session)).replace('openSession(3)', 'openSession(' + str(session) + ')')
   if NARRATION_ROOT:
    config = ''.join(f"SESSIONS[{number}].narratedMedia={{src:'/__review_media__/session-{number}.m4a',scene:'/nest/assets/lilbird-kit/backgrounds/panorama-day.webp'}};" for number, filename in NARRATIONS.items() if (NARRATION_ROOT / filename).is_file())
    boot = boot.replace(' await openSession(', config + '\n await openSession(')
   html=(ROOT/'solo/index.html').read_text()
   html=re.sub(r'<script src="(?:https://js.stripe.com/[^"\n]*|/js/vendor/supabase[^"\n]*|/lilbird-auth-bridge[^"\n]*|/lilbird-nest-nav[^"\n]*)"></script>','',html)
   html=html.replace('  <script>\n    const SUPABASE_URL',STUB+'\n  <script>\n    const SUPABASE_URL')
   a=html.index('    (async()=>{\n      try {\n        var purchaseParams')
   b=html.index('    // ── Voice input',a)
   html=html[:a]+boot+'\n'+html[b:]
   html=html.replace('<head>', '<head><base href="/solo/">')
   html=html.replace('<body>', '<body><div style="position:fixed;bottom:0;left:0;z-index:1000;background:#173f4c;color:white;padding:3px 12px;font:11px system-ui">LOCAL REVIEW · sample progress · services disconnected</div>')
   data=html.encode(); self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',len(data));self.end_headers();self.wfile.write(data)
  else:super().do_GET()
if __name__ == '__main__':
 ThreadingHTTPServer(('127.0.0.1',8873),Handler).serve_forever()
