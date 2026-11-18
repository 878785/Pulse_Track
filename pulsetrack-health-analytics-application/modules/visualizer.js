/**
 * visualizer.js
 * ---------------------------------------------------------------------------
 * Renders a browser mirror of the Python circular linked list.
 * Flask refreshes the mirrored nodes from the backend after each mutation.
 *
 *   head ─▶ (n0) ─▶ (n1) ─▶ … ─▶ (n-1) ─┐
 *     ▲                                 │
 *     └─────────────────────────────────┘
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const VIEW = { w: 960, h: 560 };
const CENTER = { x: VIEW.w / 2, y: VIEW.h / 2 };

function el(tag, attrs = {}, text = '') {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (text) node.textContent = text;
  return node;
}

function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatNumber(value) {
  return Number(value).toLocaleString();
}

function shortDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortDateCompact(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export class ListVisualizer {
  constructor({ tracker, onEvent } = {}) {
    this.tracker = tracker;
    this.onEvent = onEvent || (() => {});
    this.running = false;
    this.cursor = 0;
    this.timer = null;
    this.nodeCount = 0;
    this.activeIndex = -1;
    this.foundIndex = -1;
    this.positions = [];
  }

  setTracker(tracker) {
    this.tracker = tracker;
  }

  /* ------------------------------------------------------------- render */
  render() {
    const svg = document.getElementById('viz-svg');
    if (!svg) return;

    const nodes = this.tracker ? this.tracker.traverse() : [];
    this.nodeCount = nodes.length;

    const empty = document.getElementById('viz-empty');
    if (empty) empty.style.display = nodes.length ? 'none' : 'grid';

    svg.innerHTML = '';

    if (!nodes.length) {
      this.updateStats(null, null, null);
      return;
    }

    const count = nodes.length;
    const perRing = 14;
    const ringCount = Math.max(1, Math.ceil(count / perRing));
    const ringShapes = [
      { rx: 330, ry: 190 },
      { rx: 228, ry: 140 },
      { rx: 132, ry: 84 },
    ];

    // distribute the nodes over one or more concentric rings
    const positions = [];
    for (let ring = 0; ring < ringCount; ring += 1) {
      const start = ring * perRing;
      const end = Math.min(count, start + perRing);
      const inRing = end - start;
      const shape = ringShapes[Math.min(ring, ringShapes.length - 1)];
      if (inRing === 1) {
        positions.push({ x: CENTER.x, y: CENTER.y, angle: 0 });
        continue;
      }
      for (let i = 0; i < inRing; i += 1) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / inRing;
        positions.push({
          x: CENTER.x + shape.rx * Math.cos(angle),
          y: CENTER.y + shape.ry * Math.sin(angle),
          angle,
        });
      }
    }

    const perRingMax = Math.min(perRing, count);
    const nodeW = Math.max(76, Math.min(146, 150 - (perRingMax - 6) * 4.8));
    const nodeH = perRingMax > 11 ? 60 : perRingMax > 7 ? 68 : 78;
    const compact = nodeW < 104;

    /* -------- defs: arrow heads -------- */
    const defs = el('defs');
    const marker = el('marker', {
      id: 'viz-arrow', viewBox: '0 0 10 10', refX: '8', refY: '5',
      markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
    });
    marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'currentColor' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    /* -------- background rings -------- */
    ringShapes.slice(0, ringCount).forEach((shape) => {
      svg.appendChild(el('ellipse', {
        cx: CENTER.x, cy: CENTER.y, rx: shape.rx, ry: shape.ry,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1',
        'stroke-dasharray': '3 10',
        opacity: '0.28',
        class: 'viz-ring',
      }));
    });
    svg.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent');

    /* -------- links -------- */
    const linkGroup = el('g', { class: 'viz-links' });
    for (let i = 0; i < count; i += 1) {
      const from = positions[i];
      const to = positions[(i + 1) % count];
      const isBack = i === count - 1; // closing link (tail -> head)

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      const startX = from.x + ux * (nodeW / 2 + 4);
      const startY = from.y + uy * (nodeH / 2 + 4);
      const endX = to.x - ux * (nodeW / 2 + 13);
      const endY = to.y - uy * (nodeH / 2 + 13);

      let control;
      if (isBack) {
        // the closing link sweeps through the middle of the circle
        control = { x: CENTER.x, y: CENTER.y };
      } else if (Math.floor(i / perRing) !== Math.floor((i + 1) % count / perRing)) {
        // link between two different rings — bow gently towards the centre
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        control = {
          x: midX + (CENTER.x - midX) * 0.22,
          y: midY + (CENTER.y - midY) * 0.22,
        };
      } else {
        control = {
          x: (startX + endX) / 2 - ux * 20,
          y: (startY + endY) / 2 - uy * 20,
        };
      }

      const path = el('path', {
        d: `M ${startX} ${startY} Q ${control.x} ${control.y} ${endX} ${endY}`,
        class: `viz-link ${isBack ? 'viz-link-back' : ''}`,
        'marker-end': 'url(#viz-arrow)',
      });
      linkGroup.appendChild(path);
    }
    svg.appendChild(linkGroup);

    /* -------- nodes -------- */
    const nodeGroup = el('g', { class: 'viz-nodes' });
    nodes.forEach((node, index) => {
      const { x, y } = positions[index];
      const g = el('g', {
        class: `viz-node ${index === 0 ? 'is-head' : ''} ${index === count - 1 ? 'is-tail' : ''}`,
        transform: `translate(${x} ${y})`,
        'data-index': index,
        'data-date': node.date,
      });

      g.appendChild(el('rect', {
        x: -nodeW / 2, y: -nodeH / 2, width: nodeW, height: nodeH, rx: 12,
      }));

      // index badge
      g.appendChild(el('circle', { cx: -nodeW / 2 + 12, cy: -nodeH / 2 + 12, r: 9, fill: 'currentColor', opacity: '0.16' }));
      g.appendChild(el('text', {
        x: -nodeW / 2 + 12, y: -nodeH / 2 + 15.5, 'text-anchor': 'middle',
        class: 'n-next', 'font-size': '9',
      }, String(index)));

      const wide = nodeW >= 118;
      const medium = nodeW >= 100;
      g.appendChild(el('text', {
        x: -nodeW / 2 + 24, y: -nodeH / 2 + 16, class: 'n-date',
        'font-size': wide ? '12' : medium ? '10.5' : '9.5',
      }, escapeText(wide ? shortDate(node.date) : shortDateCompact(node.date))));

      if (wide || medium) {
        g.appendChild(el('text', {
          x: -nodeW / 2 + 12, y: -nodeH / 2 + 34, class: 'n-metric',
          'font-size': wide ? '10.5' : '9.5',
        }, `${formatNumber(node.steps)} steps`));
      }
      if (wide) {
        g.appendChild(el('text', {
          x: -nodeW / 2 + 12, y: -nodeH / 2 + 50, class: 'n-metric',
          'font-size': '10.5',
        }, `${formatNumber(node.calories)} kcal · ${node.sleep}h`));
      }

      // "next" pointer hint
      if (wide) {
        g.appendChild(el('text', {
          x: nodeW / 2 - 10, y: nodeH / 2 - 8, 'text-anchor': 'end',
          class: 'n-next', 'font-size': '8.5',
        }, 'next ▸'));
      }

      nodeGroup.appendChild(g);
    });
    svg.appendChild(nodeGroup);

    /* -------- centre badge -------- */
    const badge = el('g', { class: 'viz-badge' });
    badge.appendChild(el('rect', {
      x: CENTER.x - 96, y: CENTER.y - 34, width: 192, height: 68, rx: 16,
      fill: 'var(--card-3)', stroke: 'var(--border-strong)', 'stroke-width': '1',
    }));
    badge.appendChild(el('text', {
      x: CENTER.x, y: CENTER.y + 6, 'text-anchor': 'middle', class: 'viz-center-value',
    }, String(count)));
    badge.appendChild(el('text', {
      x: CENTER.x, y: CENTER.y + 24, 'text-anchor': 'middle', class: 'viz-center-label',
    }, 'nodes in the circle'));
    svg.appendChild(badge);

    /* -------- head / tail tags -------- */
    const head = positions[0];
    svg.appendChild(el('text', {
      x: head.x, y: head.y - nodeH / 2 - 12, 'text-anchor': 'middle', class: 'viz-tag viz-tag-head',
    }, '● HEAD'));
    if (count > 1) {
      const tail = positions[count - 1];
      svg.appendChild(el('text', {
        x: tail.x, y: tail.y + nodeH / 2 + 20, 'text-anchor': 'middle', class: 'viz-tag viz-tag-tail',
      }, 'TAIL ●'));
    }

    this.positions = positions;
    this.updateStats(nodes[0], count > 1 ? nodes[count - 1] : null, nodes[this.cursor] || null);
    this.applyHighlight();
  }

  /* ------------------------------------------------------------- stats */
  updateStats(head, tail, current) {
    const set = (id, value) => {
      const node = document.getElementById(id);
      if (node) node.textContent = value;
    };
    set('viz-head', head ? head.date : '—');
    set('viz-tail', tail ? tail.date : '—');
    set('viz-count', String(this.nodeCount));
    set('viz-current', current ? current.date : '—');
  }

  /* -------------------------------------------------------- highlights */
  applyHighlight() {
    const svg = document.getElementById('viz-svg');
    if (!svg) return;
    svg.querySelectorAll('.viz-node').forEach((g) => {
      g.classList.remove('is-active', 'is-found');
    });
    if (this.foundIndex >= 0) {
      const found = svg.querySelector(`.viz-node[data-index="${this.foundIndex}"]`);
      if (found) found.classList.add('is-found');
    }
    if (this.activeIndex >= 0) {
      const active = svg.querySelector(`.viz-node[data-index="${this.activeIndex}"]`);
      if (active) {
        active.classList.add('is-active');
        const node = this.tracker?.getNodeAt(this.activeIndex);
        this.updateStats(this.tracker?.head || null, this.tracker?.tail || null, node || null);
      }
    }
  }

  setActive(index) {
    this.activeIndex = index;
    this.applyHighlight();
  }

  clearActive() {
    this.activeIndex = -1;
    this.applyHighlight();
  }

  focusDate(date) {
    const index = this.tracker ? this.tracker.indexOf(date) : -1;
    this.foundIndex = index;
    this.activeIndex = -1;
    this.applyHighlight();
    return index;
  }

  /* --------------------------------------------------------- traversal */
  stepForward() {
    if (!this.nodeCount) return;
    this.cursor = (this.cursor + 1) % this.nodeCount;
    this.setActive(this.cursor);
    const node = this.tracker.getNodeAt(this.cursor);
    const status = document.getElementById('viz-status');
    if (status && node) {
      status.innerHTML = `<i data-lucide="circle-dot"></i><span>Visiting node ${this.cursor + 1} of ${this.nodeCount} — ${node.date} (${formatNumber(node.steps)} steps)</span>`;
      if (window.lucideRefresh) window.lucideRefresh();
    }
  }

  /** Animated traversal of the whole circle. */
  async traverse({ interval = 850 } = {}) {
    if (this.running) return;
    if (!this.nodeCount) {
      this.onEvent('warn', 'Traversal skipped — the list is empty.');
      return;
    }
    this.running = true;
    this.foundIndex = -1;
    this.cursor = -1;
    const status = document.getElementById('viz-status');

    for (let i = 0; i < this.nodeCount; i += 1) {
      if (!this.running) break;
      this.cursor = i;
      this.setActive(i);
      const node = this.tracker.getNodeAt(i);
      if (status && node) {
        status.innerHTML = `<i data-lucide="circle-dot"></i><span>Visiting node ${i + 1} of ${this.nodeCount} — ${node.date} · ${formatNumber(node.steps)} steps · ${node.calories} kcal · ${node.sleep}h sleep</span>`;
        if (window.lucideRefresh) window.lucideRefresh();
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { this.timer = setTimeout(resolve, interval); });
    }

    if (this.running && status) {
      status.innerHTML = `<i data-lucide="check"></i><span>Traversal complete — the tail's next pointer returned to the head. The circle is closed.</span>`;
      if (window.lucideRefresh) window.lucideRefresh();
    }
    this.running = false;
    this.activeIndex = -1;
    this.applyHighlight();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.activeIndex = -1;
    this.applyHighlight();
    const status = document.getElementById('viz-status');
    if (status) {
      status.innerHTML = `<i data-lucide="circle-dot"></i><span>Traversal stopped.</span>`;
      if (window.lucideRefresh) window.lucideRefresh();
    }
  }
}

export default ListVisualizer;
