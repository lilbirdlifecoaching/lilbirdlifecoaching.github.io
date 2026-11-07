import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
function fixture() {
 const tracks=[], events={}, classes=new Set(); let loads=0;
 const label={textContent:''};
 const video={style:{},setAttribute(){},removeAttribute(name){delete this[name]},appendChild(t){tracks.push(t)},querySelectorAll(){return tracks},addEventListener(e,fn){events[e]=fn},play(){return Promise.resolve()}};
 const poster={style:{},classList:{add(c){classes.add(c)},remove(c){classes.delete(c)}},addEventListener(e,fn){events['poster-'+e]=fn},querySelector(){return label}};
 const window={};
 vm.runInNewContext(fs.readFileSync(new URL('../js/lilbird-solo-media.js',import.meta.url),'utf8'),{window,document:{createElement(){const t={remove(){tracks.splice(tracks.indexOf(t),1)}};return t;}}});
 return {video,poster,tracks,events,classes,label,mount(session){window.LilbirdSoloMedia.mount(video,poster,session,()=>loads++)},loads:()=>loads};
}
test('existing signed video remains default, with native controls exposed while paused',()=>{
 const f=fixture(); f.mount({title:'Story',videoKey:'session-1.mp4'});
 assert.equal(f.loads(),1);assert.equal(f.video.controls,true);
 f.events.playing();assert.equal(f.classes.has('hidden'),true);
 assert.equal(f.events.pause,undefined); // no overlay stealing native pause/seek controls
 f.events.ended();assert.equal(f.classes.has('hidden'),false);
});
test('narration installs scene and captions; media failure falls back exactly once',()=>{
 const f=fixture();f.mount({title:'Story',videoKey:'session-1.mp4',narratedMedia:{src:'/voice.mp3',scene:'/scene.webp',captions:'/captions.vtt'}});
 assert.equal(f.loads(),0);assert.equal(f.video.poster,'/scene.webp');assert.equal(f.tracks[0].kind,'captions');assert.equal(f.tracks[0].default,true);
 f.events.error();f.events.error();assert.equal(f.loads(),1);assert.equal(f.tracks.length,0);assert.equal(f.video.poster,undefined);
});

test('narration-only session failure does not request a missing legacy video',()=>{
 const f=fixture();f.mount({title:'Relationships',videoKey:null,narratedMedia:{src:'/voice.mp3',scene:'/scene.webp'}});
 f.events.playing();f.events.error();assert.equal(f.loads(),0);assert.equal(f.classes.has('hidden'),false);
});

test('loaded media metadata replaces the estimated duration',()=>{
 const f=fixture();f.mount({title:'Identity',videoKey:'session-3.mp4'});
 f.video.duration=161.685;f.events.loadedmetadata();assert.equal(f.label.textContent,'A word from Luke · 2:41');
});
