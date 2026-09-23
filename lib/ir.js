import {
  childrenOf,
  compactNode,
  descendantsOf,
  findPage,
  idOf,
  imageDataUrl,
  imageReferences,
  pageList,
  screenFrames,
  uniqueTexts,
} from './fig.js'

export const INTERACTION_CONTRACT = {
  version: '1.0.0',
  global: 'window.VehicleUI',
  domEvent: 'vehicle-ui:event',
  nativeBridges: [
    'window.AndroidVehicleUI.postMessage(json)',
    'window.webkit.messageHandlers.vehicleUI.postMessage(event)',
    'window.vehicleUIBridge.postMessage(json)',
  ],
  methods: {
    on: 'on(type, listener) => unsubscribe',
    off: 'off(type, listener) => void',
    dispatch: 'dispatch(event) => event',
    getState: 'getState() => object',
    setState: 'setState(path, value, source?) => void',
    registerAdapter: 'registerAdapter(name, handler) => unsubscribe',
  },
  eventTypes: [
    'tap',
    'longPress',
    'dragStart',
    'dragMove',
    'dragEnd',
    'swipe',
    'valueChange',
    'navigation',
    'stateChange',
  ],
  eventShape: {
    version: 'string',
    id: 'string',
    type: 'string',
    componentId: 'string',
    screenId: 'string',
    timestamp: 'number',
    sourceNodeId: 'string|null',
    value: 'unknown',
    previousValue: 'unknown',
    phase: 'start|move|end|null',
    pointer: '{x,y,deltaX,deltaY,pointerType}|null',
    metadata: 'object',
  },
}

function slug(value) {
  return String(value || 'component')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'component'
}

function eventFor(node, screenId, type, evidence, confidence = 0.78) {
  const sourceNodeId = idOf(node)
  return {
    id: `${screenId}.${slug(node.name)}.${sourceNodeId?.replace(':', '-')}.${type}`,
    type,
    componentId: `fig-${sourceNodeId?.replace(':', '-')}`,
    screenId,
    sourceNodeId,
    confidence,
    evidence,
  }
}

function inferNodeEvents(node, screenId) {
  const name = String(node.name || '')
  const text = String(node.textData?.characters || '')
  const probe = `${name} ${text}`
  const events = []
  const add = (type, evidence, confidence) => events.push(eventFor(node, screenId, type, evidence, confidence))

  if (/长按/.test(probe)) add('longPress', 'explicit node text or name contains 长按', 0.98)
  if (/开关|switch|toggle/i.test(probe)) {
    add('tap', 'semantic switch control', 0.92)
    add('valueChange', 'semantic switch value', 0.92)
  }
  if (/滑块|滑动|亮度|音量|色盘|颜色自定义|调节/.test(probe) && node.type !== 'TEXT') {
    add('dragStart', 'semantic continuous adjustment control', 0.84)
    add('dragMove', 'semantic continuous adjustment control', 0.84)
    add('dragEnd', 'semantic continuous adjustment control', 0.84)
    add('valueChange', 'semantic continuous adjustment value', 0.84)
  }
  if (/按钮|标签|tab|模式|选项|位置|卡片|item|set_left_bar|导航/i.test(probe) && node.type !== 'TEXT') {
    add('tap', 'semantic tappable control', 0.76)
  }
  if (/列表|滑动区|scroll/i.test(probe) && node.type !== 'TEXT') {
    add('swipe', 'semantic scrollable region', 0.7)
  }

  for (const [key, value] of Object.entries(node)) {
    if (!/prototype|interaction|transition|navigation|trigger/i.test(key) || value == null) continue
    add('tap', `prototype metadata field ${key}`, 1)
  }
  return events
}

function deriveScreenKind(name) {
  if (/弹窗|提醒|描述|说明/.test(name)) return 'dialog'
  if (/主页/.test(name)) return 'home'
  if (/设置/.test(name)) return 'settings'
  return 'screen'
}

function deriveSection(name) {
  const parts = String(name).split('-').filter(Boolean)
  if (parts[0] === '设置' && parts[1]) return parts[1]
  return parts[0] || '未分类'
}

