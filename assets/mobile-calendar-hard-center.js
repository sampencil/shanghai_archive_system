(function () {
  'use strict';

  const MOBILE_QUERY = window.matchMedia('(max-width: 720px)');
  let raf = 0;
  let retries = [];

  function viewportCenterX() {
    const vv = window.visualViewport;
    if (vv && Number.isFinite(vv.width)) return vv.offsetLeft + vv.width / 2;
    return document.documentElement.clientWidth / 2;
  }

  function centerRail(rail) {
    if (!rail) return;
    const active = rail.querySelector('button.is-active');
    const host = rail.offsetParent || rail.parentElement;
    if (!active || !host) return;

    // offsetLeft is layout-based and therefore unaffected by any existing transform.
    const itemCenter = active.offsetLeft + active.offsetWidth / 2;
    const hostLeft = host.getBoundingClientRect().left;
    const x = viewportCenterX() - hostLeft - itemCenter;

    // Apply the final transform directly with !important. This deliberately bypasses
    // Safari differences in CSS custom-property resolution inside transformed rails.
    rail.style.setProperty('left', '0px', 'important');
    rail.style.setProperty('right', 'auto', 'important');
    rail.style.setProperty('margin-left', '0px', 'important');
    rail.style.setProperty('transform', `translate3d(${x}px,0,0)`, 'important');
  }

  function align() {
    raf = 0;
    if (!MOBILE_QUERY.matches) return;
    const popover = document.querySelector('.calendar-popover.is-open');
    if (!popover) return;
    centerRail(popover.querySelector('.calendar-months'));
    centerRail(popover.querySelector('.calendar-years'));
  }

  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      align();
      // Fonts and Safari toolbar geometry may settle over several frames.
      retries.forEach(clearTimeout);
      retries = [60, 180, 420].map(ms => setTimeout(align, ms));
    });
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  document.addEventListener('click', schedule, true);
  document.addEventListener('pointerup', schedule, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', schedule, { passive: true });
    window.visualViewport.addEventListener('scroll', schedule, { passive: true });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
