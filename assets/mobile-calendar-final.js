(function () {
  'use strict';

  const mobileQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  let frame = 0;
  let observedPopover = null;
  let popoverObserver = null;

  function isMobile() {
    return mobileQuery.matches;
  }

  function viewportCenterX() {
    const viewport = window.visualViewport;
    if (viewport && Number.isFinite(viewport.width)) {
      return viewport.offsetLeft + viewport.width / 2;
    }
    return (window.innerWidth || document.documentElement.clientWidth) / 2;
  }

  function isOpen(popover) {
    return Boolean(
      popover &&
      popover.classList.contains('is-open') &&
      popover.getAttribute('aria-hidden') !== 'true'
    );
  }

  function clearForcedState(popover) {
    if (!popover) return;
    popover.removeAttribute('data-mobile-force-hidden');
    ['display', 'visibility', 'opacity', 'pointer-events'].forEach(function (property) {
      popover.style.removeProperty(property);
    });

    popover.querySelectorAll('.calendar-months, .calendar-years').forEach(function (rail) {
      ['display', 'visibility', 'opacity', 'pointer-events'].forEach(function (property) {
        rail.style.removeProperty(property);
      });
    });
  }

  function resetClosedState(popover) {
    if (!popover) return;
    popover.removeAttribute('data-mobile-force-hidden');
    popover.querySelectorAll('.calendar-months, .calendar-years').forEach(function (rail) {
      rail.style.removeProperty('transform');
      rail.style.removeProperty('-webkit-transform');
      rail.style.removeProperty('left');
      rail.style.removeProperty('right');
      rail.style.removeProperty('margin-left');
    });
  }

  function centerRail(rail) {
    if (!rail) return;
    const active = rail.querySelector('button.is-active');
    const host = rail.offsetParent || rail.parentElement;
    if (!active || !host) return;

    const activeCenter = active.offsetLeft + active.offsetWidth / 2;
    const hostLeft = host.getBoundingClientRect().left;
    const x = viewportCenterX() - hostLeft - activeCenter;

    rail.style.setProperty('left', '0px', 'important');
    rail.style.setProperty('right', 'auto', 'important');
    rail.style.setProperty('margin-left', '0px', 'important');
    rail.style.setProperty('transform', 'translate3d(' + x + 'px,0,0)', 'important');
  }

  function alignOpenPopover() {
    frame = 0;
    if (!isMobile()) return;

    const popover = document.querySelector('.calendar-popover');
    if (!isOpen(popover)) {
      resetClosedState(popover);
      return;
    }

    clearForcedState(popover);
    centerRail(popover.querySelector('.calendar-months'));
    centerRail(popover.querySelector('.calendar-years'));
  }

  function scheduleAlignment() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(function () {
      // One second frame is enough for React to commit the open state and layout.
      frame = requestAnimationFrame(alignOpenPopover);
    });
  }

  function attachPopoverObserver() {
    const popover = document.querySelector('.calendar-popover');
    if (!popover || popover === observedPopover) return;

    if (popoverObserver) popoverObserver.disconnect();
    observedPopover = popover;
    popoverObserver = new MutationObserver(function (mutations) {
      const stateChanged = mutations.some(function (mutation) {
        return mutation.type === 'attributes' &&
          (mutation.attributeName === 'class' || mutation.attributeName === 'aria-hidden');
      });
      if (!stateChanged) return;

      if (isOpen(popover)) scheduleAlignment();
      else resetClosedState(popover);
    });
    popoverObserver.observe(popover, {
      attributes: true,
      attributeFilter: ['class', 'aria-hidden']
    });
  }

  function initialize() {
    attachPopoverObserver();
    scheduleAlignment();
  }

  // Do not intercept pointerdown/touchstart. The React click handlers must receive
  // an uninterrupted tap so month and year buttons remain reliably selectable.
  window.addEventListener('resize', scheduleAlignment, { passive: true });
  window.addEventListener('orientationchange', scheduleAlignment, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleAlignment, { passive: true });
  }

  const mountObserver = new MutationObserver(attachPopoverObserver);
  mountObserver.observe(document.body, { childList: true, subtree: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleAlignment);
  }

  initialize();
})();