function summarizeScreen(document, frame) {
  const sourceNodeId = idOf(frame)
  const screenId = `screen-${sourceNodeId.replace(':', '-')}`
  const nodes = descendantsOf(document, frame, true)
  const interactions = []
  const seen = new Set()
  for (const node of nodes) {
    for (const interaction of inferNodeEvents(node, screenId)) {
      const key = `${interaction.componentId}:${interaction.type}`
      if (seen.has(key)) continue
      seen.add(key)
      interactions.push(interaction)
      if (interactions.length >= 160) break
    }
    if (interactions.length >= 160) break
  }
  return {
    id: screenId,
    name: frame.name || 'Untitled screen',
    kind: deriveScreenKind(frame.name || ''),
    section: deriveSection(frame.name || ''),
    sourceNodeId,
    bounds: {
      x: frame.transform?.m02 ?? 0,
      y: frame.transform?.m12 ?? 0,
      width: frame.size?.x ?? 0,
      height: frame.size?.y ?? 0,
    },
    texts: uniqueTexts(document, frame),
    textNodes: nodes
      .filter((node) => node.type === 'TEXT')
      .map(compactNode)
      .slice(0, 240),
    imageReferences: imageReferences(document, frame),
    interactions,
  }
}

export function buildOverview(document) {
  const types = {}
  for (const node of document.nodes) types[node.type] = (types[node.type] || 0) + 1
  return {
    format: document.header,
    nodeCount: document.nodes.length,
    pageCount: pageList(document).length,
    imageCount: document.images.size,
    nodeTypes: types,
    pages: pageList(document),
  }
}

export function buildPageIr(document, pageSelector) {
  const page = findPage(document, pageSelector)
  const frames = screenFrames(document, page)
  const screens = frames.map((frame) => summarizeScreen(document, frame))
  return {
    schema: 'vehicle-ui-ir@1.0.0',
    generatedAt: new Date().toISOString(),
    source: {
      format: document.header.prelude,
      formatVersion: document.header.version,
      pageId: idOf(page),
      pageName: page.name,
    },
    viewport: inferViewport(frames),
    tokens: inferTokens(document, frames),
    screens,
    interactions: screens.flatMap((screen) => screen.interactions),
    contract: INTERACTION_CONTRACT,
    warnings: inferWarnings(screens),
  }
}

function inferViewport(frames) {
  const counts = new Map()
  for (const frame of frames) {
    const key = `${Math.round(frame.size?.x || 0)}x${Math.round(frame.size?.y || 0)}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const [winner = '1920x1200'] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || []
  const [width, height] = winner.split('x').map(Number)
  return { width, height, strategy: 'fixed-canvas-scaled-to-fit' }
}

function inferTokens(document, frames) {
  const colorCounts = new Map()
  for (const frame of frames.slice(0, 24)) {
    for (const node of descendantsOf(document, frame, true)) {
      for (const paint of node.fillPaints ?? []) {
        if (paint.type !== 'SOLID' || !paint.color || paint.visible === false) continue
        const values = [paint.color.r, paint.color.g, paint.color.b].map((value) => Math.round(value * 255).toString(16).padStart(2, '0'))
        const color = `#${values.join('')}`
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1)
      }
    }
  }
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([value, uses]) => ({ value, uses }))
  return { colors, fontFamily: 'MiSans', radius: [10, 12, 16, 24] }
}

function inferWarnings(screens) {
  const names = new Map()
  for (const screen of screens) names.set(screen.name, (names.get(screen.name) || 0) + 1)
  const warnings = []
  for (const [name, count] of names) {
    if (count > 1) warnings.push(`Duplicate top-level screen name ${JSON.stringify(name)} appears ${count} times.`)
  }
  if (!screens.some((screen) => screen.interactions.some((item) => item.confidence === 1))) {
    warnings.push('No explicit prototype interaction metadata was found; semantic interactions are inferred and require review.')
  }
  return warnings
}

function textSource(ir, label) {
  for (const screen of ir.screens) {
    const match = screen.textNodes.find((node) => node.text === label)
    if (match) return { screenId: screen.id, sourceNodeId: match.id }
  }
  return { screenId: null, sourceNodeId: null }
}

function control(ir, id, type, label, value, options = {}) {
  return {
    id,
    type,
    label,
    value,
    options: options.options ?? null,
    min: options.min ?? null,
    max: options.max ?? null,
    step: options.step ?? null,
    unit: options.unit ?? null,
    description: options.description ?? null,
    events: options.events ?? (type === 'slider'
      ? ['dragStart', 'dragMove', 'dragEnd', 'valueChange']
      : type === 'memory'
        ? ['tap', 'longPress']
        : ['tap', 'valueChange']),
    ...textSource(ir, label),
  }
}

