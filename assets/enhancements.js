(() => {
  'use strict';
  const signatureKey = () => [...document.querySelectorAll('.floating-object')].map(x=>x.querySelector('img')?.getAttribute('src') || x.dataset.id || '').join('|');
  let lastSignature='';
  function noise(i,s=0){const x=Math.sin((i+1)*91.733+s*17.17)*43758.5453;return x-Math.floor(x)}
  function layout(){
    const view=document.querySelector('.objects-view'); if(!view)return;
    const els=[...view.querySelectorAll('.floating-object')]; if(!els.length)return;
    const sig=signatureKey(); if(sig===lastSignature&&els.every(x=>x.dataset.spatialReady))return; lastSignature=sig;
    const seed=[...sig].reduce((a,c)=>((a*31+c.charCodeAt(0))>>>0),2166136261);
    const heroIndex=seed%els.length;
    const anchors=[
      [50,53],[18,24],[82,23],[9,60],[91,60],[26,76],[75,78],
      [31,34],[68,34],[42,74],[60,72],[15,84],[86,84],[48,20],[56,88]
    ];
    const occupied=[];
    els.forEach((el,i)=>{
      const hero=i===heroIndex;
      let a=anchors[(i+(seed%7))%anchors.length];
      let x=a[0]+(noise(i,seed%37)-.5)*(hero?3:9);
      let y=a[1]+(noise(i,seed%53)-.5)*(hero?3:8);
      if(!hero){
        for(let attempt=0;attempt<35;attempt++){
          const min=occupied.length?Math.min(...occupied.map(o=>Math.hypot((x-o.x)*1.12,y-o.y))):99;
          if(min>13)break;
          x=10+noise(i,attempt+17+seed%11)*80;
          y=18+noise(i,attempt+31+seed%13)*70;
        }
      }
      const width=hero?(22+noise(i,71)*6):(8.5+noise(i,42)*8.5);
      occupied.push({x,y,w:width});
      el.style.left=x+'%'; el.style.top=y+'%'; el.style.width=width+'%';
      el.style.zIndex=hero?'5':String(1+Math.floor(noise(i,99)*3));
      el.style.setProperty('--rotation',(hero?(-4+noise(i,44)*8):(-18+noise(i,44)*36))+'deg');
      el.style.setProperty('--object-scale',(hero?(1.04+noise(i,45)*.12):(.82+noise(i,45)*.34)).toFixed(3));
      el.style.setProperty('--breath',(6+noise(i,46)*5)+'s');
      el.dataset.hero=hero?'true':'false';
      el.dataset.spatialReady='1';
    });
  }
  function drag(el){if(el.dataset.dragReady)return;el.dataset.dragReady='1';let s=null,raf=0;
    el.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;cancelAnimationFrame(raf);const p=el.closest('.objects-view'),r=p?.getBoundingClientRect(),er=el.getBoundingClientRect();if(!r)return;s={id:e.pointerId,r,p,sx:e.clientX,sy:e.clientY,bx:er.left-r.left+er.width/2,by:er.top-r.top+er.height/2,m:false,lx:e.clientX,ly:e.clientY,t:performance.now(),vx:0,vy:0};el.setPointerCapture?.(e.pointerId);el.classList.add('is-dragging')},true);
    el.addEventListener('pointermove',e=>{if(!s||s.id!==e.pointerId)return;const dx=e.clientX-s.sx,dy=e.clientY-s.sy;if(Math.hypot(dx,dy)>6)s.m=true;const n=performance.now(),dt=Math.max(8,n-s.t);s.vx=(e.clientX-s.lx)/dt*16;s.vy=(e.clientY-s.ly)/dt*16;s.lx=e.clientX;s.ly=e.clientY;s.t=n;const x=Math.max(s.r.width*.04,Math.min(s.r.width*.96,s.bx+dx)),y=Math.max(s.r.height*.09,Math.min(s.r.height*.92,s.by+dy));el.style.left=x/s.r.width*100+'%';el.style.top=y/s.r.height*100+'%';if(s.m)e.preventDefault()},true);
    const finish=e=>{if(!s||s.id!==e.pointerId)return;const z=s;s=null;el.classList.remove('is-dragging');if(z.m){el.dataset.suppressClickUntil=performance.now()+400;let vx=z.vx*.78,vy=z.vy*.78;const tick=()=>{vx*=.945;vy*=.945;const x=Math.max(z.r.width*.04,Math.min(z.r.width*.96,parseFloat(el.style.left)/100*z.r.width+vx)),y=Math.max(z.r.height*.09,Math.min(z.r.height*.92,parseFloat(el.style.top)/100*z.r.height+vy));el.style.left=x/z.r.width*100+'%';el.style.top=y/z.r.height*100+'%';if(Math.hypot(vx,vy)>.18)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick)}};
    el.addEventListener('pointerup',finish,true);el.addEventListener('pointercancel',finish,true);el.addEventListener('click',e=>{if(performance.now()<+(el.dataset.suppressClickUntil||0)){e.preventDefault();e.stopImmediatePropagation()}},true)
  }
  function run(){layout();document.querySelectorAll('.floating-object').forEach(drag)}
  new MutationObserver(()=>requestAnimationFrame(run)).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',run);
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
