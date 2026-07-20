(() => {
  'use strict';

  const LEGACY_WEIGHT = { A: 5, B: 4, C: 3, D: 2 };
  // A fresh composition seed is created for every page load. The layout remains
  // stable during the current visit, but changes the next time the site opens.
  const SESSION_SALT = (() => {
    try {
      const values = new Uint32Array(2);
      crypto.getRandomValues(values);
      return `${values[0].toString(36)}-${values[1].toString(36)}`;
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  })();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const hash = value => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const random = seed => {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const signed = seed => random(seed) * 2 - 1;
  const visualWeight = value => {
    const key = String(value ?? '').trim().toUpperCase();
    if (LEGACY_WEIGHT[key]) return LEGACY_WEIGHT[key];
    const n = Number(key);
    return Number.isFinite(n) ? clamp(Math.round(n), 1, 5) : 1;
  };

  function deviceMode() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    if (width <= 620) return 'mobile';
    if (touch && height >= width) return 'tablet-portrait';
    if (touch) return 'tablet-landscape';
    return 'desktop';
  }

  const slots = {
    desktop: [
      // The primary Hero is always complete and near the visual centre.
      { x:51, y:47, r:4, role:'hero', primary:true },
      // A second strong object may create edge tension, but is never half-hidden.
      { x:8, y:29, r:-15, role:'hero', overflow:true },
      { x:82, y:23, r:9, role:'secondary' },
      { x:78, y:72, r:-10, role:'secondary' },
      { x:24, y:73, r:8, role:'secondary' },
      { x:31, y:30, r:-7, role:'standard' },
      { x:66, y:28, r:7, role:'standard' },
      { x:12, y:55, r:12, role:'standard' },
      { x:91, y:53, r:-12, role:'standard', overflow:true },
      { x:43, y:75, r:-5, role:'standard' },
      { x:63, y:79, r:10, role:'standard' },
      { x:18, y:89, r:-8, role:'accent', overflow:true },
      { x:87, y:87, r:7, role:'accent', overflow:true },
      { x:43, y:18, r:12, role:'accent' },
      { x:58, y:90, r:-10, role:'accent', overflow:true }
    ],
    'tablet-landscape': [
      { x:51, y:47, r:4, role:'hero', primary:true },
      { x:9, y:29, r:-13, role:'hero', overflow:true },
      { x:81, y:24, r:8, role:'secondary' },
      { x:76, y:72, r:-8, role:'secondary' },
      { x:24, y:72, r:7, role:'secondary' },
      { x:31, y:31, r:-6, role:'standard' },
      { x:66, y:29, r:6, role:'standard' },
      { x:12, y:56, r:10, role:'standard' },
      { x:90, y:54, r:-10, role:'standard', overflow:true },
      { x:44, y:76, r:-4, role:'standard' },
      { x:63, y:80, r:8, role:'accent' },
      { x:20, y:89, r:-7, role:'accent', overflow:true },
      { x:85, y:88, r:6, role:'accent', overflow:true },
      { x:47, y:18, r:10, role:'accent' }
    ],
    'tablet-portrait': [
      { x:50, y:31, r:-5, role:'hero', primary:true },
      { x:18, y:50, r:-12, role:'secondary' },
      { x:79, y:49, r:10, role:'secondary' },
      { x:52, y:61, r:5, role:'standard' },
      { x:23, y:71, r:8, role:'standard' },
      { x:79, y:72, r:-8, role:'standard' },
      { x:8, y:37, r:10, role:'standard', overflow:true },
      { x:92, y:34, r:-9, role:'accent', overflow:true },
      { x:47, y:82, r:-5, role:'standard' },
      { x:17, y:91, r:7, role:'accent', overflow:true },
      { x:82, y:91, r:-6, role:'accent', overflow:true },
      { x:48, y:17, r:6, role:'accent' }
    ],
    mobile: [
      { x:50, y:29, r:-4, role:'hero', primary:true },
      { x:18, y:49, r:-11, role:'secondary' },
      { x:81, y:50, r:9, role:'secondary' },
      { x:51, y:62, r:4, role:'standard' },
      { x:19, y:71, r:8, role:'standard' },
      { x:81, y:72, r:-7, role:'standard' },
      { x:3, y:37, r:8, role:'standard', overflow:true },
      { x:96, y:36, r:-8, role:'accent', overflow:true },
      { x:49, y:82, r:-4, role:'standard' },
      { x:16, y:91, r:6, role:'accent', overflow:true },
      { x:83, y:91, r:-6, role:'accent', overflow:true },
      { x:50, y:17, r:5, role:'accent' }
    ]
  };

  const baseWidths = {
    desktop: { 1:10.5, 2:13.5, 3:17.5, 4:22.5, 5:31.5 },
    'tablet-landscape': { 1:10, 2:13, 3:17, 4:21.5, 5:28.5 },
    'tablet-portrait': { 1:11.5, 2:15, 3:20, 4:26, 5:35 },
    mobile: { 1:16.5, 2:21.5, 3:27.0, 4:33.0, 5:39.5 }
  };

  function activeDateKey() {
    const active = document.querySelector('.timeline-track button.is-active');
    return active?.getAttribute('aria-label') || active?.textContent?.trim() || 'today';
  }

  function imageShape(img) {
    const width = img?.naturalWidth || img?.width || 1;
    const height = img?.naturalHeight || img?.height || 1;
    const ratio = width / Math.max(1, height);
    if (ratio >= 1.58) return { type:'wide', ratio };
    if (ratio <= .7) return { type:'tall', ratio };
    if (ratio >= .84 && ratio <= 1.2) return { type:'square', ratio };
    return { type:'regular', ratio };
  }

  function compatibleSlots(weight, mode) {
    const all = slots[mode];
    if (weight >= 5) return [...all.filter(s=>s.role==='hero'), ...all.filter(s=>s.role==='secondary'), ...all.filter(s=>s.role==='standard')];
    if (weight === 4) return [...all.filter(s=>s.role==='secondary'), ...all.filter(s=>s.role==='hero'), ...all.filter(s=>s.role==='standard')];
    if (weight === 3) return [...all.filter(s=>s.role==='standard'), ...all.filter(s=>s.role==='secondary'), ...all.filter(s=>s.role==='accent')];
    return [...all.filter(s=>s.role==='accent'), ...all.filter(s=>s.role==='standard'), ...all.filter(s=>s.role==='secondary')];
  }

  function estimatedRect(slot, widthPct, ratio) {
    const heightPct = widthPct / clamp(ratio, .55, 1.9) * (window.innerWidth / Math.max(window.innerHeight, 1));
    return {
      left:slot.x-widthPct/2, right:slot.x+widthPct/2,
      top:slot.y-heightPct/2, bottom:slot.y+heightPct/2,
      width:widthPct, height:heightPct
    };
  }

  function overlap(a,b) {
    const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const area=w*h;
    return area/Math.max(1,Math.min(a.width*a.height,b.width*b.height));
  }

  let lastSignature = '';
  let scheduled = 0;

  function layout(force=false) {
    const view = document.querySelector('.objects-view');
    if (!view) return;
    const elements = [...view.querySelectorAll('.floating-object')];
    if (!elements.length) return;
    const mode = deviceMode();
    const prepared = elements.map((el,index) => {
      const img=el.querySelector('img');
      const weight=visualWeight(el.dataset.visualWeight);
      const id=el.dataset.objectId || img?.src || String(index);
      const shape=imageShape(img);
      return {el,img,index,weight,id,shape,key:hash(`${SESSION_SALT}|${activeDateKey()}|${mode}|${id}`)};
    }).sort((a,b)=>b.weight-a.weight || a.key-b.key);
    const signature = `${SESSION_SALT}|${activeDateKey()}|${mode}|${Math.round(innerWidth/40)}|${Math.round(innerHeight/40)}|` + prepared.map(x=>`${x.id}:${x.weight}:${x.shape.type}`).join('|');
    if (!force && signature === lastSignature && prepared.every(x=>x.el.dataset.posterReady==='1')) return;
    lastSignature=signature;

    const used=new Set();
    const rects=[];
    const primaryHeroIndex = prepared.findIndex(item => item.weight === 5);
    const primarySlotIndex = slots[mode].findIndex(slot => slot.primary);
    const compositionKey = hash(`${SESSION_SALT}|${activeDateKey()}|${mode}|composition`);

    prepared.forEach((item,order)=>{
      const shapeFactor=item.shape.type==='wide'?1.10:item.shape.type==='tall'?.86:item.shape.type==='square'?1.06:1;
      const jitter=.90+random(item.key+17)*.20;
      let width=baseWidths[mode][item.weight]*shapeFactor*jitter;

      // Mobile needs a deliberately wider visual gap between weights. Generic
      // image-height caps previously flattened weights 3–5 into nearly the same
      // apparent size, especially for portrait images. Keep each level in its own
      // non-overlapping band so weight remains visible at a glance.
      if (mode === 'mobile') {
        const mobileBands = {
          1: [14.5, 17.5],
          2: [19.0, 23.0],
          3: [24.5, 29.0],
          4: [30.5, 35.5],
          5: [37.5, 42.0]
        };
        const [minWidth, maxWidth] = mobileBands[item.weight];
        width = clamp(width, minWidth, maxWidth);
      }

      if (mode === 'tablet-portrait') {
        const tabletPortraitBands = {
          1: [9.5, 14],
          2: [13.5, 18.5],
          3: [18.5, 24.5],
          4: [25.5, 33],
          5: [35, 43]
        };
        const [minWidth, maxWidth] = tabletPortraitBands[item.weight];
        width = clamp(width, minWidth, maxWidth);
      }
      let chosen=null,chosenIndex=-1,bestScore=Infinity;

      // The first weight-5 object is always the complete central Hero.
      if (order === primaryHeroIndex && primarySlotIndex >= 0) {
        chosen = slots[mode][primarySlotIndex];
        chosenIndex = primarySlotIndex;
        width *= mode === 'mobile' ? 1 : mode === 'tablet-portrait' ? .98 : .92;
        if (mode === 'mobile') width = Math.max(width, 39);
        if (mode === 'tablet-portrait') width = Math.max(width, 37);
      } else {
        const candidates=compatibleSlots(item.weight,mode);
        candidates.forEach((slot,idx)=>{
          const globalIndex=slots[mode].indexOf(slot);
          if(used.has(globalIndex))return;
          if(slot.primary)return;
          if(slot.role==='hero'&&item.weight<4)return;
          if(slot.overflow&&item.weight<4)return;
          const rect=estimatedRect(slot,width,item.shape.ratio);
          const maxOverlap=rects.reduce((m,r)=>Math.max(m,overlap(rect,r.rect)),0);
          const rolePenalty=item.weight>=5?(slot.role==='hero'?0:slot.role==='secondary'?1:3):item.weight===4?(slot.role==='secondary'?0:slot.role==='hero'?1:2):item.weight===3?(slot.role==='standard'?0:1):(slot.role==='accent'?0:1);
          // Session-based variation changes slot choices on every new page load.
          const variation=random(item.key + compositionKey + globalIndex*997)*.72;
          const score=maxOverlap*12+rolePenalty+variation+idx*.006;
          if(score<bestScore){bestScore=score;chosen=slot;chosenIndex=globalIndex;}
        });
      }

      if(!chosen){
        chosen=slots[mode].find((slot,i)=>!used.has(i)&&!slot.primary) || slots[mode][order%slots[mode].length];
        chosenIndex=slots[mode].indexOf(chosen);
      }
      used.add(chosenIndex);

      const isPrimary = chosen.primary === true;
      const maxRotation=item.shape.type==='wide'?(mode==='mobile'?14:23):item.shape.type==='tall'?(mode==='mobile'?15:26):(mode==='mobile'?9:15);
      const weightCalm=(item.weight>=5?.52:item.weight===4?.75:1);
      const rotation=clamp(chosen.r + signed(item.key+29)*6*weightCalm,-maxRotation,maxRotation);
      const xJitter=isPrimary?(mode==='mobile'?1.2:2.2):(chosen.role==='hero'?2.2:3.6);
      const yJitter=isPrimary?(mode==='mobile'?1.4:2.4):(chosen.role==='hero'?2.0:3.0);
      const x=chosen.x + signed(item.key+37)*xJitter;
      const y=chosen.y + signed(item.key+43)*yJitter;
      const rect=estimatedRect({x,y},width,item.shape.ratio);
      rects.push({rect,weight:item.weight});

      const floatScale=item.weight>=5?.72:item.weight===4?.86:1;
      const floatX1=signed(item.key+53)*(3.5+random(item.key+54)*4.5)*floatScale;
      const floatY1=-(5+random(item.key+55)*6.5)*floatScale;
      const floatX2=-floatX1*.55 + signed(item.key+56)*1.8;
      const floatY2=(1.5+random(item.key+57)*4)*floatScale;
      const floatRotate=signed(item.key+58)*(item.weight>=5?.65:1.15);
      const floatDuration=7.2+random(item.key+59)*5.8;
      const breathDuration=5.8+random(item.key+60)*4.2;
      const breathScale=1.014+random(item.key+61)*.024;
      const delay=-random(item.key+62)*floatDuration;

      item.el.style.setProperty('--left',`${x.toFixed(2)}%`);
      item.el.style.setProperty('--top',`${y.toFixed(2)}%`);
      item.el.style.setProperty('--width',`${width.toFixed(2)}%`);
      item.el.style.width = `${width.toFixed(2)}%`;
      item.el.style.setProperty('--rotation',`${rotation.toFixed(2)}deg`);
      item.el.style.setProperty('--object-scale','1');
      item.el.style.setProperty('--object-opacity',String(item.weight===1?.84:item.weight===2?.9:item.weight===3?.95:1));
      item.el.style.setProperty('--float-x1',`${floatX1.toFixed(2)}px`);
      item.el.style.setProperty('--float-y1',`${floatY1.toFixed(2)}px`);
      item.el.style.setProperty('--float-x2',`${floatX2.toFixed(2)}px`);
      item.el.style.setProperty('--float-y2',`${floatY2.toFixed(2)}px`);
      item.el.style.setProperty('--float-rotate',`${floatRotate.toFixed(2)}deg`);
      item.el.style.setProperty('--float-duration',`${floatDuration.toFixed(2)}s`);
      item.el.style.setProperty('--breath-duration',`${breathDuration.toFixed(2)}s`);
      item.el.style.setProperty('--breath-scale',breathScale.toFixed(4));
      item.el.style.setProperty('--float-delay',`${delay.toFixed(2)}s`);
      item.el.style.zIndex=String(item.weight*10+(isPrimary?9:chosen.role==='hero'?7:chosen.role==='secondary'?4:1));
      item.el.dataset.hero=chosen.role==='hero'?'true':'false';
      item.el.dataset.primaryHero=isPrimary?'true':'false';
      item.el.dataset.shape=item.shape.type;
      item.el.dataset.posterReady='1';
    });
  }

  function schedule(force=false){
    cancelAnimationFrame(scheduled);
    scheduled=requestAnimationFrame(()=>layout(force));
  }
  new MutationObserver(()=>schedule(false)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',()=>schedule(true),{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(()=>schedule(true),180),{passive:true});
  window.addEventListener('load',()=>schedule(true));
  document.addEventListener('load',event=>{if(event.target?.closest?.('.floating-object'))schedule(true)},true);
  schedule(true);
})();

/* Gallery saved rail uses native browser scrolling; custom edge resistance removed. */

/* 2026-07-12 — center active month/year and harden gallery action isolation */
(() => {
  'use strict';
  let raf = 0;
  function centerCalendar() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      document.querySelectorAll('.calendar-months,.calendar-years').forEach(rail => {
        const active = rail.querySelector('button.is-active');
        if (!active) return;
        const target = active.offsetLeft + active.offsetWidth / 2 - rail.clientWidth / 2;
        rail.scrollLeft = Math.max(0, target);
      });
    });
  }
  document.addEventListener('pointerdown', event => {
    const action = event.target.closest?.('.gallery-action');
    if (!action) return;
    event.stopPropagation();
  }, true);
  document.addEventListener('pointerup', event => {
    const action = event.target.closest?.('.gallery-action');
    if (!action) return;
    event.stopPropagation();
  }, true);
  new MutationObserver(centerCalendar).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',centerCalendar);
  window.addEventListener('load',centerCalendar);
})();

