import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

function setupDom() {
  const html = readFileSync(join(dirname(new URL(import.meta.url).pathname), "../index.html"), "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyInner = bodyMatch ? bodyMatch[1] : html;
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${bodyInner}</body></html>`, { url:"http://localhost", pretendToBeVisual:true });
  global.window = dom.window; global.document = dom.window.document;
  Object.defineProperty(global,'localStorage',{ value: dom.window.localStorage, writable:true, configurable:true });
  Object.defineProperty(global,'navigator',{ value: dom.window.navigator, writable:true, configurable:true });
  global.HTMLElement = dom.window.HTMLElement; global.Node = dom.window.Node; global.MutationObserver = dom.window.MutationObserver; global.getComputedStyle = dom.window.getComputedStyle;
  global.Audio = class { constructor(){ this.src=""; this.currentTime=0; this.duration=0; this.crossOrigin=null; this.buffered={ length:0, end:()=>0 }; this.paused=true; this.ended=false; this.error=null; this.volume=0.9; this.playbackRate=1; this.muted=false; } addEventListener(){} removeEventListener(){} play(){ this.paused=false; return Promise.resolve();} pause(){ this.paused=true; } load(){} };
  if (!global.window.HTMLElement.prototype.animate) global.window.HTMLElement.prototype.animate = () => ({ onfinish:null, finished: Promise.resolve(), cancel:()=>{} });
  if (!global.window.HTMLMediaElement) global.window.HTMLMediaElement = class {};
  global.window.HTMLMediaElement.prototype.pause = function(){};
  global.window.HTMLMediaElement.prototype.play = function(){ return Promise.resolve(); };
  global.window.HTMLMediaElement.prototype.load = function(){};
  global.requestAnimationFrame = (cb)=> setTimeout(cb, 16);
  global.cancelAnimationFrame = (id)=> clearTimeout(id);
  global.window.requestAnimationFrame = global.requestAnimationFrame;
  global.window.cancelAnimationFrame = global.cancelAnimationFrame;
  // sin temporizadores reales la prueba no se queda colgada
  global.setInterval = () => 1;
  global.clearInterval = () => {};
  global.window.setInterval = global.setInterval;
  global.window.clearInterval = global.clearInterval;
  global.setTimeout = global.setTimeout;
  global.clearTimeout = global.clearTimeout;
  global.window.matchMedia = global.window.matchMedia ?? (()=> ({ matches:false, addEventListener:()=>{}, removeEventListener:()=>{}, addListener:()=>{}, removeListener:()=>{} }));
  global.matchMedia = global.window.matchMedia;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.matchMedia = global.window.matchMedia;
  global.URL.createObjectURL = global.URL.createObjectURL ?? (() => "blob:test");
  global.URL.revokeObjectURL = global.URL.revokeObjectURL ?? (() => {});
  if (!global.crypto) global.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
  if (!dom.window.crypto) dom.window.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
  global.window.prompt = () => "testkey";
  return dom;
}

test("playback goes through engine - youtube vs audio", async () => {
  const dom = setupDom();
  // reproductor de YouTube falso
  let ytPlayCalled = false;
  let ytPauseCalled = false;
  let ytEndedCallback = null;
  global.window.YT = {
    Player: class {
      constructor(id, opts){
        this.id=id; this.opts=opts;
        opts.events.onReady({target:{getDuration:()=>120}});
        this.playVideo = ()=>{ ytPlayCalled=true; opts.events.onStateChange({data:1}); };
        this.pauseVideo = ()=>{ ytPauseCalled=true; opts.events.onStateChange({data:2}); };
        this.getCurrentTime = ()=> 10;
        this.getDuration = ()=> 120;
        this.seekTo = ()=>{};
        this.setVolume = ()=>{};
        this.mute = ()=>{};
        this.unMute = ()=>{};
        this.setPlaybackRate = ()=>{};
        this.destroy = ()=>{};
        this.loadVideoById = ()=>{};
        const origState = opts.events.onStateChange;
        ytEndedCallback = (data)=> origState({data});
        this._onState = origState;
      }
    },
    PlayerState:{ ENDED:0, PLAYING:1, PAUSED:2, BUFFERING:3 }
  };
  // aqui no hace falta simular la red
  global.fetch = async ()=> ({ ok:true, json: async()=> ({}) });

  const stateMod = await import(`../dist/state.js`);
  const { library, player, getActiveList } = stateMod;
  const engines = await import(`../dist/engines.js`);
  const { playSongNode, getActiveEngine } = engines;
  const engineMod = await import(`../dist/engine.js`);
  engineMod.AudioEngine.prototype.load = async function(song){ const el=document.getElementById("audio"); if(song.noCors) el.removeAttribute("crossorigin"); else el.crossOrigin="anonymous"; el.src=song.url; return; };
  const list = getActiveList();
  // partir de una lista limpia
  while(list.head) list.removeAt(0);
  // una cancion de youtube y otra local
  const ytSong = { id: "yt1", title:"YT Song", url:"https://www.youtube.com/watch?v=abc123", source:"youtube", videoId:"abc123", artworkUrl:"https://i.ytimg.com/vi/abc123/mqdefault.jpg", duration:120 };
  const localSong = { id:"local1", title:"Local Song", url:"blob:test", source:"local", fileName:"a.mp3", fileSize:1000 };
  const n1 = list.addLast(ytSong);
  const n2 = list.addLast(localSong);
  // vigilar si se usa el elemento de audio
  let audioPlayCalled = false;
  const audioEl = document.getElementById("audio");
  const origPlay = audioEl.play;
  audioEl.play = ()=>{ audioPlayCalled=true; return Promise.resolve(); };
  void playSongNode(n1);
  await new Promise(r=> setTimeout(r, 80));
  // con una cancion de youtube el que suena es el iframe
  assert.ok(ytPlayCalled, "yt play should be called");
  // el elemento de audio queda relegado: el motor activo es el de youtube
  const active = getActiveEngine();
  assert.equal(active.kind, "youtube");
  // y el analizador avisa de que no puede leer la senal
  const label = document.getElementById("visualizerLabel");
  assert.ok(label.textContent.includes("N/A"), `label ${label.textContent}`);
  // el iframe existe y tiene medidas
  const host = document.getElementById("ytHost");
  assert.ok(host, "ytHost should exist");
  const rect = host.getBoundingClientRect();
  // el navegador simulado no mide nada, pero el estilo si esta puesto
  assert.ok(host.style.width === "220px" && host.style.height === "220px", `host style ${host.style.width} ${host.style.height}`);
  // provocar el final de la cancion desde fuera es enredado, porque el aviso
  // nace dentro del iframe simulado. Se comprueba el otro extremo del mismo
  // comportamiento: al pasar a una cancion local, el iframe debe quedarse quieto
  ytPauseCalled = false;
  void playSongNode(n2);
  await new Promise(r=> setTimeout(r, 80));
  assert.ok(ytPauseCalled, "switching to local should pause iframe");
  const active2 = getActiveEngine();
  assert.equal(active2.kind, "audio");
  const hostAfter = document.getElementById("ytHost");
  assert.equal(hostAfter, null, "ytHost should be removed for audio");
  assert.equal(label.textContent, "", "label should be cleared for audio");
  // borrar la cancion de youtube que suena tambien para el iframe
  const n3 = list.addLast(ytSong);
  // sin esperar la promesa, que aqui no termina
  void playSongNode(n3);
  await new Promise(r=> setTimeout(r, 50));
  const host3 = document.getElementById("ytHost");
  assert.ok(host3);
  list.removeNode(n3);
  // con la lista vacia el iframe se desmonta del todo
  audioEl.play = origPlay;
  dom.window.close();
});
