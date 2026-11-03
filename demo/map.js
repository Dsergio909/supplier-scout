/**
 * Supplier Scout — a small map: OpenStreetMap tiles with the suppliers on top.
 *
 * No library: Web Mercator maths, <img> tiles and an SVG layer for the search
 * radius and the numbered markers. Drag to move, + and − to zoom.
 *
 * OSM tile usage policy: attribution on the map, a Referer on every tile
 * request (the page itself sends no Referer for its links, so each tile asks
 * for one), no bulk downloading. Only the tiles in view are requested.
 */
(function (root) {
  'use strict';

  var TILE = 256;
  var TILE_URL = 'https://tile.openstreetmap.org/';
  var MIN_ZOOM = 3;
  var MAX_ZOOM = 18;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function worldSize(z) { return TILE * Math.pow(2, z); }

  /** lat/lng -> world pixels at zoom z. */
  function project(lat, lng, z) {
    var size = worldSize(z);
    var s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180);
    return {
      x: (lng + 180) / 360 * size,
      y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size
    };
  }

  /** world pixels at zoom z -> lat/lng. */
  function unproject(x, y, z) {
    var size = worldSize(z);
    var lng = x / size * 360 - 180;
    var n = Math.PI - 2 * Math.PI * y / size;
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: lng };
  }

  /** Metres per pixel at a latitude and zoom. */
  function metresPerPixel(lat, z) {
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
  }

  /** The largest zoom at which a circle of radiusKm fits in a box of w × h pixels. */
  function fitZoom(lat, radiusKm, w, h) {
    var room = Math.max(40, Math.min(w, h) / 2 - 18);
    for (var z = MAX_ZOOM - 1; z >= MIN_ZOOM; z--) {
      if (radiusKm * 1000 / metresPerPixel(lat, z) <= room) return z;
    }
    return MIN_ZOOM;
  }

  function node(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
  function svgNode(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /**
   * create(container, { attribution, zoomIn, zoomOut, onSelect(id) })
   * Returns { show(view), redraw() }, view = { center, radiusKm, points: [{ id, lat, lng, title, rank, color, faded }], label }.
   */
  function create(container, options) {
    var opts = options || {};
    container.classList.add('map');
    var stage = node('div', 'map-stage');
    var tiles = node('div', 'map-tiles');
    var overlay = svgNode('svg', { class: 'map-overlay', role: 'img' });
    var desc = svgNode('desc', {});
    overlay.appendChild(desc);
    stage.appendChild(tiles);
    stage.appendChild(overlay);
    container.appendChild(stage);

    var controls = node('div', 'map-zoom');
    var zin = node('button', 'map-btn');
    zin.type = 'button'; zin.textContent = '+';
    var zout = node('button', 'map-btn');
    zout.type = 'button'; zout.textContent = '−';
    controls.appendChild(zin);
    controls.appendChild(zout);
    container.appendChild(controls);

    var credit = node('div', 'map-credit');
    var a = node('a');
    a.href = 'https://www.openstreetmap.org/copyright';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '© OpenStreetMap';
    credit.appendChild(a);
    container.appendChild(credit);

    var view = null;
    var z = 12;
    var centre = null; // world pixels at zoom z

    function size() {
      return { w: Math.max(200, container.clientWidth), h: Math.max(200, container.clientHeight) };
    }

    function draw() {
      if (!view) return;
      var s = size();
      var left = centre.x - s.w / 2;
      var top = centre.y - s.h / 2;
      var n = Math.pow(2, z);
      stage.style.transform = '';

      // Tiles in view only.
      while (tiles.firstChild) tiles.removeChild(tiles.firstChild);
      var x0 = Math.floor(left / TILE);
      var x1 = Math.floor((left + s.w) / TILE);
      var y0 = Math.max(0, Math.floor(top / TILE));
      var y1 = Math.min(n - 1, Math.floor((top + s.h) / TILE));
      for (var ty = y0; ty <= y1; ty++) {
        for (var tx = x0; tx <= x1; tx++) {
          var img = node('img', 'map-tile');
          img.alt = '';
          img.draggable = false;
          img.decoding = 'async';
          img.referrerPolicy = 'strict-origin-when-cross-origin';
          img.style.left = Math.round(tx * TILE - left) + 'px';
          img.style.top = Math.round(ty * TILE - top) + 'px';
          img.src = TILE_URL + z + '/' + (((tx % n) + n) % n) + '/' + ty + '.png';
          tiles.appendChild(img);
        }
      }

      // Radius, origin and markers.
      overlay.setAttribute('width', s.w);
      overlay.setAttribute('height', s.h);
      overlay.setAttribute('viewBox', '0 0 ' + s.w + ' ' + s.h);
      while (overlay.lastChild !== desc) overlay.removeChild(overlay.lastChild);
      function at(lat, lng) {
        var p = project(lat, lng, z);
        return { x: p.x - left, y: p.y - top };
      }
      var o = at(view.center.lat, view.center.lng);
      if (view.radiusKm) {
        overlay.appendChild(svgNode('circle', {
          cx: o.x, cy: o.y, r: view.radiusKm * 1000 / metresPerPixel(view.center.lat, z), class: 'map-radius'
        }));
      }
      // Lower ranks first so the best ones are drawn on top.
      view.points.slice().sort(function (p, q) { return (q.rank || 999) - (p.rank || 999); }).forEach(function (pt) {
        var c = at(pt.lat, pt.lng);
        if (c.x < -20 || c.y < -20 || c.x > s.w + 20 || c.y > s.h + 20) return;
        var g = svgNode('g', { class: 'map-marker' + (pt.faded ? ' faded' : '') + (pt.rank && pt.rank <= 3 ? ' top' : ''), tabindex: pt.faded ? -1 : 0 });
        var title = svgNode('title', {});
        title.textContent = pt.title;
        g.appendChild(title);
        if (pt.rank && pt.rank <= 99) {
          var big = svgNode('circle', { cx: c.x, cy: c.y, r: 11 });
          // CSSOM, not a style attribute: the page's CSP forbids inline style attributes.
          big.style.setProperty('--c', pt.color);
          g.appendChild(big);
          var tx = svgNode('text', { x: c.x, y: c.y + 4, 'text-anchor': 'middle' });
          tx.textContent = String(pt.rank);
          g.appendChild(tx);
        } else {
          var small = svgNode('circle', { cx: c.x, cy: c.y, r: 5 });
          small.style.setProperty('--c', pt.color);
          g.appendChild(small);
        }
        if (opts.onSelect && !pt.faded) {
          g.addEventListener('click', function () { opts.onSelect(pt.id); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onSelect(pt.id); } });
        }
        overlay.appendChild(g);
      });
      overlay.appendChild(svgNode('circle', { cx: o.x, cy: o.y, r: 8, class: 'map-origin' }));
      overlay.appendChild(svgNode('circle', { cx: o.x, cy: o.y, r: 3, class: 'map-origin-dot' }));
      zin.disabled = z >= MAX_ZOOM;
      zout.disabled = z <= MIN_ZOOM;
    }

    function setZoom(next) {
      next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      if (next === z || !view) return;
      var ll = unproject(centre.x, centre.y, z);
      z = next;
      centre = project(ll.lat, ll.lng, z);
      draw();
    }
    zin.addEventListener('click', function () { setZoom(z + 1); });
    zout.addEventListener('click', function () { setZoom(z - 1); });

    // Drag: move the stage with CSS while dragging, redraw the tiles on release.
    var drag = null;
    stage.addEventListener('pointerdown', function (e) {
      if (!view || e.button !== 0) return;
      if (e.target.closest && e.target.closest('.map-marker')) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
      stage.setPointerCapture(e.pointerId);
      container.classList.add('dragging');
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      drag.dx = e.clientX - drag.x;
      drag.dy = e.clientY - drag.y;
      stage.style.transform = 'translate(' + drag.dx + 'px,' + drag.dy + 'px)';
    });
    function endDrag() {
      if (!drag) return;
      centre = { x: centre.x - drag.dx, y: centre.y - drag.dy };
      drag = null;
      container.classList.remove('dragging');
      draw();
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    var resizeTimer = null;
    root.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 150);
    });

    return {
      /** Show a new set of points; refits the view when the centre or radius changed. */
      show: function (next) {
        var refit = !view || next.center.lat !== view.center.lat || next.center.lng !== view.center.lng || next.radiusKm !== view.radiusKm;
        view = next;
        desc.textContent = next.label || '';
        zin.setAttribute('aria-label', opts.zoomIn || 'Zoom in');
        zout.setAttribute('aria-label', opts.zoomOut || 'Zoom out');
        if (refit) {
          var s = size();
          z = fitZoom(next.center.lat, next.radiusKm || 5, s.w, s.h);
          centre = project(next.center.lat, next.center.lng, z);
        }
        draw();
      },
      redraw: draw,
      setLabels: function (labels) {
        opts.zoomIn = labels.zoomIn;
        opts.zoomOut = labels.zoomOut;
        zin.setAttribute('aria-label', labels.zoomIn);
        zout.setAttribute('aria-label', labels.zoomOut);
      }
    };
  }

  root.ScoutMap = { create: create, project: project, unproject: unproject, fitZoom: fitZoom, metresPerPixel: metresPerPixel };
})(typeof globalThis !== 'undefined' ? globalThis : this);