/* 2026-07-12 — lock drawer bottom padding to the rendered cabinet height */
(() => {
  'use strict';
  let frame = 0;
  function syncDrawerGeometry(){
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      document.querySelectorAll('.gallery-drawer').forEach(drawer => {
        const card = drawer.querySelector('.gallery-drawer-card');
        if (!card) {
          drawer.style.removeProperty('--drawer-stable-height');
          return;
        }
        const css = getComputedStyle(drawer);
        const topPad = parseFloat(css.getPropertyValue('--drawer-top-pad')) || 24;
        const bottomPad = parseFloat(css.getPropertyValue('--drawer-bottom-pad')) || 28;
        const cardHeight = Math.ceil(card.getBoundingClientRect().height);
        const available = Math.max(180, window.innerHeight - (window.innerWidth <= 620 ? 92 : 118));
        const target = Math.min(available, cardHeight + topPad + bottomPad);
        drawer.style.setProperty('--drawer-stable-height', `${target}px`);
      });
    });
  }
  const observer = new MutationObserver(syncDrawerGeometry);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  window.addEventListener('resize',syncDrawerGeometry,{passive:true});
  window.addEventListener('load',syncDrawerGeometry);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(syncDrawerGeometry);
    const attach = () => document.querySelectorAll('.gallery-drawer-card').forEach(card => ro.observe(card));
    new MutationObserver(attach).observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('load',attach);
  }
})();

