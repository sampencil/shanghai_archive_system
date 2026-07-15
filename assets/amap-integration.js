(() => {
  "use strict";

  const CONFIG = window.SHANGHAI_INDEX_AMAP || {};
  if (!CONFIG.key || !CONFIG.securityJsCode) return;

  const POINTS = {
    "邱加：如何让物站起来": [121.49315, 31.24192],
    "再构：时间的编织—大舍建筑展": [121.50742, 31.28282],
    "人机迷离——心 / 身 / 电 / 音 / 社": [121.49245, 31.18577],
    "削色": [121.50682, 31.19831],
    "黄含康：「鸟去空中真」": [121.47780, 31.19462],
    "克里斯蒂安娜·普利：打谷": [121.49071, 31.23908],
    "胡炜钊：可控的灵韵": [121.45745, 31.20572],
    "从孤岛出发：姆明线稿上海首展": [121.46955, 31.19138],
    "回响：她们的世纪": [121.46728, 31.18423],
    "面具之下—中意当代影像艺术展": [121.48042, 31.27056],
    "UNFOLD 2026 上海艺术设计节": [121.47531, 31.22016],
    "加载…权限 4": [121.44482, 31.19086]
  };

  // 全览相较旧版约放大 35%。高德 zoom 每增加 1 级约放大 2 倍，
  // 因此旧 11.65 + log2(1.35) ≈ 12.08。
  const OVERVIEW_ZOOM = 13.4;
  const REGION_ZOOM = 14.3;
  const OVERVIEW_CENTER = [121.48030, 31.22820];
  const REGION_MOVE_DURATION = 135;
  const OVERVIEW_MOVE_DURATION = 155;

  // 地图缩放采用对数级别，因此物件尺寸也使用指数曲线跟随。
  // REGION_ZOOM(14.3) 为 1 倍；OVERVIEW_ZOOM(12.8) 约为 0.76 倍，
  // 比单纯使用 zoom 比例更能拉开全览与区域视图的层次。
  const OBJECT_SCALE_EXPONENT = 0.52;
  const OBJECT_SCALE_MIN = 0.60;
  const OBJECT_SCALE_MAX = 1.22;
  const TOUCH_OBJECT_SCALE_EXPONENT = 0.40;
  const TOUCH_OBJECT_SCALE_MIN = 0.64;
  const TOUCH_OBJECT_SCALE_MAX = 1.04;

  // 区域名称与中心点由资产控制台维护；所有区域共用 REGION_ZOOM。
  const DEFAULT_REGIONS = [
    { name: "外滩", center: [121.49185, 31.24055] },
    { name: "苏州河", center: [121.49390, 31.27500] },
    { name: "世博园", center: [121.49370, 31.19420] },
    { name: "徐汇滨江", center: [121.46080, 31.19360] }
  ];
  const ZONES = Object.fromEntries((window.__SHANGHAI_REGIONS__ || DEFAULT_REGIONS).map(region => [
    region.name,
    { center: region.center.map(Number) }
  ]));

  let apiPromise;
  let current = null;

  function loadAMap() {
    if (window.AMap) return Promise.resolve(window.AMap);
    if (apiPromise) return apiPromise;

    window._AMapSecurityConfig = {
      securityJsCode: CONFIG.securityJsCode
    };

    apiPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(CONFIG.key)}`;
      script.async = true;
      script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error("AMap 未加载"));
      script.onerror = () => reject(new Error("高德地图网络资源加载失败"));
      document.head.appendChild(script);
    });
    return apiPromise;
  }

  function titleForPin(pin) {
    const image = pin.querySelector("img[alt]");
    return image ? image.alt.trim() : "";
  }

  function pinCoordinate(pin) {
    const lng = Number(pin.dataset.lng);
    const lat = Number(pin.dataset.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    return POINTS[titleForPin(pin)] || OVERVIEW_CENTER;
  }

  function updateObjectScale(state) {
    if (!state || !state.map || !state.stage.isConnected) return;
    const zoom = Number(state.map.getZoom?.() ?? REGION_ZOOM);
    const isTouch = window.matchMedia("(hover:none), (pointer:coarse)").matches;
    const exponent = isTouch ? TOUCH_OBJECT_SCALE_EXPONENT : OBJECT_SCALE_EXPONENT;
    const minScale = isTouch ? TOUCH_OBJECT_SCALE_MIN : OBJECT_SCALE_MIN;
    const maxScale = isTouch ? TOUCH_OBJECT_SCALE_MAX : OBJECT_SCALE_MAX;
    const rawScale = Math.pow(2, (zoom - REGION_ZOOM) * exponent);
    const scale = Math.max(minScale, Math.min(maxScale, rawScale));
    state.stage.style.setProperty("--map-object-scale", scale.toFixed(4));
  }

  function updatePins(state) {
    if (!state || !state.map || !state.stage.isConnected) return;
    updateObjectScale(state);
    const pins = [...state.world.querySelectorAll(".map-pin")];
    for (const pin of pins) {
      const coordinate = pinCoordinate(pin);
      const pixel = state.map.lngLatToContainer(coordinate);
      if (!pixel) continue;
      pin.style.setProperty("left", `${pixel.x}px`, "important");
      pin.style.setProperty("top", `${pixel.y}px`, "important");
      pin.dataset.lng = coordinate[0];
      pin.dataset.lat = coordinate[1];
    }
  }

  function focusMap(state, zoom, center) {
    if (!state?.map) return;

    // 使用极短的自定义镜头插值，避免高德默认动画偏慢、偏线性。
    // 起步迅速，末端只做极短减速；没有弹跳或过冲。
    if (state.focusFrame) cancelAnimationFrame(state.focusFrame);

    const startCenterRaw = state.map.getCenter?.();
    const startCenter = startCenterRaw
      ? [Number(startCenterRaw.lng), Number(startCenterRaw.lat)]
      : center;
    const startZoom = Number(state.map.getZoom?.() ?? zoom);
    const changesScale = Math.abs(startZoom - zoom) > 0.08;
    const duration = changesScale ? OVERVIEW_MOVE_DURATION : REGION_MOVE_DURATION;
    const startedAt = performance.now();

    const easeOutQuart = value => 1 - Math.pow(1 - value, 4);

    const tick = now => {
      if (!state.map || !state.stage.isConnected) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeOutQuart(progress);
      const nextCenter = [
        startCenter[0] + (center[0] - startCenter[0]) * eased,
        startCenter[1] + (center[1] - startCenter[1]) * eased
      ];
      const nextZoom = startZoom + (zoom - startZoom) * eased;

      // 每帧立即写入插值结果，整段运动由同一个 rAF 控制。
      state.map.setZoomAndCenter(nextZoom, nextCenter, true);

      if (progress < 1) {
        state.focusFrame = requestAnimationFrame(tick);
      } else {
        state.focusFrame = 0;
        state.map.setZoomAndCenter(zoom, center, true);
      }
    };

    state.focusFrame = requestAnimationFrame(tick);
  }

  function unlockMapBrowsing(state) {
    if (!state?.map) return;
    try { state.map.clearLimitBounds?.(); } catch (_) {}
    try { state.map.setStatus?.({ dragEnable: true, touchZoom: true, zoomEnable: true }); } catch (_) {}
  }

  function goToOverview(state) {
    unlockMapBrowsing(state);
    focusMap(state, OVERVIEW_ZOOM, OVERVIEW_CENTER);
  }

  function goToRegion(state, zone) {
    const target = ZONES[zone];
    if (!target) {
      goToOverview(state);
      return;
    }
    unlockMapBrowsing(state);
    focusMap(state, REGION_ZOOM, target.center);
  }

  function attachZoneNavigation(state) {
    const zoneList = state.view.querySelector(".zone-list");
    if (!zoneList || zoneList.dataset.amapBound === "true") return;
    zoneList.dataset.amapBound = "true";

    zoneList.addEventListener("click", (event) => {
      const button = event.target.closest(".zone-group > button");
      if (!button) return;
      const zone = button.textContent.trim();

      // React 先更新区域选中状态，再读取最终状态执行地图导航。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const active = button.closest(".zone-group")?.classList.contains("is-active");
          if (active) goToRegion(state, zone);
          else goToOverview(state);
        });
      });
    });
  }

  function isolateMapGestures(host) {
    // 手机端必须让完整的 pointer/touch 事件链自然交给高德地图。
    // 旧版在每个事件上 stopPropagation，会在手指跨过覆盖层或离开初始命中节点时
    // 中断连续拖拽，表现为地图滑到某处突然“卡住”。这里只负责中止区域聚焦动画，
    // 不再截断、阻止或重写任何地图手势。
    const cancelFocus = () => {
      if (current?.focusFrame) {
        cancelAnimationFrame(current.focusFrame);
        current.focusFrame = 0;
      }
      unlockMapBrowsing(current);
    };

    host.addEventListener("pointerdown", cancelFocus, { capture: true, passive: true });
    host.addEventListener("touchstart", cancelFocus, { capture: true, passive: true });
    host.addEventListener("wheel", cancelFocus, { capture: true, passive: true });
  }

  function mountMap(view) {
    if (!view || view.dataset.realMapMounted === "true") return;
    const stage = view.querySelector(".map-stage");
    const world = view.querySelector(".map-world");
    if (!stage || !world) return;

    view.dataset.realMapMounted = "true";
    const host = document.createElement("div");
    host.className = "amap-real-map";
    host.setAttribute("aria-label", "上海真实交互地图");
    stage.prepend(host);
    isolateMapGestures(host);

    loadAMap().then(AMap => {
      if (!view.isConnected) return;
      const map = new AMap.Map(host, {
        viewMode: "2D",
        center: OVERVIEW_CENTER,
        zoom: OVERVIEW_ZOOM,
        zooms: [10.5, 18],
        resizeEnable: true,
        dragEnable: true,
        zoomEnable: true,
        scrollWheel: true,
        touchZoom: true,
        touchZoomCenter: 1,
        doubleClickZoom: true,
        rotateEnable: false,
        pitchEnable: false,
        keyboardEnable: false,
        mapStyle: CONFIG.style || "amap://styles/darkblue",
        showLabel: false,
        features: ["bg", "road", "building"]
      });

      current = { view, stage, world, host, map };
      unlockMapBrowsing(current);

      // Pause decorative ripples while the map is being moved or zoomed. This keeps
      // touch interaction smooth without changing map behavior.
      let interactionReleaseTimer = 0;
      const beginMapInteraction = () => {
        clearTimeout(interactionReleaseTimer);
        view.classList.add("is-map-interacting");
      };
      const endMapInteraction = () => {
        clearTimeout(interactionReleaseTimer);
        interactionReleaseTimer = setTimeout(() => view.classList.remove("is-map-interacting"), 90);
      };
      ["movestart", "zoomstart", "dragstart", "touchstart"].forEach(name => map.on(name, beginMapInteraction));
      ["moveend", "zoomend", "dragend", "touchend"].forEach(name => map.on(name, endMapInteraction));
      map.on("dragstart", () => {
        if (current?.focusFrame) {
          cancelAnimationFrame(current.focusFrame);
          current.focusFrame = 0;
        }
        unlockMapBrowsing(current);
      });
      map.on("touchstart", () => unlockMapBrowsing(current));
      map.on("complete", () => {
        updatePins(current);
        view.classList.add("amap-ready");
      });
      map.on("mapmove", () => updatePins(current));
      map.on("zoomchange", () => updatePins(current));
      map.on("resize", () => updatePins(current));
      attachZoneNavigation(current);

      const mutation = new MutationObserver(() => {
        if (!view.isConnected) {
          mutation.disconnect();
          try { map.destroy(); } catch (_) {}
          if (current?.view === view) current = null;
          return;
        }
        attachZoneNavigation(current);
        requestAnimationFrame(() => updatePins(current));
      });
      mutation.observe(view, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["class"]
      });

      requestAnimationFrame(() => {
        map.resize();
        updatePins(current);
      });
    }).catch(error => {
      console.warn("真实地图加载失败：", error);
      view.classList.add("amap-load-error");
      host.innerHTML = '<div class="amap-load-message">地图暂时无法加载，请检查网络或高德 Key 配置</div>';
    });
  }

  const observer = new MutationObserver(() => {
    const mapView = document.querySelector(".map-view");
    if (mapView) mountMap(mapView);
  });
  observer.observe(document.documentElement, { subtree: true, childList: true });

  const initial = document.querySelector(".map-view");
  if (initial) mountMap(initial);
})();
