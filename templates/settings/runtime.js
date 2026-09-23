(() => {
  const MODEL = window.__VEHICLE_UI_MODEL__;
  const SOURCE_IR = window.__VEHICLE_UI_IR__;
  if (!MODEL) throw new Error('Vehicle UI model is missing');

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screen = $('#vehicle-screen');
  const nav = $('#category-nav');
  const subTabs = $('#sub-tabs');
  const content = $('#settings-content');
  const scroll = $('#settings-scroll');
  const seatVisual = $('#seat-visual');
  const seatImage = $('#seat-image');
  const schematic = $('#vehicle-schematic');
  const dragPad = $('#seat-drag-pad');
  const toast = $('#toast');
  const modalLayer = $('#modal-layer');
  const modalTitle = $('#modal-title');
  const modalCopy = $('#modal-copy');
  const modalActions = $('#modal-actions');
  const state = loadState();
  const listeners = new Map();
  const adapters = new Map();
  let eventSequence = 0;
  let toastTimer = 0;
  let activeCategory = state.__category || MODEL.categories[0].id;
  let activeTabs = state.__tabs || {};

  function loadState() {
    const defaults = {};
    for (const category of MODEL.categories) {
      for (const group of category.groups) {
        for (const control of group.controls) defaults[control.id] = control.value;
      }
    }
    try {
      return {...defaults, ...JSON.parse(localStorage.getItem('vehicle-ui-state') || '{}')};
    } catch {
      return defaults;
    }
  }

  function saveState() {
    state.__category = activeCategory;
    state.__tabs = activeTabs;
    try { localStorage.setItem('vehicle-ui-state', JSON.stringify(state)); } catch {}
  }

  function sourceControl(componentId) {
    for (const category of MODEL.categories) {
      for (const group of category.groups) {
        const match = group.controls.find((item) => item.id === componentId);
        if (match) return match;
      }
    }
    return null;
  }

  function nativeDispatch(event) {
    const json = JSON.stringify(event);
    try { window.AndroidVehicleUI?.postMessage(json); } catch {}
    try { window.webkit?.messageHandlers?.vehicleUI?.postMessage(event); } catch {}
    try { window.vehicleUIBridge?.postMessage(json); } catch {}
    window.dispatchEvent(new CustomEvent('vehicle-ui:event', {detail: event}));
    for (const handler of adapters.values()) {
      try { handler(event); } catch (error) { console.error(error); }
    }
  }

  function dispatch(partial) {
    const control = sourceControl(partial.componentId);
    const event = Object.freeze({
      version: '1.0.0',
      id: `vehicle-ui-${Date.now()}-${++eventSequence}`,
      type: partial.type,
      componentId: partial.componentId,
      screenId: partial.screenId || activeCategory,
      timestamp: Date.now(),
      sourceNodeId: partial.sourceNodeId ?? control?.sourceNodeId ?? null,
      value: partial.value ?? null,
      previousValue: partial.previousValue ?? null,
      phase: partial.phase ?? null,
      pointer: partial.pointer ?? null,
      metadata: partial.metadata || {},
    });
    for (const key of [event.type, '*']) {
      for (const listener of listeners.get(key) || []) {
        try { listener(event); } catch (error) { console.error(error); }
      }
    }
    nativeDispatch(event);
    return event;
  }

  function on(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
    return () => off(type, listener);
  }

  function off(type, listener) {
    listeners.get(type)?.delete(listener);
  }

  function getState() {
    return JSON.parse(JSON.stringify(state));
  }

  function setState(path, value, source = 'external') {
    const previousValue = state[path];
    state[path] = value;
    saveState();
    dispatch({type:'stateChange', componentId:path, value, previousValue, metadata:{source}});
    renderCategory();
  }

  function registerAdapter(name, handler) {
    adapters.set(name, handler);
    return () => adapters.delete(name);
  }

  window.VehicleUI = Object.freeze({
    version: '1.0.0',
    contract: SOURCE_IR?.contract || null,
    on,
    off,
    dispatch,
    getState,
    setState,
    registerAdapter,
    source: Object.freeze({pageId:SOURCE_IR?.source?.pageId || null, pageName:SOURCE_IR?.source?.pageName || null}),
  });

  function icon(name) {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
  }

  function activeCategoryModel() {
    return MODEL.categories.find((category) => category.id === activeCategory) || MODEL.categories[0];
  }

  function renderNav() {
    nav.innerHTML = MODEL.categories.map((category) => `
      <button type="button" class="category-button${category.id === activeCategory ? ' is-active' : ''}" data-category="${category.id}">
        ${icon(category.icon)}<span>${category.label}</span>
      </button>`).join('');
    nav.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
      const previousValue = activeCategory;
      activeCategory = button.dataset.category;
      saveState();
      dispatch({type:'tap', componentId:`nav.${activeCategory}`, value:activeCategory, previousValue, metadata:{role:'category'}});
      dispatch({type:'navigation', componentId:`nav.${activeCategory}`, value:activeCategory, previousValue, metadata:{role:'category'}});
      render();
    }));
  }

  function renderTabs(category) {
    const current = activeTabs[category.id] || category.tabs[0];
    activeTabs[category.id] = current;
    subTabs.innerHTML = category.tabs.map((tab) => `<button type="button" class="sub-tab${tab === current ? ' is-active' : ''}" data-tab="${tab}">${tab}</button>`).join('');
    subTabs.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
      const previousValue = activeTabs[category.id];
      activeTabs[category.id] = button.dataset.tab;
      saveState();
      dispatch({type:'tap', componentId:`${category.id}.tab`, value:button.dataset.tab, previousValue, metadata:{role:'subTab'}});
      dispatch({type:'navigation', componentId:`${category.id}.tab`, value:button.dataset.tab, previousValue, metadata:{role:'subTab'}});
      renderTabs(category);
      refreshIcons();
    }));
  }

  function controlMarkup(control) {
    if (control.type === 'segment') {
      return `<div class="segmented" role="radiogroup" aria-label="${control.label}">${control.options.map((option) => `<button type="button" role="radio" aria-checked="${state[control.id] === option}" class="${state[control.id] === option ? 'is-active' : ''}" data-control="${control.id}" data-value="${option}">${option}</button>`).join('')}</div>`;
    }
    if (control.type === 'toggle') {
      return `<button type="button" class="toggle" role="switch" aria-label="${control.label}" aria-checked="${Boolean(state[control.id])}" data-control="${control.id}"></button>`;
    }
    if (control.type === 'slider') {
      const pct = ((Number(state[control.id]) - control.min) / (control.max - control.min)) * 100;
      return `<div class="slider-wrap"><input class="slider" style="--slider-pct:${pct}%" type="range" min="${control.min}" max="${control.max}" step="${control.step}" value="${state[control.id]}" data-control="${control.id}" aria-label="${control.label}"><output>${state[control.id]}${control.unit || ''}</output></div>`;
    }
    if (control.type === 'memory') {
      return `<div class="memory-grid">${control.options.map((option, index) => `<button type="button" class="memory-button${state[control.id] === option ? ' is-active' : ''}" data-memory="${option}" data-control="${control.id}"><strong>${option}</strong><span>记忆 ${index + 1}</span></button>`).join('')}</div>`;
    }
    if (control.type === 'color') {
      const colors = ['#6270fe','#23c9b8','#f5c451','#ff6d76','#b675f3','#f5f6fb'];
      return `<div class="color-control"><div class="color-swatches">${colors.map((color) => `<button type="button" aria-label="选择颜色 ${color}" class="color-swatch${state[control.id] === color ? ' is-active' : ''}" style="--swatch:${color}" data-control="${control.id}" data-value="${color}"></button>`).join('')}</div></div>`;
    }
    if (control.type === 'action') {
      return `<button type="button" class="action-button" data-control="${control.id}">${control.label}${icon('chevron-right')}</button>`;
    }
    if (control.type === 'scene') {
      return `<button type="button" class="scene-button${state[control.id] ? ' is-active' : ''}" data-control="${control.id}"><strong>${control.label}</strong><span>${control.description || ''}</span></button>`;
    }
    return '';
  }

  function rowMarkup(control) {
    if (control.type === 'memory') return `<div class="control-block">${controlMarkup(control)}</div>`;
    if (control.type === 'scene') return controlMarkup(control);
    return `<div class="control-row"><div class="control-label">${control.label}${control.description ? `<span class="control-description">${control.description}</span>` : ''}</div>${controlMarkup(control)}</div>`;
  }

  function renderCategory() {
    const category = activeCategoryModel();
    renderTabs(category);
    content.innerHTML = category.groups.map((group) => `
      <section class="settings-group">
        <div class="group-heading"><h2>${group.title}</h2>${group.note ? `<p>${group.note}</p>` : ''}</div>
        <div class="${group.controls.every((item) => item.type === 'scene') ? 'scene-list' : 'control-list'}">${group.controls.map(rowMarkup).join('')}</div>
      </section>`).join('');
    bindControls(category);
    scroll.scrollTop = 0;
    seatVisual.hidden = category.hero !== 'seat';
    schematic.hidden = category.hero === 'seat';
    if (category.hero === 'seat' && MODEL.heroImage?.dataUrl) seatImage.src = MODEL.heroImage.dataUrl;
    refreshIcons();
  }

  function updateControl(control, value, type = 'valueChange', metadata = {}) {
    const previousValue = state[control.id];
    state[control.id] = value;
    saveState();
    dispatch({type, componentId:control.id, value, previousValue, sourceNodeId:control.sourceNodeId, metadata});
    if (control.id === 'display.theme') applyTheme(value);
  }

  function bindControls(category) {
    content.querySelectorAll('.segmented [data-control]').forEach((button) => button.addEventListener('click', () => {
      const control = sourceControl(button.dataset.control);
      dispatch({type:'tap', componentId:control.id, value:button.dataset.value, sourceNodeId:control.sourceNodeId});
      updateControl(control, button.dataset.value);
      renderCategory();
    }));
    content.querySelectorAll('.toggle').forEach((button) => button.addEventListener('click', () => {
      const control = sourceControl(button.dataset.control);
      const next = !state[control.id];
      dispatch({type:'tap', componentId:control.id, value:next, previousValue:state[control.id], sourceNodeId:control.sourceNodeId});
      updateControl(control, next);
      button.setAttribute('aria-checked', String(next));
    }));
    content.querySelectorAll('.color-swatch').forEach((button) => button.addEventListener('click', () => {
      const control = sourceControl(button.dataset.control);
      dispatch({type:'tap', componentId:control.id, value:button.dataset.value, sourceNodeId:control.sourceNodeId});
      updateControl(control, button.dataset.value);
      renderCategory();
    }));
    content.querySelectorAll('.slider').forEach((input) => {
      const control = sourceControl(input.dataset.control);
      input.addEventListener('pointerdown', (event) => dispatch(pointerEvent('dragStart', control, event, 'start')));
      input.addEventListener('input', (event) => {
        const value = Number(input.value);
        updateControl(control, value, 'valueChange', {input:'range'});
        input.style.setProperty('--slider-pct', `${((value-control.min)/(control.max-control.min))*100}%`);
        input.nextElementSibling.value = `${value}${control.unit || ''}`;
        dispatch(pointerEvent('dragMove', control, event, 'move', value));
      });
      input.addEventListener('pointerup', (event) => dispatch(pointerEvent('dragEnd', control, event, 'end', Number(input.value))));
    });
    content.querySelectorAll('.memory-button').forEach(bindMemoryButton);
    content.querySelectorAll('.action-button').forEach((button) => button.addEventListener('click', () => handleAction(sourceControl(button.dataset.control))));
    content.querySelectorAll('.scene-button').forEach((button) => button.addEventListener('click', () => handleScene(sourceControl(button.dataset.control))));
  }

  function pointerEvent(type, control, event, phase, value = null) {
    return {
      type,
      componentId:control.id,
      value,
      phase,
      sourceNodeId:control.sourceNodeId,
      pointer:{x:event.clientX ?? 0,y:event.clientY ?? 0,deltaX:0,deltaY:0,pointerType:event.pointerType || 'mouse'},
    };
  }

  function bindMemoryButton(button) {
    const control = sourceControl(button.dataset.control);
    let timer = 0;
    let held = false;
    let origin = null;
    const cancel = () => { clearTimeout(timer); timer = 0; button.classList.remove('is-holding'); };
    button.addEventListener('pointerdown', (event) => {
      held = false;
      origin = {x:event.clientX,y:event.clientY};
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('is-holding');
      timer = setTimeout(() => {
        held = true;
        const value = button.dataset.memory;
        updateControl(control, value, 'longPress', {durationMs:650, action:'saveMemory'});
        showToast(`${value}已保存`);
        cancel();
      }, 650);
    });
    button.addEventListener('pointermove', (event) => {
      if (origin && Math.hypot(event.clientX-origin.x,event.clientY-origin.y) > 16) cancel();
    });
    button.addEventListener('pointerup', () => {
      cancel();
      if (held) return;
      const value = button.dataset.memory;
      dispatch({type:'tap', componentId:control.id, value, previousValue:state[control.id], sourceNodeId:control.sourceNodeId, metadata:{action:'recallMemory'}});
      updateControl(control, value);
      renderCategory();
    });
    button.addEventListener('pointercancel', cancel);
  }

  function handleAction(control) {
    dispatch({type:'tap', componentId:control.id, sourceNodeId:control.sourceNodeId});
    if (control.id === 'vehicle.tripReset') {
      openModal('小计里程清零', '是否确认清除当前小计里程？', [
        {label:'取消', value:false},
        {label:'确认清零', value:true, primary:true, action:() => showToast('小计里程已清零')},
      ], control);
      return;
    }
    const value = control.label;
    dispatch({type:'navigation', componentId:control.id, value, sourceNodeId:control.sourceNodeId});
    showToast(`进入${value}`);
  }

  function handleScene(control) {
    const next = !state[control.id];
    dispatch({type:'tap', componentId:control.id, value:next, previousValue:state[control.id], sourceNodeId:control.sourceNodeId});
    const activate = () => {
      updateControl(control, next);
      showToast(`${control.label}${next ? '已开启' : '已关闭'}`);
      renderCategory();
    };
    if (next) openModal(control.label, `是否开启${control.label}？`, [{label:'取消',value:false},{label:'开启',value:true,primary:true,action:activate}], control);
    else activate();
  }

  function openModal(title, copy, actions, control) {
    modalTitle.textContent = title;
    modalCopy.textContent = copy;
    modalActions.innerHTML = '';
    actions.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      if (item.primary) button.className = 'primary';
      button.addEventListener('click', () => {
        dispatch({type:'tap', componentId:`${control.id}.dialog.${item.value ? 'confirm' : 'cancel'}`, value:item.value, sourceNodeId:control.sourceNodeId, metadata:{dialog:title}});
        closeModal();
        item.action?.();
      });
      modalActions.append(button);
    });
    modalLayer.hidden = false;
  }

  function closeModal() { modalLayer.hidden = true; }
  $('.modal-mask').addEventListener('click', closeModal);

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  }

  function applyTheme(choice) {
    const light = choice === '浅色' || (choice === '自动' && matchMedia('(prefers-color-scheme:light)').matches);
    document.body.classList.toggle('theme-light', light);
    document.body.classList.toggle('theme-dark', !light);
  }

  function bindSeatDrag() {
    let active = null;
    let value = Number(state['seat.position'] ?? 50);
    const render = () => {
      dragPad.style.setProperty('--seat-position', `${value}%`);
      dragPad.setAttribute('aria-valuenow', String(Math.round(value)));
    };
    dragPad.addEventListener('pointerdown', (event) => {
      active = {id:event.pointerId,x:event.clientX,y:event.clientY,value};
      dragPad.setPointerCapture(event.pointerId);
      dispatch({type:'dragStart',componentId:'seat.position',value,phase:'start',pointer:{x:event.clientX,y:event.clientY,deltaX:0,deltaY:0,pointerType:event.pointerType}});
    });
    dragPad.addEventListener('pointermove', (event) => {
      if (!active || active.id !== event.pointerId) return;
      const rect = dragPad.getBoundingClientRect();
      value = Math.max(0,Math.min(100,((event.clientX-rect.left)/rect.width)*100));
      state['seat.position'] = Math.round(value);
      render();
      dispatch({type:'dragMove',componentId:'seat.position',value:Math.round(value),phase:'move',pointer:{x:event.clientX,y:event.clientY,deltaX:event.clientX-active.x,deltaY:event.clientY-active.y,pointerType:event.pointerType}});
    });
    const end = (event) => {
      if (!active || active.id !== event.pointerId) return;
      dispatch({type:'dragEnd',componentId:'seat.position',value:Math.round(value),previousValue:active.value,phase:'end',pointer:{x:event.clientX,y:event.clientY,deltaX:event.clientX-active.x,deltaY:event.clientY-active.y,pointerType:event.pointerType}});
      dispatch({type:'valueChange',componentId:'seat.position',value:Math.round(value),previousValue:active.value,metadata:{input:'drag'}});
      saveState();
      active = null;
    };
    dragPad.addEventListener('pointerup', end);
    dragPad.addEventListener('pointercancel', end);
    dragPad.addEventListener('keydown', (event) => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      const previousValue = value;
      value = Math.max(0,Math.min(100,value+(event.key === 'ArrowRight' ? 2 : -2)));
      state['seat.position'] = Math.round(value);
      render();
      dispatch({type:'valueChange',componentId:'seat.position',value:Math.round(value),previousValue,metadata:{input:'keyboard'}});
    });
    render();
  }

  function bindSwipeTelemetry() {
    let start = null;
    scroll.addEventListener('pointerdown', (event) => { start = {x:event.clientX,y:event.clientY}; });
    scroll.addEventListener('pointerup', (event) => {
      if (!start) return;
      const dx = event.clientX-start.x;
      const dy = event.clientY-start.y;
      if (Math.hypot(dx,dy) > 70) dispatch({type:'swipe',componentId:'settings.scroll',value:Math.abs(dy)>Math.abs(dx)?(dy<0?'up':'down'):(dx<0?'left':'right'),pointer:{x:event.clientX,y:event.clientY,deltaX:dx,deltaY:dy,pointerType:event.pointerType}});
      start = null;
    });
  }

  function bindDock() {
    $$('.dock-button').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.dock;
      dispatch({type:'tap',componentId:`dock.${id}`,value:id,metadata:{role:'dock'}});
      if (id === 'settings') return showToast('已在设置');
      showToast(id === 'home' ? '返回主页' : `${button.getAttribute('aria-label')}已选择`);
    }));
    $$('[data-climate]').forEach((button) => button.addEventListener('click', () => {
      const [side,direction] = button.dataset.climate.split('-');
      const target = side === 'driver' ? $('#driver-temp') : $('#passenger-temp');
      const previousValue = Number(target.textContent);
      const value = Math.max(16,Math.min(30,previousValue+(direction === 'up' ? .5 : -.5)));
      target.textContent = value.toFixed(1);
      dispatch({type:'tap',componentId:`climate.${side}.${direction}`,value});
      dispatch({type:'valueChange',componentId:`climate.${side}.temperature`,value,previousValue});
    }));
  }

  function refreshIcons() { window.lucide?.createIcons({attrs:{'stroke-width':2}}); }
  function updateClock() { $('#status-time').textContent = new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}); }
  function fitScreen() { const rect=$('#app-shell').getBoundingClientRect();screen.style.transform=`scale(${Math.min(rect.width/1920,rect.height/1200)})`; }

  function render() {
    renderNav();
    renderCategory();
    refreshIcons();
  }

  applyTheme(state['display.theme'] || '深色');
  bindSeatDrag();
  bindSwipeTelemetry();
  bindDock();
  render();
  updateClock();
  fitScreen();
  setInterval(updateClock,1000);
  addEventListener('resize',fitScreen);
  matchMedia('(prefers-color-scheme:light)').addEventListener?.('change',() => {if(state['display.theme']==='自动')applyTheme('自动');});
})();
