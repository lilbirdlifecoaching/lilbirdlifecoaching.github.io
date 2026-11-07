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
window.supabase={createClient(){return {auth:{onAuthStateChange(){},signOut:async()=>({error:null}),getSession:async()=>({data:{session:null}})},from(table){let single=false,writing=false;function result(){let data=null;if(!writing){if(table==='session_progress')data=window.__soloPreviewRows||[];if(table==='course_users')data=window.__soloPreviewProfile||null;if(table==='user_entitlements')data=[{product:'solo_course',active:true}];if(table==='tool_outputs')data=window.__soloPreviewTools||[];if(table==='ai_memory')data=single?null:[];}return {data,error:null};}let q=new Proxy({},{get(t,k){if(k==='then')return resolve=>Promise.resolve(result()).then(resolve);return (...args)=>{if(k==='single'||k==='maybeSingle')single=true;if(['update','upsert','insert','delete'].includes(k))writing=true;return q;};}});return q;}};}};
window.fetch=async function(){return {ok:false,json:async()=>({})};};
</script>'''
BOOT='''(async()=>{
 currentUser={id:'local-review-only',email:'review@example.invalid'};
 userProfile={purchased_at:'2026-01-01',full_name:'Maya'};
 soloEntitlements=new Set(['solo_course']);
 sessionData=SESSIONS.map(s=>({session_number:s.number,status:s.number<3?'complete':s.number===3?'in_progress':'locked'}));
 window.__soloPreviewRows=sessionData;window.__soloPreviewProfile=userProfile;
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
  if self.path.split('?')[0] in ['/nest/', '/nest/review/']:
   html=(ROOT/'nest/index.html').read_text()
   html=html.replace('<head>', '<head><base href="/nest/">'+STUB)
   html=re.sub(r'<script[^>]*src="(?:/lilbird-auth-bridge[^"\n]*|/js/vendor/supabase[^"\n]*|/lilbird-gtm[^"\n]*|\./(?:journey|nest-tour|nest-letters-ui)[^"\n]*)"[^>]*></script>', '', html)
   html=re.sub(r'<noscript>.*?</noscript>', '', html, flags=re.S)
   html=html.replace('<body class="nest-page nest-world">', '<body class="nest-page nest-world"><div style="position:fixed;bottom:0;left:0;z-index:1000;background:#173f4c;color:white;padding:3px 12px;font:11px system-ui">LOCAL REVIEW · sample member · services disconnected</div>')
   data=html.encode();self.send_response(200);self.send_header('Content-Type','text/html');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if self.path.split('?')[0]=='/nest/nest-client.js':
   js=(ROOT/'nest/nest-client.js').read_text()
   a=js.index('  (async function init() {');b=js.index('  })();',a)+7
   fixture="""  (function(){
    currentUser={id:'local-review-only',email:'review@example.invalid',user_metadata:{full_name:'Maya'}};
    courseProfile={full_name:'Maya',purchased_at:'2026-01-01'};entitlements=new Set(['solo_course']);
    sessionProgress=Array.from({length:8},(_,number)=>({session_number:number,status:number<3?'complete':number===3?'in_progress':'locked'}));
    document.getElementById('view-auth').classList.remove('active');document.getElementById('view-dashboard').classList.add('active');
    syncSoloNavVisibility();renderNextChapter();renderNestSecondary();renderNextSteps();renderProducts();renderSidebar();goHome();
   })();"""
   js=js[:a]+fixture+js[b:];data=js.encode();self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if self.path.split('?')[0] in ['/solo/review/','/solo/']:
   query = parse_qs(urlsplit(self.path).query)
   try: session = max(0, min(7, int(query.get('session', ['3'])[0])))
   except ValueError: session = 3
   boot = BOOT.replace('s.number<3', 's.number<' + str(session)).replace('s.number===3', 's.number===' + str(session)).replace('openSession(3)', 'openSession(' + str(session) + ')')
   page=query.get('page', ['home' if self.path.split('?')[0]=='/solo/' else 'session'])[0]
   state=query.get('state',['returning'])[0]
   if page=='home':
    if state=='start': boot=boot.replace("s.number<"+str(session),"s.number<0").replace("s.number==="+str(session),"s.number===0").replace("?'in_progress'", "?'available'")
    if state=='complete': boot=boot.replace("s.number<"+str(session)+"?'complete':s.number==="+str(session)+"?'in_progress':'locked'", "'complete'")
    if state=='waiting': boot=boot.replace("s.number==="+str(session)+"?'in_progress'", "s.number==="+str(session)+"?'locked'")
    if state=='access': boot=boot.replace("purchased_at:'2026-01-01'", "purchased_at:null").replace("new Set(['solo_course'])", "new Set()")
    home_code="""
    deepProfileState={loaded:true,nestId:null,profile:null};
    if (new URLSearchParams(location.search).get('state')==='waiting') sessionData[3].unlocks_at=new Date(Date.now()+3600000).toISOString();
    if (isCourseComplete()) toolOutputsCache.full_flight_plan={north_star:'A life with room for what matters.',commitments:['Make space for the people I love.','Protect one quiet hour each week.'],first_action:'Choose one small step for tomorrow.',obstacle_response:'Pause, ask for support, and begin again.'};
    window.__soloPreviewRows=sessionData;window.__soloPreviewTools=Object.entries(toolOutputsCache).map(([tool_name,output_data])=>({tool_name,output_data}));
    renderDashboard();showView('view-dashboard');
    """
    boot=boot.replace(' await openSession('+str(session)+');',home_code)
   if NARRATION_ROOT:
    config = ''.join(f"SESSIONS[{number}].narratedMedia={{src:'/__review_media__/session-{number}.m4a',scene:'/nest/assets/lilbird-kit/backgrounds/panorama-day.webp'}};" for number, filename in NARRATIONS.items() if (NARRATION_ROOT / filename).is_file())
    boot = boot.replace('(async()=>{', '(async()=>{'+config)
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