/* Exact underline sizing for the current date. */
(() => {
  let raf = 0;
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      document.querySelectorAll('.timeline-track button.is-active').forEach(button => {
        const probe = document.createElement('span');
        const style = getComputedStyle(button);
        probe.textContent = (button.textContent || '').trim();
        Object.assign(probe.style, {
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight
        });
        document.body.appendChild(probe);
        const width = Math.max(1, Math.ceil(probe.getBoundingClientRect().width));
        probe.remove();
        button.style.setProperty('--timeline-label-width', `${width}px`);
      });
    });
  };
  new MutationObserver(sync).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('load', sync);
  document.fonts?.ready?.then(sync);
  sync();
})();


/* 2026-07-12 — restrained cross-mode transition cue */
(() => {
  let timer=0;
  document.addEventListener('pointerdown', event => {
    const button=event.target.closest?.('.mode-switcher .icon-button');
    if(!button || button.classList.contains('is-active')) return;
    const stage=document.querySelector('.main-stage');
    if(!stage) return;
    stage.classList.remove('is-mode-switching');
    void stage.offsetWidth;
    stage.classList.add('is-mode-switching');
    clearTimeout(timer);
    timer=setTimeout(()=>stage.classList.remove('is-mode-switching'),650);
  }, true);
})();

