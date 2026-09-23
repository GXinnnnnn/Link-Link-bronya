import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const templateRoot = new URL('../templates/settings/', import.meta.url)

function scriptJson(value) {
  return JSON.stringify(value).replace(/<\//g, '<\\/').replace(/\u2028|\u2029/g, '')
}

async function template(name) {
  return readFile(new URL(name, templateRoot), 'utf8')
}

function declaration() {
  return `export type VehicleUIEventType =
  | 'tap'
  | 'longPress'
  | 'dragStart'
  | 'dragMove'
  | 'dragEnd'
  | 'swipe'
  | 'valueChange'
  | 'navigation'
  | 'stateChange'

export interface VehicleUIPointer {
  x: number
  y: number
  deltaX: number
  deltaY: number
  pointerType: string
}

export interface VehicleUIEvent<T = unknown> {
  version: '1.0.0'
  id: string
  type: VehicleUIEventType
  componentId: string
  screenId: string
  timestamp: number
  sourceNodeId: string | null
  value: T | null
  previousValue: T | null
  phase: 'start' | 'move' | 'end' | null
  pointer: VehicleUIPointer | null
  metadata: Record<string, unknown>
}

export interface VehicleUIBridge {
  readonly version: '1.0.0'
  readonly contract: object | null
  readonly source: { pageId: string | null; pageName: string | null }
  on(type: VehicleUIEventType | '*', listener: (event: VehicleUIEvent) => void): () => void
  off(type: VehicleUIEventType | '*', listener: (event: VehicleUIEvent) => void): void
  dispatch(event: Partial<VehicleUIEvent> & Pick<VehicleUIEvent, 'type' | 'componentId'>): VehicleUIEvent
  getState(): Record<string, unknown>
  setState(path: string, value: unknown, source?: string): void
  registerAdapter(name: string, handler: (event: VehicleUIEvent) => void): () => void
}

declare global {
  interface Window {
    VehicleUI: VehicleUIBridge
    AndroidVehicleUI?: { postMessage(json: string): void }
    vehicleUIBridge?: { postMessage(json: string): void }
  }
}
`
}

export async function generateSettingsFiles(ir, model) {
  const [html, css, runtime, lucide] = await Promise.all([
    template('index.html'),
    template('styles.css'),
    template('runtime.js'),
    readFile(require.resolve('lucide/dist/umd/lucide.min.js'), 'utf8'),
  ])
  const app = `window.__VEHICLE_UI_MODEL__=${scriptJson(model)};\nwindow.__VEHICLE_UI_IR__=${scriptJson(ir)};\n${runtime}`
  return new Map([
    ['index.html', html],
    ['styles.css', css],
    ['app.js', app],
    ['lucide.min.js', lucide],
    ['ui-ir.json', `${JSON.stringify(ir, null, 2)}\n`],
    ['interaction-contract.json', `${JSON.stringify(ir.contract, null, 2)}\n`],
    ['vehicle-ui.d.ts', declaration()],
  ])
}

export function genericProjectFiles(ir) {
  const model = {
    title: ir.source.pageName,
    screens: ir.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      kind: screen.kind,
      texts: screen.texts.slice(0, 40),
      interactions: screen.interactions.slice(0, 80),
    })),
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(ir.source.pageName)}</title><link rel="stylesheet" href="styles.css"></head><body><main><nav id="screens"></nav><section id="preview"></section></main><script src="app.js"></script></body></html>\n`
  const css = `*{box-sizing:border-box;letter-spacing:0}html,body{margin:0;width:100%;height:100%;font-family:system-ui,"Microsoft YaHei",sans-serif;background:#14161f;color:#f7f8fb}main{display:grid;grid-template-columns:320px 1fr;height:100%}nav{padding:24px;overflow:auto;background:#202531}button{width:100%;min-height:48px;margin:0 0 8px;border:0;border-radius:6px;background:#303647;color:#fff;text-align:left;padding:10px 14px;cursor:pointer}button.active{background:#626ffe}section{padding:36px;overflow:auto}h1{font-size:36px;font-weight:500}h2{font-size:20px;color:#a5abba}.surface{max-width:1100px;padding:30px;background:#242936;border-radius:8px}.text{padding:14px 0;border-bottom:1px solid #3a4050}.events{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.events button{width:auto}.meta{color:#9ea5b7;font-size:14px}`
  const app = `const MODEL=${scriptJson(model)};const IR=${scriptJson(ir)};const listeners=new Map();let seq=0;function emit(x){const e={version:'1.0.0',id:'vehicle-ui-'+Date.now()+'-'+(++seq),timestamp:Date.now(),screenId:x.screenId||'',sourceNodeId:x.sourceNodeId||null,value:x.value??null,previousValue:null,phase:null,pointer:null,metadata:{},...x};for(const f of listeners.get(e.type)||[])f(e);window.dispatchEvent(new CustomEvent('vehicle-ui:event',{detail:e}));try{window.AndroidVehicleUI?.postMessage(JSON.stringify(e))}catch{}return e}window.VehicleUI={version:'1.0.0',contract:IR.contract,source:IR.source,on(t,f){if(!listeners.has(t))listeners.set(t,new Set);listeners.get(t).add(f);return()=>listeners.get(t)?.delete(f)},off(t,f){listeners.get(t)?.delete(f)},dispatch:emit,getState(){return{}},setState(p,v){emit({type:'stateChange',componentId:p,value:v})},registerAdapter(){return()=>{}}};const nav=document.querySelector('#screens'),preview=document.querySelector('#preview');function render(s){nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.id===s.id));preview.innerHTML='<h1>'+s.name+'</h1><p class="meta">'+s.kind+' · '+s.id+'</p><div class="surface"><h2>界面文本</h2>'+s.texts.map(t=>'<div class="text">'+t+'</div>').join('')+'<h2>推断交互</h2><div class="events">'+s.interactions.map((e,i)=>'<button data-event="'+i+'">'+e.type+' · '+e.componentId+'</button>').join('')+'</div></div>';preview.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>emit(s.interactions[Number(b.dataset.event)]))}MODEL.screens.forEach(s=>{const b=document.createElement('button');b.dataset.id=s.id;b.textContent=s.name;b.onclick=()=>{emit({type:'navigation',componentId:'screen.selector',screenId:s.id,value:s.id});render(s)};nav.append(b)});if(MODEL.screens[0])render(MODEL.screens[0]);`
  return new Map([
    ['index.html', html], ['styles.css', css], ['app.js', app],
    ['ui-ir.json', `${JSON.stringify(ir, null, 2)}\n`],
    ['interaction-contract.json', `${JSON.stringify(ir.contract, null, 2)}\n`],
    ['vehicle-ui.d.ts', declaration()],
  ])
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))
}