export function buildVehicleSettingsModel(ir) {
  return {
    schema: 'vehicle-settings-model@1.0.0',
    title: ir.source.pageName,
    viewport: ir.viewport,
    categories: [
      {
        id: 'incar', label: '车内', icon: 'armchair', tabs: ['座椅', '方控'], hero: 'seat',
        groups: [
          { title: '座椅位置', controls: [control(ir, 'seat.target', 'segment', '座椅位置', '主驾座椅', { options: ['主驾座椅', '副驾座椅'] })] },
          { title: '座椅记忆', note: '长按任意记忆位，保存新的主驾记忆位', controls: [control(ir, 'seat.memory', 'memory', '座椅记忆', '位置一', { options: ['位置一', '位置二', '位置三'], events: ['tap', 'longPress'] })] },
          { title: '座椅迎宾', controls: [
            control(ir, 'seat.welcome.driver', 'toggle', '主驾迎宾', true),
            control(ir, 'seat.welcome.passenger', 'toggle', '副驾迎宾', false),
            control(ir, 'seat.welcome.rearLeft', 'toggle', '二排左侧座椅迎宾', false),
            control(ir, 'seat.welcome.rearRight', 'toggle', '二排右侧座椅迎宾', false),
          ] },
        ],
      },
      {
        id: 'exterior', label: '车外', icon: 'car-front', tabs: ['门窗车锁', '外后视镜', '内后视镜'],
        groups: [
          { title: '门窗车锁', controls: [
            control(ir, 'door.slideMode', 'segment', '电动滑门模式切换', '自动模式', { options: ['手动模式', '自动模式'] }),
            control(ir, 'door.lockFeedback', 'segment', '锁车提示模式设置', '灯光和喇叭', { options: ['灯光和喇叭', '灯光', '喇叭'] }),
            control(ir, 'wiper.interval', 'segment', '雨刮间隙时间设置', '快速', { options: ['极速', '快速', '中速', '慢速'] }),
            control(ir, 'window.passengerLock', 'toggle', '乘客侧车窗锁止', false),
            control(ir, 'window.autoClose', 'toggle', '锁车自动关窗', true),
            control(ir, 'wiper.nozzleHeat', 'toggle', '雨刮喷嘴加热', false),
            control(ir, 'door.smartLock', 'toggle', '智能解闭锁模式', true),
          ] },
        ],
      },
      {
        id: 'lighting', label: '灯光', icon: 'lightbulb', tabs: ['车内灯光', '车外灯光'],
        groups: [
          { title: '氛围灯', controls: [
            control(ir, 'light.ambientMode', 'segment', '氛围灯模式切换', '静态', { options: ['关闭', '静态', '动态'] }),
            control(ir, 'light.ambientColor', 'color', '氛围灯颜色自定义调节', '#6270fe', { events: ['tap', 'dragStart', 'dragMove', 'dragEnd', 'valueChange'] }),
            control(ir, 'light.brightness', 'slider', '亮度自定义调节', 58, { min: 0, max: 100, step: 1, unit: '%' }),
          ] },
        ],
      },
      {
        id: 'drive', label: '驾驶', icon: 'gauge', tabs: ['驾驶设置', '辅助驾驶'],
        groups: [
          { title: '驾驶设置', controls: [
            control(ir, 'drive.steering', 'segment', '转向电动助力模式', '标准', { options: ['舒适', '标准', '运动'] }),
            control(ir, 'drive.mode', 'segment', '驾驶模式', '标准', { options: ['节能', '标准', '运动'] }),
            control(ir, 'drive.energy', 'segment', '能量模式', '燃油优先', { options: ['纯电优先', '燃油优先', '智能混动'] }),
            control(ir, 'drive.pedal', 'segment', '踏板感模式调节', '舒适模式', { options: ['舒适模式', '运动模式'] }),
          ] },
        ],
      },
      {
        id: 'energy', label: '能量', icon: 'battery-charging', tabs: ['能量管理', '充电设置'],
        groups: [
          { title: '能量管理', controls: [
            control(ir, 'energy.regen', 'segment', '能量回收', '弱', { options: ['关闭', '弱', '强'] }),
            control(ir, 'energy.range', 'segment', '续航显示', 'WLTC', { options: ['WLTC', 'CLTC'] }),
            control(ir, 'energy.sleepDelay', 'slider', '高温下电延时休眠', 0, { min: 0, max: 4, step: 0.5, unit: '小时' }),
            control(ir, 'energy.chargeDelay', 'toggle', '充电延时休眠', false),
            control(ir, 'energy.stopLevel', 'slider', '充电停止电量设置', 90, { min: 50, max: 100, step: 5, unit: '%' }),
          ] },
        ],
      },
      {
        id: 'sound', label: '声音', icon: 'volume-2', tabs: ['声音设置'],
        groups: [
          { title: '音量调节', controls: [
            control(ir, 'sound.media', 'slider', '媒体', 62, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'sound.navigation', 'slider', '导航', 48, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'sound.voice', 'slider', '语音', 55, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'sound.call', 'slider', '通话', 70, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'sound.keyTone', 'toggle', '按键提示音', true),
            control(ir, 'sound.navDuck', 'toggle', '导航压低媒体音量', true),
            control(ir, 'sound.voiceDuck', 'toggle', '语音压低媒体音量', true),
            control(ir, 'sound.eq', 'segment', '均衡器', '自然原声', { options: ['自然原声', '极致人声', '超重低音', '动感流行', '自定义'] }),
          ] },
        ],
      },
      {
        id: 'display', label: '显示', icon: 'monitor', tabs: ['显示设置', '仪表显示'],
        groups: [
          { title: '亮度调节', controls: [
            control(ir, 'display.centerBrightness', 'slider', '中控屏', 64, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'display.clusterBrightness', 'slider', '仪表屏', 48, { min: 0, max: 100, step: 1, unit: '%' }),
            control(ir, 'display.theme', 'segment', '显示设置', '深色', { options: ['深色', '浅色', '自动'] }),
            control(ir, 'display.clusterStyle', 'segment', '仪表显示', '标准', { options: ['标准', '简洁'] }),
            control(ir, 'display.clockFormat', 'segment', '时间显示格式', '24小时制', { options: ['12小时制', '24小时制'] }),
          ] },
        ],
      },
      {
        id: 'other', label: '其它', icon: 'settings-2', tabs: ['车辆信息', '车辆维护', '网络连接', '系统设置'],
        groups: [
          { title: '车辆信息', controls: [
            control(ir, 'vehicle.tripReset', 'action', '小计里程清零', null, { events: ['tap'] }),
            control(ir, 'vehicle.plate', 'action', '请输入车牌号', null, { events: ['tap'] }),
            control(ir, 'vehicle.network', 'action', '网络连接', null, { events: ['tap', 'navigation'] }),
            control(ir, 'vehicle.system', 'action', '系统设置', null, { events: ['tap', 'navigation'] }),
          ] },
        ],
      },
      {
        id: 'scene', label: '场景', icon: 'sparkles', tabs: ['情景模式'],
        groups: [
          { title: '情景模式', controls: [
            control(ir, 'scene.rest', 'scene', '休憩模式', false, { description: '放慢节奏 享受静谧时光', events: ['tap', 'longPress', 'valueChange'] }),
            control(ir, 'scene.wash', 'scene', '洗车模式', false, { description: '智能洗车 焕新出行', events: ['tap', 'valueChange'] }),
          ] },
        ],
      },
    ],
  }
}

export function attachSettingsHero(document, ir, model) {
  const seat = ir.screens.find((screen) => screen.name === '设置-车内-座椅')
  const reference = seat?.imageReferences.find((item) => item.name === '车内-座椅') || seat?.imageReferences[0]
  if (!reference) return model
  const dataUrl = imageDataUrl(document, reference)
  if (!dataUrl) return model
  return { ...model, heroImage: { dataUrl, reference } }
}

export function pageInspection(document, pageSelector) {
  const page = findPage(document, pageSelector)
  const frames = screenFrames(document, page)
  return {
    page: { id: idOf(page), name: page.name, childCount: childrenOf(document, page).length },
    screens: frames.map((frame) => ({
      id: idOf(frame),
      name: frame.name,
      width: frame.size?.x ?? 0,
      height: frame.size?.y ?? 0,
      textCount: uniqueTexts(document, frame).length,
      imageCount: imageReferences(document, frame).length,
      kind: deriveScreenKind(frame.name || ''),
    })),
  }
}