/* 2026-07-12 — FLIP cabinet reflow + measured timeline step */
(() => {
  'use strict';
  let before = null;
  let scheduled = false;

  function snapshot() {
    const map = new Map();
    document.querySelectorAll('.gallery-grid .gallery-card, .gallery-drawer-grid .gallery-card').forEach(card => {
      const id = card.dataset.id;
      if (id) map.set(`${card.closest('.gallery-drawer-grid') ? 'drawer' : 'main'}:${id}`, card.getBoundingClientRect());
    });
    return map;
  }

  function animateReflow(oldRects) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.gallery-grid .gallery-card, .gallery-drawer-grid .gallery-card').forEach(card => {
        const id = card.dataset.id;
        if (!id) return;
        const key = `${card.closest('.gallery-drawer-grid') ? 'drawer' : 'main'}:${id}`;
        const old = oldRects.get(key);
        if (!old) return;
        const now = card.getBoundingClientRect();
        const dx = old.left - now.left;
        const dy = old.top - now.top;
        if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
        card.classList.add('gallery-layout-shift');
        card.animate([
          { transform:`translate3d(${dx}px,${dy}px,0)` },
          { transform:'translate3d(0,0,0)' }
        ], { duration:360, easing:'cubic-bezier(.22,.72,.18,1)' }).finished
          .catch(()=>{})
          .finally(()=>card.classList.remove('gallery-layout-shift'));
      });
    }));
  }

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest?.('.gallery-action')) return;
    before = snapshot();
    scheduled = true;
  }, true);

  const mo = new MutationObserver(() => {
    if (!scheduled || !before) return;
    scheduled = false;
    const old = before;
    before = null;
    animateReflow(old);
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});

  function syncTimelineStep(){
    document.querySelectorAll('.timeline-track').forEach(track => {
      const buttons = [...track.querySelectorAll('button')];
      if (buttons.length < 2) return;
      const a = buttons[Math.max(0,Math.floor(buttons.length/2)-1)].getBoundingClientRect();
      const b = buttons[Math.floor(buttons.length/2)].getBoundingClientRect();
      const step = Math.abs(b.left-a.left) || b.width;
      track.style.setProperty('--timeline-step',`${step}px`);
    });
  }
  new MutationObserver(syncTimelineStep).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',syncTimelineStep,{passive:true});
  window.addEventListener('load',syncTimelineStep);
  syncTimelineStep();
})();

/* 2026-07-12 — robust two-rail FLIP reflow (main gallery + saved drawer). */
(() => {
  'use strict';
  const selector = '.gallery-grid .gallery-card, .gallery-drawer-grid .gallery-card';
  let pending = null;
  let token = 0;

  const railKey = card => card.closest('.gallery-drawer-grid') ? 'drawer' : 'main';
  const keyFor = card => `${railKey(card)}:${card.dataset.id || ''}`;

  function takeSnapshot(){
    const result = new Map();
    document.querySelectorAll(selector).forEach(card => {
      if (!card.dataset.id) return;
      result.set(keyFor(card), card.getBoundingClientRect());
    });
    return result;
  }

  function animateFrom(snapshot, ownToken){
    if (!snapshot || ownToken !== token) return;
    const cards = [...document.querySelectorAll(selector)];
    cards.forEach(card => {
      const oldRect = snapshot.get(keyFor(card));
      if (!oldRect) return;
      const newRect = card.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      const sx = oldRect.width && newRect.width ? oldRect.width / newRect.width : 1;
      const sy = oldRect.height && newRect.height ? oldRect.height / newRect.height : 1;
      if (Math.abs(dx) < .75 && Math.abs(dy) < .75 && Math.abs(sx-1) < .01 && Math.abs(sy-1) < .01) return;

      card.getAnimations().forEach(a => {
        if (a.id === 'gallery-reflow-v2') a.cancel();
      });
      card.classList.add('gallery-reflow-v2');
      const anim = card.animate([
        {transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy})`, opacity:.88},
        {transform:'translate3d(0,0,0) scale(1,1)', opacity:1}
      ],{
        id:'gallery-reflow-v2',
        duration:520,
        easing:'cubic-bezier(.18,.76,.16,1)',
        fill:'both'
      });
      anim.finished.catch(()=>{}).finally(()=>card.classList.remove('gallery-reflow-v2'));
    });
  }

  document.addEventListener('pointerdown', event => {
    const action = event.target.closest?.('.gallery-action');
    if (!action) return;
    token += 1;
    const ownToken = token;
    pending = takeSnapshot();

    // React commits after the click handler. Observe a few frames so layout, images and
    // the horizontal saved rail have all reached their final positions before FLIP.
    [48, 96, 180].forEach((delay, index) => {
      setTimeout(() => {
        if (ownToken !== token || !pending) return;
        if (index === 2) {
          const snap = pending;
          pending = null;
          requestAnimationFrame(() => requestAnimationFrame(() => animateFrom(snap, ownToken)));
        }
      }, delay);
    });
  }, true);
})();

/* Keep the timeline step measured from the actual centres, including responsive layouts. */
(() => {
  function measure(){
    document.querySelectorAll('.timeline-track').forEach(track => {
      const buttons = [...track.querySelectorAll('button')];
      if (buttons.length < 3) return;
      const mid = Math.floor(buttons.length / 2);
      const a = buttons[mid - 1].getBoundingClientRect();
      const b = buttons[mid].getBoundingClientRect();
      const step = Math.abs((b.left + b.width/2) - (a.left + a.width/2));
      if (step > 1) track.style.setProperty('--timeline-step', `${step}px`);
    });
  }
  window.addEventListener('resize', measure, {passive:true});
  window.addEventListener('load', measure, {once:true});
  new MutationObserver(measure).observe(document.documentElement,{subtree:true,childList:true});
  requestAnimationFrame(measure);
})();


/* v16 — Gallery drag ghost prevention only. Map panels restored to v14 behavior. */
(() => {
  'use strict';

  function hardenGallery(root=document){
    root.querySelectorAll?.('.gallery-view img, .gallery-card img, .gallery-drawer img').forEach(img=>{
      img.draggable=false;
      img.setAttribute('draggable','false');
    });
  }

  document.addEventListener('dragstart', event => {
    if (event.target.closest?.('.gallery-view')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  function run(){ hardenGallery(); }
  new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',run);
  run();
})();

/* v18 — Smooth Map list edge fades using composited overlay opacity. */
(() => {
  'use strict';

  const mobileQuery = window.matchMedia('(max-width: 720px)');
  let mapView = null;
  let scroller = null;
  let topFade = null;
  let bottomFade = null;
  let resizeObserver = null;
  let raf = 0;

  function ensureFades(view) {
    if (!view) return;
    topFade = view.querySelector('.map-scroll-fade.is-top');
    bottomFade = view.querySelector('.map-scroll-fade.is-bottom');
    if (!topFade) {
      topFade = document.createElement('div');
      topFade.className = 'map-scroll-fade is-top';
      topFade.setAttribute('aria-hidden', 'true');
      view.appendChild(topFade);
    }
    if (!bottomFade) {
      bottomFade = document.createElement('div');
      bottomFade.className = 'map-scroll-fade is-bottom';
      bottomFade.setAttribute('aria-hidden', 'true');
      view.appendChild(bottomFade);
    }
  }

  function update() {
    raf = 0;
    if (!mapView || !scroller || !scroller.isConnected) return;
    const viewRect = mapView.getBoundingClientRect();
    const rect = scroller.getBoundingClientRect();
    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const overflow = maxScroll > 2;
    const left = Math.max(0, rect.left - viewRect.left);
    const top = Math.max(0, rect.top - viewRect.top);
    const width = Math.max(0, Math.min(rect.width, viewRect.right - rect.left));
    const height = Math.max(0, Math.min(rect.height, viewRect.bottom - rect.top));

    mapView.style.setProperty('--map-fade-left', `${left}px`);
    mapView.style.setProperty('--map-fade-top', `${top}px`);
    mapView.style.setProperty('--map-fade-width', `${width}px`);
    mapView.style.setProperty('--map-fade-height', `${height}px`);
    mapView.classList.toggle('show-map-top-fade', overflow && scroller.scrollTop > 3);
    mapView.classList.toggle('show-map-bottom-fade', overflow && scroller.scrollTop < maxScroll - 3);
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(update);
  }

  function bind() {
    const nextView = document.querySelector('.map-view');
    const nextScroller = nextView && (mobileQuery.matches
      ? nextView.querySelector('.map-lists')
      : nextView.querySelector('.zone-list'));

    if (nextView === mapView && nextScroller === scroller) {
      schedule();
      return;
    }

    if (scroller) scroller.removeEventListener('scroll', schedule);
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (mapView) mapView.classList.remove('show-map-top-fade', 'show-map-bottom-fade');

    mapView = nextView || null;
    scroller = nextScroller || null;
    topFade = bottomFade = null;
    if (!mapView || !scroller) return;

    ensureFades(mapView);
    scroller.addEventListener('scroll', schedule, { passive: true });
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(scroller);
      [...scroller.children].forEach(child => resizeObserver.observe(child));
    }
    schedule();
  }

  mobileQuery.addEventListener?.('change', bind);
  window.addEventListener('resize', bind, { passive: true });
  window.addEventListener('load', bind, { once: true });
  new MutationObserver(() => requestAnimationFrame(bind))
    .observe(document.documentElement, { childList: true, subtree: true });
  bind();
})();

/* 2026-07-13 — independent state-aware fades for both Map panels, desktop and mobile. */
(() => {
  'use strict';

  const boundViews = new WeakSet();

  function createFade(view, panelName, edge) {
    const node = document.createElement('div');
    node.className = `map-panel-fade is-${edge}`;
    node.dataset.panel = panelName;
    node.setAttribute('aria-hidden', 'true');
    view.appendChild(node);
    return node;
  }

  function bindPanel(view, panel, panelName) {
    if (!panel) return;
    const topFade = createFade(view, panelName, 'top');
    const bottomFade = createFade(view, panelName, 'bottom');
    let raf = 0;

    const update = () => {
      raf = 0;
      if (!view.isConnected || !panel.isConnected) return;
      const viewRect = view.getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
      const overflow = maxScroll > 2;
      const left = Math.max(0, rect.left - viewRect.left);
      const width = Math.max(0, Math.min(rect.right, viewRect.right) - Math.max(rect.left, viewRect.left));
      const top = Math.max(0, rect.top - viewRect.top);
      const topFadeHeight = topFade.getBoundingClientRect().height || 24;
      const bottomFadeHeight = bottomFade.getBoundingClientRect().height || 24;
      const panelBottom = Math.min(rect.bottom, viewRect.bottom) - viewRect.top;
      const bottom = Math.max(0, panelBottom - bottomFadeHeight);

      for (const fade of [topFade, bottomFade]) {
        fade.style.left = `${left}px`;
        fade.style.width = `${width}px`;
      }
      topFade.style.top = `${top}px`;
      topFade.style.height = `${topFadeHeight}px`;
      bottomFade.style.top = `${bottom}px`;
      bottomFade.style.height = `${bottomFadeHeight}px`;
      topFade.classList.toggle('is-visible', overflow && panel.scrollTop > 3);
      bottomFade.classList.toggle('is-visible', overflow && panel.scrollTop < maxScroll - 3);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    panel.addEventListener('scroll', schedule, { passive: true });
    panel.addEventListener('transitionend', schedule);
    window.addEventListener('resize', schedule, { passive: true });

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(schedule);
      ro.observe(panel);
      ro.observe(view);
    }
    new MutationObserver(() => {
      schedule();
      setTimeout(schedule, 80);
      setTimeout(schedule, 260);
    }).observe(panel, { childList: true, subtree: true, characterData: true });

    schedule();
    setTimeout(schedule, 80);
  }

  function bindView(view) {
    if (!view || boundViews.has(view)) return;
    boundViews.add(view);
    bindPanel(view, view.querySelector('.zone-list'), 'zones');
    bindPanel(view, view.querySelector('.map-notes-preview'), 'notes');
  }

  function discover(root = document) {
    if (root.nodeType === 1 && root.matches?.('.map-view')) bindView(root);
    root.querySelectorAll?.('.map-view').forEach(bindView);
  }

  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) discover(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => discover());
  } else {
    discover();
  }
})();


/* Object hover lock to prevent flicker on overlapping items (fine-pointer only). */
(() => {
  'use strict';
  const canHover = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  let locked = null;
  function unlock(){
    if (!locked) return;
    const view = locked.closest('.objects-view');
    locked.classList.remove('hover-lock');
    locked.style.removeProperty('--hover-z');
    if (view) view.classList.remove('hover-locked');
    locked = null;
  }
  function lock(el){
    if (!el || locked === el) return;
    unlock();
    locked = el;
    const view = el.closest('.objects-view');
    if (view) view.classList.add('hover-locked');
    const base = parseInt(getComputedStyle(el).zIndex || '1', 10) || 1;
    el.style.setProperty('--hover-z', String(base + 1000));
    el.classList.add('hover-lock');
  }
  document.addEventListener('pointerenter', event => {
    if (!canHover() || event.pointerType !== 'mouse') return;
    const el = event.target.closest?.('.objects-view .floating-object');
    if (!el) return;
    lock(el);
  }, true);
  document.addEventListener('pointerleave', event => {
    if (!canHover() || event.pointerType !== 'mouse') return;
    const el = event.target.closest?.('.objects-view .floating-object');
    if (!el || locked !== el) return;
    const to = event.relatedTarget;
    if (to && el.contains(to)) return;
    unlock();
  }, true);
  window.addEventListener('blur', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) unlock();
  });
})();

/* Preserve the exact hover geometry when an Object is collected. Collection
   changes colour only: size, angle and position remain visually unchanged. */
(() => {
  'use strict';
  let capturedOnPointerDown = null;

  function capture(el) {
    if (!el || el.classList.contains('is-collected')) return;
    const img = el.querySelector('img');
    if (!img) return;
    const objectStyle = getComputedStyle(el);
    const imageStyle = getComputedStyle(img);
    el.style.setProperty('--clicked-object-transform', objectStyle.transform);
    el.style.setProperty('--clicked-object-translate', objectStyle.translate);
    el.style.setProperty('--clicked-image-transform', imageStyle.transform);
  }

  document.addEventListener('pointerdown', event => {
    const el = event.target.closest?.('.objects-view .floating-object');
    if (!el || el.classList.contains('is-collected')) return;
    capture(el);
    capturedOnPointerDown = el;
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = event.target.closest?.('.objects-view .floating-object');
    if (!el || el.classList.contains('is-collected')) return;
    capture(el);
    capturedOnPointerDown = el;
  }, true);

  document.addEventListener('click', event => {
    const el = event.target.closest?.('.objects-view .floating-object');
    if (!el) return;
    if (!el.classList.contains('is-collected') && capturedOnPointerDown !== el) capture(el);
    requestAnimationFrame(() => { capturedOnPointerDown = null; });
  }, true);

  document.addEventListener('pointercancel', () => {
    capturedOnPointerDown = null;
  }, true);
})();
