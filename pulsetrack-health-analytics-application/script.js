/**
 * PulseTrack — Health Metrics & Data Structure Intelligence System
 * script.js : application controller (routing, rendering, interactions)
 */

import {
  createIcons,
  LayoutDashboard, CalendarDays, ClipboardList, ChartColumnBig, ChartSpline, GitBranch,
  DatabaseBackup, Settings, X, HardDrive, MoreHorizontal, Menu, CalendarCheck, Sun, Moon,
  Bell, Plus, Sparkle, Footprints, Flame, MoonStar, Database, ArrowRight, ArrowLeft,
  FileSpreadsheet, FileJson, ListTree, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Search, RotateCcw, Pencil, Trash2, Check, Download, Upload, FolderOpen, Zap, RefreshCw,
  Monitor, CircleDot, Play, MoveRight, Activity, TrendingUp, TrendingDown, User, ShieldCheck,
  Binary, SunMoon, Eye, Clock, Info, CircleCheck, Target, Award, Gauge, Bed,
} from 'lucide';

import { HealthTracker } from './modules/linkedList.js';
import { Storage } from './modules/storage.js';
import { palette, lineChart, barChart, doughnutChart, hexToRgba } from './modules/charts.js';
import { ActivityCalendar, formatCompact, isoDate } from './modules/calendar.js';
import { ListVisualizer } from './modules/visualizer.js';
import { exportCSV, exportJSON, downloadBackup, parseBackupPayload } from './modules/export.js';

/* ==========================================================================
   Icons
   ========================================================================== */
const ICONS = {
  LayoutDashboard, CalendarDays, ClipboardList, ChartColumnBig, ChartSpline, GitBranch,
  DatabaseBackup, Settings, X, HardDrive, MoreHorizontal, Menu, CalendarCheck, Sun, Moon,
  Bell, Plus, Sparkle, Footprints, Flame, MoonStar, Database, ArrowRight, ArrowLeft,
  FileSpreadsheet, FileJson, ListTree, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Search, RotateCcw, Pencil, Trash2, Check, Download, Upload, FolderOpen, Zap, RefreshCw,
  Monitor, CircleDot, Play, MoveRight, Activity, TrendingUp, TrendingDown, User, ShieldCheck,
  Binary, SunMoon, Eye, Clock, Info, CircleCheck, Target, Award, Gauge, Bed,
};

function refreshIcons(root) {
  const scope = root || document;
  try {
    createIcons({ icons: ICONS, root: scope });
    // rendered SVGs keep their look but lose the marker so they are not rebuilt again
    scope.querySelectorAll('svg[data-lucide]').forEach((svg) => svg.removeAttribute('data-lucide'));
  } catch (error) {
    console.warn('[PulseTrack] icon refresh failed', error);
  }
}
window.lucideRefresh = () => refreshIcons();

/* ==========================================================================
   Helpers
   ========================================================================== */
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));
const nf = new Intl.NumberFormat();
let serverStorage = { bytes: 0, kb: 0, count: 0 };
let serverSearchResults = null;
let searchRequestNumber = 0;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

const fmt = (value) => nf.format(Math.round(value || 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function parseDate(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function shortLabel(value) {
  return parseDate(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function longLabel(value) {
  return parseDate(value).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ==========================================================================
   Application state
   ========================================================================== */
const tracker = new HealthTracker();
let records = [];
const activityLog = [];
const notifications = [];

const state = {
  page: 'overview',
  themePreference: 'dark',
  accent: '#34d399',
  overviewRange: '14',
  analyticsRange: '30',
  analyticsCustom: { from: '', to: '' },
  records: { search: '', sort: 'date-desc', from: '', to: '', page: 1, perPage: 12 },
  selectedDate: null,
};

const calendar = new ActivityCalendar({
  onSelect: (date) => {
    state.selectedDate = date;
    renderCalendarDetail();
  },
});

const visualizer = new ListVisualizer({
  tracker,
  onEvent: (type, message) => logOperation(type, message),
});

/* ==========================================================================
   Toasts & notifications
   ========================================================================== */
function toast(type, title, message) {
  const stack = qs('#toast-stack');
  if (!stack) return;
  const iconName = type === 'error' ? 'x' : type === 'info' ? 'info' : 'check';
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ''}</div>
    <button type="button" aria-label="Dismiss"><i data-lucide="x"></i></button>`;
  node.querySelector('button').addEventListener('click', () => removeToast(node));
  stack.appendChild(node);
  refreshIcons(node);
  setTimeout(() => removeToast(node), 4600);
}

function removeToast(node) {
  if (!node || node.classList.contains('is-out')) return;
  node.classList.add('is-out');
  setTimeout(() => node.remove(), 320);
}

function pushNotification(type, title, message) {
  notifications.unshift({ type, title, message, time: new Date() });
  if (notifications.length > 12) notifications.length = 12;
  renderNotifications();
}

function renderNotifications() {
  const list = qs('#notif-list');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = '<li class="notif-empty">No notifications yet</li>';
    return;
  }
  const icons = { success: 'circle-check', error: 'x', info: 'info' };
  list.innerHTML = notifications.map((n) => `
    <li class="notif-item">
      <i data-lucide="${icons[n.type] || 'info'}"></i>
      <div>
        <p><strong>${escapeHtml(n.title)}</strong></p>
        <p>${escapeHtml(n.message)}</p>
        <time>${n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
    </li>`).join('');
  refreshIcons(list);
}

/* ==========================================================================
   Modals
   ========================================================================== */
function openModal(id) {
  const modal = qs(`#${id}`);
  if (!modal) return;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  const focusable = modal.querySelector('input, select, textarea, button');
  setTimeout(() => focusable?.focus(), 60);
}

function closeModal(id) {
  const modal = qs(`#${id}`);
  if (!modal) return;
  modal.hidden = true;
  if (!qsa('.modal-backdrop:not([hidden])').length) document.body.style.overflow = '';
}

let pendingConfirm = null;

function confirmAction({ title, text, confirmLabel = 'Confirm', danger = true, onConfirm }) {
  pendingConfirm = onConfirm;
  qs('#confirm-title').textContent = title;
  qs('#confirm-text').textContent = text;
  const accept = qs('#confirm-accept');
  accept.innerHTML = `<i data-lucide="${danger ? 'trash-2' : 'check'}"></i> ${escapeHtml(confirmLabel)}`;
  accept.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  refreshIcons(accept);
  openModal('confirm-modal');
}

/* ==========================================================================
   Theme & settings
   ========================================================================== */
function effectiveTheme() {
  if (state.themePreference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return state.themePreference;
}

function applyTheme() {
  const theme = effectiveTheme();
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = qs('#theme-toggle');
  if (toggle) {
    toggle.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    refreshIcons(toggle);
  }
  qsa('.theme-card').forEach((card) => card.classList.toggle('is-active', card.dataset.themeChoice === state.themePreference));
  Storage.saveTheme(state.themePreference);
}

function applyAccent(color) {
  state.accent = color;
  const root = document.documentElement.style;
  root.setProperty('--accent', color);
  root.setProperty('--accent-strong', shade(color, -18));
  root.setProperty('--accent-soft', hexToRgba(color, 0.14));
  root.setProperty('--accent-glow', hexToRgba(color, 0.35));
  qsa('.accent-dot').forEach((dot) => dot.classList.toggle('is-active', dot.dataset.accent === color));
  saveSettings();
}

function shade(hex, percent) {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = clamp(Math.round(((num >> 16) & 255) * (1 + percent / 100)), 0, 255);
  const g = clamp(Math.round(((num >> 8) & 255) * (1 + percent / 100)), 0, 255);
  const b = clamp(Math.round((num & 255) * (1 + percent / 100)), 0, 255);
  return `#${((r << 16) + (g << 8) + b).toString(16).padStart(6, '0')}`;
}

function saveSettings() {
  Storage.saveSettings({
    theme: state.themePreference,
    accent: state.accent,
    recordsView: state.records,
  });
}

/* ==========================================================================
   Data flow
   ========================================================================== */
async function loadFromServer() {
  const { records: stored } = await apiRequest('/api/records');
  tracker.clear();
  stored.forEach((record) => {
    tracker.addRecord(record);
  });
  records = tracker.getAllRecords();
  serverStorage = await apiRequest('/api/settings/storage');
  const searchTerm = state.records.search.trim();
  const requestNumber = searchRequestNumber;
  if (!searchTerm) {
    serverSearchResults = null;
  } else {
    const result = await apiRequest(`/api/records?search=${encodeURIComponent(searchTerm)}`);
    serverSearchResults = requestNumber === searchRequestNumber && searchTerm === state.records.search.trim()
      ? result.records
      : null;
  }
}

async function searchOnServer(date) {
  const { record } = await apiRequest(`/api/records/${encodeURIComponent(date)}`);
  return record;
}

function persist() {
  updateStorageWidget();
  saveSettings();
}

function refresh({ charts = true } = {}) {
  records = tracker.getAllRecords().slice().sort((a, b) => a.date.localeCompare(b.date));
  persist();
  updateSharedWidgets();
  if (charts) {
    renderOverview();
    renderAnalytics();
  }
  renderRecords();
  renderCalendar();
  renderVisualizer();
  renderExport();
  renderSettings();
}

function updateSharedWidgets() {
  const count = records.length;
  const profile = qs('#profile-records');
  if (profile) profile.textContent = `${count} record${count === 1 ? '' : 's'} stored`;
  const notifDot = qs('#notif-btn');
  if (notifDot) notifDot.classList.toggle('has-dot', notifications.length > 0);
}

function updateStorageWidget() {
  const bytes = serverStorage.bytes || 0;
  const kb = serverStorage.kb || 0;
  const percent = Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 1000) / 10);
  const pct = qs('#side-storage-pct');
  const bar = qs('#side-storage-bar');
  const text = qs('#side-storage-text');
  if (pct) pct.textContent = `${percent}%`;
  if (bar) bar.style.width = `${Math.max(2, percent)}%`;
  if (text) text.textContent = `${kb} KB · SQLite database`;
}

function logOperation(type, message) {
  activityLog.unshift({ type, message, time: new Date() });
  if (activityLog.length > 24) activityLog.length = 24;
  renderTimeline();
  const counter = qs('#viz-op-count');
  if (counter) counter.textContent = `${tracker.operations} ops`;
  const list = qs('#viz-console-list');
  if (list) {
    if (activityLog.length === 1 && list.querySelector('.console-empty')) list.innerHTML = '';
    const li = document.createElement('li');
    li.textContent = message;
    list.prepend(li);
    while (list.children.length > 30) list.lastElementChild.remove();
  }
}

/* ==========================================================================
   Overview page
   ========================================================================== */
function sparkline(values, color, id) {
  if (!values.length) return '<svg viewBox="0 0 200 34" preserveAspectRatio="none"></svg>';
  const w = 200;
  const h = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? w / 2 : (index / (values.length - 1)) * w;
    const y = h - 4 - ((value - min) / range) * (h - 10);
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${w} ${h} L 0 ${h} Z`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="sg-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#sg-${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function periodDelta() {
  const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 4) return null;
  const half = Math.floor(sorted.length / 2);
  const previous = sorted.slice(0, half);
  const current = sorted.slice(half);
  const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
  const pct = (now, before) => (before === 0 ? (now > 0 ? 100 : 0) : ((now - before) / before) * 100);
  return {
    steps: pct(sum(current, 'steps'), sum(previous, 'steps')),
    calories: pct(sum(current, 'calories'), sum(previous, 'calories')),
    sleep: pct(sum(current, 'sleep'), sum(previous, 'sleep')),
    count: pct(current.length, previous.length),
  };
}

function applyDelta(element, value) {
  if (!element) return;
  if (value === null || value === undefined || !Number.isFinite(value)) {
    element.textContent = '—';
    element.className = 'kpi-delta';
    return;
  }
  const rounded = Math.round(value);
  const up = rounded >= 0;
  element.textContent = `${up ? '▲' : '▼'} ${Math.abs(rounded)}%`;
  element.className = `kpi-delta ${up ? 'up' : 'down'}`;
}

function renderOverview() {
  const stats = tracker.getStats();
  const delta = periodDelta();
  const p = palette();

  const setText = (id, value) => { const el = qs(`#${id}`); if (el) el.textContent = value; };
  setText('kpi-steps-value', fmt(stats.totalSteps));
  setText('kpi-calories-value', fmt(stats.totalCalories));
  setText('kpi-sleep-value', `${stats.avgSleep.toFixed(1)}h`);
  setText('kpi-records-value', fmt(stats.count));
  setText('kpi-records-foot', stats.count ? `${stats.count} node${stats.count === 1 ? '' : 's'} linked in the circle` : 'Nodes in the circular list');
  setText('kpi-steps-foot', stats.count ? `avg ${fmt(stats.avgSteps)} per day` : 'Total across all records');
  setText('kpi-calories-foot', stats.count ? `avg ${fmt(stats.avgCalories)} kcal per day` : 'Total energy expenditure');
  setText('kpi-sleep-foot', stats.count ? `best ${stats.maxSleep}h · lowest ${stats.minSleep}h` : 'Hours per recorded night');

  applyDelta(qs('#kpi-steps-delta'), delta?.steps);
  applyDelta(qs('#kpi-calories-delta'), delta?.calories);
  applyDelta(qs('#kpi-sleep-delta'), delta?.sleep);
  applyDelta(qs('#kpi-records-delta'), delta?.count);

  const recent = records.slice(-14);
  setSpark('kpi-steps-spark', recent.map((r) => r.steps), p.accent, 'steps');
  setSpark('kpi-calories-spark', recent.map((r) => r.calories), p.orange, 'calories');
  setSpark('kpi-sleep-spark', recent.map((r) => r.sleep), p.violet, 'sleep');
  setSpark('kpi-records-spark', records.map((_, i) => i + 1), p.sky, 'records');

  // hero
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  setText('hero-greeting', greeting);
  setText('hero-ring-value', String(stats.count));
  setText('hero-sub', stats.count
    ? `You have logged ${stats.count} day${stats.count === 1 ? '' : 's'} — ${fmt(stats.totalSteps)} steps and ${fmt(stats.totalCalories)} kcal so far.`
    : 'No records yet — add your first day and the circular list comes alive.');

  const bars = qs('#hero-bars');
  const streak = computeStreak();
  const streakEl = qs('#hero-streak');
  if (streakEl) {
    streakEl.innerHTML = `<i data-lucide="zap"></i><strong>${streak}</strong> day streak`;
    refreshIcons(streakEl);
  }
  if (bars) {
    const values = records.slice(-14).map((r) => r.steps);
    const max = Math.max(...values, 1);
    bars.innerHTML = values.map((value, i) => {
      const height = Math.max(8, (value / max) * 92);
      return `<i style="height:${height}px;animation-delay:${i * 40}ms"></i>`;
    }).join('');
  }

  renderOverviewCharts();
  renderRecentRecords();
  renderTimeline();
}

function setSpark(id, values, color, key) {
  const host = qs(`#${id}`);
  if (host) host.innerHTML = sparkline(values, color, key);
}

/** Consecutive days of records ending at the most recent stored day. */
function computeStreak() {
  if (!records.length) return 0;
  const dates = new Set(records.map((r) => r.date));
  const cursor = new Date(`${records[records.length - 1].date}T00:00:00`);
  let streak = 0;
  while (dates.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function rangeRecords(range) {
  if (range === 'all' || !records.length) return records;
  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  const iso = isoDate(cutoff);
  return records.filter((r) => r.date >= iso);
}

function renderOverviewCharts() {
  const p = palette();
  const scoped = rangeRecords(state.overviewRange);
  const labels = scoped.map((r) => shortLabel(r.date));

  lineChart('chart-overview-steps', {
    labels,
    data: scoped.map((r) => r.steps),
    label: 'Steps',
    color: p.accent,
  });

  barChart('chart-overview-calories', {
    labels,
    data: scoped.map((r) => r.calories),
    label: 'Calories',
    color: p.orange,
  });

  lineChart('chart-overview-sleep', {
    labels,
    data: scoped.map((r) => r.sleep),
    label: 'Sleep (h)',
    color: p.violet,
    fill: true,
  });

  const week = records.slice(-7);
  barChart('chart-overview-week', {
    labels: week.map((r) => shortLabel(r.date)),
    data: week.map((r) => r.steps),
    label: 'Steps',
    color: p.sky,
  });

  const stats = tracker.getStats();
  const goals = {
    steps: stats.avgSteps / 8000,
    calories: stats.avgCalories / 2000,
    sleep: stats.avgSleep / 7,
  };
  const values = [goals.steps, goals.calories, goals.sleep].map((v) => Math.round(v * 100));
  doughnutChart('chart-overview-ring', {
    labels: ['Steps', 'Calories', 'Sleep'],
    data: values,
    colors: [p.accent, p.orange, p.violet],
  });

  const legend = qs('#overview-legend');
  if (legend) {
    const items = [
      { label: 'Steps goal (8k)', value: values[0], color: p.accent },
      { label: 'Calorie goal (2k)', value: values[1], color: p.orange },
      { label: 'Sleep goal (7h)', value: values[2], color: p.violet },
    ];
    legend.innerHTML = items.map((item) => `
      <li><i style="--c:${item.color}"></i>${item.label}<strong>${item.value}%</strong></li>`).join('');
  }
}

function renderRecentRecords() {
  const host = qs('#overview-recent-list');
  if (!host) return;
  const recent = records.slice(-5).reverse();
  if (!recent.length) {
    host.innerHTML = '<div class="mini-empty">No records yet — add your first day to populate the list.</div>';
    return;
  }
  host.innerHTML = recent.map((r) => `
    <div class="mini-row">
      <span class="mini-date"><span class="date-badge">${parseDate(r.date).getDate()}</span>${escapeHtml(shortLabel(r.date))}</span>
      <strong>${fmt(r.steps)}</strong>
      <strong>${fmt(r.calories)}</strong>
      <strong>${r.sleep}h</strong>
    </div>`).join('');
}

function renderTimeline() {
  const host = qs('#overview-timeline');
  if (!host) return;
  const icons = { success: 'circle-check', error: 'x', info: 'info' };
  if (!activityLog.length) {
    host.innerHTML = '<li class="mini-empty" style="padding:18px 0">Operations on the linked list will appear here.</li>';
    return;
  }
  host.innerHTML = activityLog.slice(0, 6).map((entry) => `
    <li>
      <span class="tl-icon"><i data-lucide="${icons[entry.type] || 'info'}"></i></span>
      <div>
        <p>${escapeHtml(entry.message)}</p>
        <time>${entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
    </li>`).join('');
  refreshIcons(host);
}

/* ==========================================================================
   Records page
   ========================================================================== */
function filteredRecords() {
  const { search, sort, from, to } = state.records;
  const query = search.trim().toLowerCase();
  let list = (query && serverSearchResults ? serverSearchResults : records).slice();

  if (query && !serverSearchResults) {
    list = list.filter((r) => r.date.includes(query) || longLabel(r.date).toLowerCase().includes(query));
  }
  if (from) list = list.filter((r) => r.date >= from);
  if (to) list = list.filter((r) => r.date <= to);

  const [field, direction] = sort.split('-');
  const factor = direction === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (field === 'date') return a.date.localeCompare(b.date) * factor;
    return (a[field] - b[field]) * factor;
  });
  return list;
}

function renderRecords() {
  const body = qs('#records-body');
  const empty = qs('#records-empty');
  const wrap = qs('#records-table-wrap');
  const pager = qs('#records-pager');
  const label = qs('#records-count-label');
  if (!body) return;

  const list = filteredRecords();
  const totalPages = Math.max(1, Math.ceil(list.length / state.records.perPage));
  if (state.records.page > totalPages) state.records.page = totalPages;
  const start = (state.records.page - 1) * state.records.perPage;
  const pageItems = list.slice(start, start + state.records.perPage);

  if (label) {
    label.textContent = list.length === records.length
      ? `${records.length} record${records.length === 1 ? '' : 's'} stored`
      : `${list.length} of ${records.length} records match your filters`;
  }

  const hasRows = pageItems.length > 0;
  if (wrap) wrap.hidden = !hasRows;
  if (empty) empty.hidden = hasRows;

  if (!hasRows) {
    const text = qs('#records-empty-text');
    if (text) {
      text.textContent = records.length
        ? 'No records match the current search or date filters.'
        : 'Add your first health record to start building the circular linked list.';
    }
  }

  body.innerHTML = pageItems.map((r) => `
    <tr>
      <td>${r.id ?? '—'}</td>
      <td>
        <span class="date-cell">
          <span class="date-badge">${parseDate(r.date).getDate()}</span>
          <span>${escapeHtml(longLabel(r.date))}<small>${escapeHtml(r.date)}</small></span>
        </span>
      </td>
      <td class="num">${fmt(r.steps)}</td>
      <td class="num">${fmt(r.calories)} kcal</td>
      <td class="num">${r.sleep} h</td>
      <td class="right">
        <span class="row-actions">
          <button type="button" data-edit="${r.date}" title="Edit record"><i data-lucide="pencil"></i></button>
          <button type="button" class="danger" data-delete="${r.date}" title="Delete record"><i data-lucide="trash-2"></i></button>
        </span>
      </td>
    </tr>`).join('');
  refreshIcons(body);

  body.querySelectorAll('[data-edit]').forEach((button) => {
    button.addEventListener('click', () => openRecordModal('edit', button.dataset.edit));
  });
  body.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', () => askDelete(button.dataset.delete));
  });

  if (pager) renderPager(pager, state.records.page, totalPages, (page) => {
    state.records.page = page;
    renderRecords();
  });
}

function renderPager(host, current, total, onChange) {
  const buttons = [];
  buttons.push(`<button type="button" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>‹</button>`);
  const pages = [];
  for (let i = 1; i <= total; i += 1) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  pages.forEach((page) => {
    buttons.push(page === '…'
      ? '<span class="gap">…</span>'
      : `<button type="button" data-page="${page}" class="${page === current ? 'is-active' : ''}">${page}</button>`);
  });
  buttons.push(`<button type="button" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>›</button>`);
  host.innerHTML = buttons.join('');
  host.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const page = Number(button.dataset.page);
      if (page >= 1 && page <= total && page !== current) onChange(page);
    });
  });
}

function askDelete(date) {
  const record = tracker.searchRecord(date);
  if (!record) return;
  confirmAction({
    title: 'Delete this record?',
    text: `The node for ${longLabel(date)} will be unlinked from the circle and removed from storage.`,
    confirmLabel: 'Delete record',
    onConfirm: async () => {
      try {
        await apiRequest(`/api/records/${encodeURIComponent(date)}`, { method: 'DELETE' });
        await loadFromServer();
        logOperation('success', `Deleted node ${date} — the circle was re-linked.`);
        toast('success', 'Record deleted', `${longLabel(date)} was removed from the list.`);
        pushNotification('success', 'Record deleted', `${date} removed from the circular linked list.`);
        refresh();
      } catch (error) {
        toast('error', 'Could not delete record', error.message);
      }
    },
  });
}

/* ==========================================================================
   Record form
   ========================================================================== */
function clearFormErrors() {
  qsa('#record-form .field').forEach((field) => field.classList.remove('has-error'));
  qsa('#record-form .error-text').forEach((node) => { node.textContent = ''; });
}

function setFormError(id, message) {
  const error = qs(`#${id}-error`);
  const input = qs(`#${id}`);
  if (error) error.textContent = message;
  if (input?.closest('.field')) input.closest('.field').classList.add('has-error');
}

function openRecordModal(mode = 'add', date = null) {
  clearFormErrors();
  const form = qs('#record-form');
  if (!form) return;
  form.reset();
  qs('#rec-id').value = date || '';

  const title = qs('#record-modal-title');
  const sub = qs('#record-modal-sub');
  const saveBtn = qs('#rec-save');

  if (mode === 'edit' && date) {
    const node = tracker.searchRecord(date);
    if (!node) {
      toast('error', 'Record not found', 'The record may have already been removed.');
      return;
    }
    title.textContent = 'Edit health record';
    sub.textContent = `Updating the node stored for ${longLabel(date)}`;
    saveBtn.innerHTML = '<i data-lucide="check"></i> Update record';
    qs('#rec-date').value = node.date;
    qs('#rec-steps').value = node.steps;
    qs('#rec-calories').value = node.calories;
    qs('#rec-sleep').value = node.sleep;
  } else {
    title.textContent = 'Add health record';
    sub.textContent = 'Store a new day in the circular linked list';
    saveBtn.innerHTML = '<i data-lucide="check"></i> Save record';
    const today = isoDate(new Date());
    qs('#rec-date').value = today;
    if (!tracker.searchRecord(today)) {
      qs('#rec-steps').value = '';
      qs('#rec-calories').value = '';
      qs('#rec-sleep').value = '';
    }
  }
  refreshIcons(saveBtn);
  openModal('record-modal');
}

async function submitRecord(event) {
  event.preventDefault();
  clearFormErrors();

  const date = qs('#rec-date').value;
  const stepsRaw = qs('#rec-steps').value;
  const caloriesRaw = qs('#rec-calories').value;
  const sleepRaw = qs('#rec-sleep').value;
  const existing = qs('#rec-id').value;

  let valid = true;
  if (!date) {
    setFormError('rec-date', 'Please choose a date.');
    valid = false;
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setFormError('rec-date', 'Use the YYYY-MM-DD format.');
    valid = false;
  }

  const steps = Number(stepsRaw);
  if (stepsRaw === '' || !Number.isFinite(steps) || steps < 0 || steps > 200000) {
    setFormError('rec-steps', 'Steps must be between 0 and 200,000.');
    valid = false;
  }
  const calories = Number(caloriesRaw);
  if (caloriesRaw === '' || !Number.isFinite(calories) || calories < 0 || calories > 20000) {
    setFormError('rec-calories', 'Calories must be between 0 and 20,000 kcal.');
    valid = false;
  }
  const sleep = Number(sleepRaw);
  if (sleepRaw === '' || !Number.isFinite(sleep) || sleep < 0 || sleep > 24) {
    setFormError('rec-sleep', 'Sleep must be between 0 and 24 hours.');
    valid = false;
  }

  if (!valid) {
    toast('error', 'Check the form', 'Some fields need attention before saving.');
    return;
  }

  const payload = { date, steps: Math.round(steps), calories: Math.round(calories), sleep: Math.round(sleep * 10) / 10 };

  try {
    if (existing) {
      if (date !== existing && tracker.searchRecord(date)) {
        setFormError('rec-date', 'Another record already exists for this date.');
        toast('error', 'Duplicate date', 'Only one record per day can be stored.');
        return;
      }
      await apiRequest(`/api/records/${encodeURIComponent(existing)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      await loadFromServer();
      logOperation('success', `Updated node ${existing} → ${date}.`);
      toast('success', 'Record updated', `${longLabel(date)} was updated in place.`);
      pushNotification('success', 'Record updated', `${date} now holds ${payload.steps} steps.`);
    } else {
      await apiRequest('/api/records', { method: 'POST', body: JSON.stringify(payload) });
      await loadFromServer();
      logOperation('success', `Inserted node ${date} at the tail — circle re-linked.`);
      toast('success', 'Record added', `${longLabel(date)} was appended to the list.`);
      pushNotification('success', 'Record added', `${date} — ${payload.steps} steps logged.`);
    }
    closeModal('record-modal');
    refresh();
  } catch (error) {
    setFormError('rec-date', error.message);
    toast('error', 'Could not save', error.message);
  }
}

/* ==========================================================================
   Calendar page
   ========================================================================== */
function renderCalendar() {
  if (!state.selectedDate) state.selectedDate = isoDate(new Date());
  calendar.selectedDate = state.selectedDate;
  calendar.setRecords(records);
  renderCalendarDetail();
}

function renderCalendarDetail() {
  const host = qs('#cal-detail');
  if (!host) return;
  const date = state.selectedDate || isoDate(new Date());
  const record = tracker.searchRecord(date);

  if (!record) {
    host.innerHTML = `
      <div class="detail-card">
        <div class="detail-date"><strong>${escapeHtml(longLabel(date))}</strong><span class="pill">No record</span></div>
        <p style="font-size:12.8px;color:var(--muted)">Nothing stored for this day. Add a record to create a new node in the circle.</p>
        <div class="detail-actions">
          <button class="btn btn-primary" data-action="add-for-date" data-date="${date}"><i data-lucide="plus"></i> Add record</button>
        </div>
      </div>`;
  } else {
    const maxSteps = Math.max(...records.map((r) => r.steps), 1);
    const bars = records.slice(-14).map((r) => {
      const height = Math.max(4, (r.steps / maxSteps) * 60);
      return `<i style="height:${height}px" title="${r.date}: ${fmt(r.steps)} steps"></i>`;
    }).join('');
    host.innerHTML = `
      <div class="detail-card">
        <div class="detail-date">
          <strong>${escapeHtml(longLabel(date))}</strong>
          <span class="pill pill-ok"><i data-lucide="circle-check"></i> Stored</span>
        </div>
        <div class="detail-metrics">
          <div class="detail-metric">
            <i><i data-lucide="footprints"></i></i>
            <div><span>Steps</span><strong>${fmt(record.steps)}</strong></div>
          </div>
          <div class="detail-metric">
            <i><i data-lucide="flame"></i></i>
            <div><span>Calories</span><strong>${fmt(record.calories)} kcal</strong></div>
          </div>
          <div class="detail-metric">
            <i><i data-lucide="moon-star"></i></i>
            <div><span>Sleep</span><strong>${record.sleep} hours</strong></div>
          </div>
        </div>
        <div class="mini-bars">${bars}</div>
        <div class="detail-actions">
          <button class="btn btn-soft" data-action="edit-date" data-date="${date}"><i data-lucide="pencil"></i> Edit</button>
          <button class="btn btn-danger" data-action="delete-date" data-date="${date}"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </div>`;
  }
  refreshIcons(host);
}

/* ==========================================================================
   Analytics page
   ========================================================================== */
function analyticsWindow() {
  if (state.analyticsRange === 'custom' && state.analyticsCustom.from && state.analyticsCustom.to) {
    return { from: state.analyticsCustom.from, to: state.analyticsCustom.to };
  }
  if (state.analyticsRange === 'all' || !records.length) {
    return { from: records[0]?.date || '', to: records[records.length - 1]?.date || '' };
  }
  const days = Number(state.analyticsRange);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return { from: isoDate(start), to: isoDate(end) };
}

function renderAnalytics() {
  const p = palette();
  const { from, to } = analyticsWindow();
  const scoped = records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));

  const statsHost = qs('#analytics-stats');
  if (statsHost) {
    if (!scoped.length) {
      statsHost.innerHTML = `
        <div class="stat-cell"><span>Records in window</span><strong>0</strong><small>No data</small></div>
        <div class="stat-cell"><span>Average steps</span><strong>0</strong><small>—</small></div>
        <div class="stat-cell"><span>Average calories</span><strong>0</strong><small>—</small></div>
        <div class="stat-cell"><span>Average sleep</span><strong>0h</strong><small>—</small></div>`;
    } else {
      const steps = scoped.map((r) => r.steps);
      const calories = scoped.map((r) => r.calories);
      const sleep = scoped.map((r) => r.sleep);
      const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      statsHost.innerHTML = `
        <div class="stat-cell"><span>Records in window</span><strong>${scoped.length}</strong><small>${from ? escapeHtml(shortLabel(from)) : '—'} → ${to ? escapeHtml(shortLabel(to)) : '—'}</small></div>
        <div class="stat-cell"><span>Average steps</span><strong>${fmt(avg(steps))}</strong><small>max ${fmt(Math.max(...steps))}</small></div>
        <div class="stat-cell"><span>Average calories</span><strong>${fmt(avg(calories))}</strong><small>max ${fmt(Math.max(...calories))}</small></div>
        <div class="stat-cell"><span>Average sleep</span><strong>${avg(sleep).toFixed(1)}h</strong><small>max ${Math.max(...sleep)}h · min ${Math.min(...sleep)}h</small></div>
        <div class="stat-cell"><span>Total steps</span><strong>${fmt(steps.reduce((a, b) => a + b, 0))}</strong><small>${fmt(steps.reduce((a, b) => a + b, 0) / scoped.length)} / day</small></div>`;
    }
  }

  const labels = scoped.map((r) => shortLabel(r.date));
  lineChart('chart-analytics-steps', { labels, data: scoped.map((r) => r.steps), label: 'Steps', color: p.accent });
  barChart('chart-analytics-calories', { labels, data: scoped.map((r) => r.calories), label: 'Calories', color: p.orange });
  barChart('chart-analytics-sleep', { labels, data: scoped.map((r) => r.sleep), label: 'Sleep (h)', color: p.violet });

  // weekday averages
  const weekdayTotals = Array.from({ length: 7 }, () => ({ steps: 0, calories: 0, sleep: 0, count: 0 }));
  scoped.forEach((r) => {
    const index = (parseDate(r.date).getDay() + 6) % 7;
    weekdayTotals[index].steps += r.steps;
    weekdayTotals[index].calories += r.calories;
    weekdayTotals[index].sleep += r.sleep;
    weekdayTotals[index].count += 1;
  });
  barChart('chart-analytics-weekday', {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: weekdayTotals.map((d) => (d.count ? Math.round(d.steps / d.count) : 0)),
    label: 'Avg steps',
    color: p.sky,
  });

  // monthly totals
  const monthly = new Map();
  scoped.forEach((r) => {
    const key = r.date.slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + r.steps);
  });
  const monthlyEntries = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  lineChart('chart-analytics-monthly', {
    labels: monthlyEntries.map(([key]) => {
      const [y, m] = key.split('-');
      return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    }),
    data: monthlyEntries.map(([, value]) => value),
    label: 'Steps',
    color: p.violet,
  });

  renderComparison(scoped, from, to);
}

function renderComparison(current, from, to) {
  const host = qs('#analytics-comparison');
  if (!host) return;

  let previous = [];
  if (from && to && current.length) {
    const start = parseDate(from);
    const end = parseDate(to);
    const span = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - span + 1);
    const prevFrom = isoDate(prevStart);
    const prevTo = isoDate(prevEnd);
    previous = records.filter((r) => r.date >= prevFrom && r.date <= prevTo);
  }

  const metrics = [
    { key: 'steps', label: 'Average steps', format: (v) => fmt(v) },
    { key: 'calories', label: 'Average calories', format: (v) => `${fmt(v)} kcal` },
    { key: 'sleep', label: 'Average sleep', format: (v) => `${v.toFixed(1)} h` },
  ];

  const avg = (list, key) => (list.length ? list.reduce((total, item) => total + item[key], 0) / list.length : 0);

  host.innerHTML = metrics.map((metric) => {
    const now = avg(current, metric.key);
    const before = avg(previous, metric.key);
    const change = before ? ((now - before) / before) * 100 : (now ? 100 : 0);
    const up = change >= 0;
    const icon = up ? 'trending-up' : 'trending-down';
    const color = up ? 'var(--accent)' : '#f87171';
    return `<tr>
      <td>${metric.label}</td>
      <td class="num">${metric.format(now)}</td>
      <td class="num">${previous.length ? metric.format(before) : '—'}</td>
      <td class="num" style="color:${color}">${up ? '+' : ''}${Math.round(change)}%</td>
      <td><span style="display:inline-flex;align-items:center;gap:6px;color:${color}"><i data-lucide="${icon}" style="width:15px;height:15px"></i>${up ? 'Improving' : 'Declining'}</span></td>
    </tr>`;
  }).join('');
  refreshIcons(host);
}

/* ==========================================================================
   Visualizer page
   ========================================================================== */
function renderVisualizer() {
  visualizer.render();
  const body = qs('#viz-table-body');
  if (!body) return;
  const nodes = tracker.traverse();
  if (!nodes.length) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">The list is empty — insert a node to see it here.</td></tr>';
    return;
  }
  body.innerHTML = nodes.map((node, index) => {
    const nextLabel = node.next === tracker.head ? 'head (circular)' : node.next ? node.next.date : '—';
    return `<tr>
      <td class="num">${index}</td>
      <td>${escapeHtml(longLabel(node.date))}</td>
      <td class="num">${fmt(node.steps)}</td>
      <td class="num">${fmt(node.calories)}</td>
      <td class="num">${node.sleep} h</td>
      <td style="font-family:var(--font-mono);font-size:12px;color:var(--accent)">→ ${escapeHtml(nextLabel)}</td>
      <td class="right"><span class="row-actions">
        <button type="button" data-viz-focus="${node.date}" title="Locate in the diagram"><i data-lucide="eye"></i></button>
        <button type="button" data-viz-edit="${node.date}" title="Edit"><i data-lucide="pencil"></i></button>
        <button type="button" class="danger" data-viz-delete="${node.date}" title="Delete"><i data-lucide="trash-2"></i></button>
      </span></td>
    </tr>`;
  }).join('');
  refreshIcons(body);

  body.querySelectorAll('[data-viz-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = visualizer.focusDate(button.dataset.vizFocus);
      const status = qs('#viz-status');
      if (status) {
        status.innerHTML = `<i data-lucide="search"></i><span>${index >= 0 ? `Found ${button.dataset.vizFocus} at position ${index} in the circle.` : 'Date not found in the list.'}</span>`;
        refreshIcons(status);
      }
    });
  });
  body.querySelectorAll('[data-viz-edit]').forEach((button) => {
    button.addEventListener('click', () => openRecordModal('edit', button.dataset.vizEdit));
  });
  body.querySelectorAll('[data-viz-delete]').forEach((button) => {
    button.addEventListener('click', () => askDelete(button.dataset.vizDelete));
  });

  const counter = qs('#viz-op-count');
  if (counter) counter.textContent = `${tracker.operations} ops`;
}

/* ==========================================================================
   Export page
   ========================================================================== */
function renderExport() {
  const host = qs('#export-stats');
  if (host) {
    const stats = tracker.getStats();
    host.innerHTML = `
      <div class="stat-cell"><span>Records ready</span><strong>${stats.count}</strong><small>nodes in the circle</small></div>
      <div class="stat-cell"><span>Total steps</span><strong>${fmt(stats.totalSteps)}</strong><small>all time</small></div>
      <div class="stat-cell"><span>Total calories</span><strong>${fmt(stats.totalCalories)}</strong><small>kcal</small></div>
      <div class="stat-cell"><span>Average sleep</span><strong>${stats.avgSleep.toFixed(1)}h</strong><small>per night</small></div>`;
  }

  const preview = qs('#export-preview');
  if (preview) {
    const payload = {
      app: 'PulseTrack',
      type: 'health-records-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      dataStructure: 'Circular Singly Linked List',
      count: records.length,
      records: records.slice(0, 5),
    };
    preview.textContent = JSON.stringify(payload, null, 2);
  }
}

async function handleImport(text) {
  const resultHost = qs('#import-result');
  const parsed = parseBackupPayload(text);

  if (!parsed.ok) {
    resultHost.hidden = false;
    resultHost.className = 'import-result bad';
    resultHost.innerHTML = `<strong>Import failed</strong><p>${escapeHtml(parsed.error)}</p>`;
    toast('error', 'Import failed', parsed.error);
    return;
  }

  let result;
  try {
    result = await apiRequest('/api/records/import', {
      method: 'POST',
      body: JSON.stringify({ records: parsed.records }),
    });
    await loadFromServer();
  } catch (error) {
    resultHost.hidden = false;
    resultHost.className = 'import-result bad';
    resultHost.innerHTML = `<strong>Import failed</strong><p>${escapeHtml(error.message)}</p>`;
    toast('error', 'Import failed', error.message);
    return;
  }

  const added = result.added.length;
  const skipped = parsed.duplicates.length + result.duplicates.length;
  const invalid = [...parsed.invalid, ...result.invalid];
  resultHost.hidden = false;
  resultHost.className = `import-result ${added ? 'ok' : 'bad'}`;
  resultHost.innerHTML = `
    <strong>${added ? 'Restore complete' : 'Nothing new to restore'}</strong>
    <ul>
      <li>✔ ${added} record${added === 1 ? '' : 's'} added to the linked list</li>
      <li>↻ ${skipped} duplicate date${skipped === 1 ? '' : 's'} skipped</li>
      <li>✖ ${invalid.length} invalid entr${invalid.length === 1 ? 'y' : 'ies'} rejected</li>
    </ul>
    ${invalid.length ? `<ul>${invalid.slice(0, 5).map((item) => `<li>Row ${item.index + 1} (${escapeHtml(item.date)}): ${escapeHtml(item.errors?.join(' ') || item.error)}</li>`).join('')}</ul>` : ''}`;

  if (added) {
    logOperation('success', `Imported ${added} record${added === 1 ? '' : 's'} from backup.`);
    toast('success', 'Import complete', `${added} record${added === 1 ? '' : 's'} restored, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped.`);
    pushNotification('success', 'Backup restored', `${added} new record${added === 1 ? '' : 's'} added to the list.`);
    refresh();
  } else {
    toast('info', 'No new records', 'Every record in the backup already exists in the list.');
  }
}

/* ==========================================================================
   Settings page
   ========================================================================== */
function renderSettings() {
  const host = qs('#settings-stats');
  if (host) {
    const stats = tracker.getStats();
    host.innerHTML = `
      <div class="stat-cell"><span>Records stored</span><strong>${stats.count}</strong><small>circular list nodes</small></div>
      <div class="stat-cell"><span>SQLite database</span><strong>${serverStorage.kb} KB</strong><small>persistent local database</small></div>
      <div class="stat-cell"><span>Last saved</span><strong>${serverStorage.lastSaved ? new Date(`${serverStorage.lastSaved.replace(' ', 'T')}Z`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong><small>saved automatically</small></div>
      <div class="stat-cell"><span>Structure</span><strong style="font-size:16px">Circular List</strong><small>O(n) add · O(n) search</small></div>`;
  }

  const saved = qs('#setting-last-saved');
  if (saved) {
    saved.textContent = serverStorage.lastSaved || 'Not saved yet';
  }
}

/* ==========================================================================
   Sample data
   ========================================================================== */
async function seedSampleData(days = 30) {
  const existing = new Set(records.map((r) => r.date));
  const samples = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const iso = isoDate(date);
    if (existing.has(iso)) continue;
    const wave = Math.sin((days - i) / 3.1) * 1400;
    const weekend = [0, 6].includes(date.getDay()) ? 1400 : 0;
    const steps = Math.max(1200, Math.round(7600 + wave + weekend + (i * 173) % 1500));
    const calories = Math.round(1500 + steps / 22 + ((i * 37) % 320));
    const sleep = Math.round((6.4 + Math.sin(i / 2.2) * 1.1 + ((i * 23) % 9) / 10) * 10) / 10;
    samples.push({ date: iso, steps, calories, sleep: Math.max(4, Math.min(9.5, sleep)) });
  }
  let added = 0;
  try {
    const response = await apiRequest('/api/records/import', {
      method: 'POST',
      body: JSON.stringify({ records: samples }),
    });
    added = response.added.length;
    await loadFromServer();
  } catch (error) {
    toast('error', 'Could not load sample data', error.message);
    return;
  }
  logOperation('success', `Seeded ${added} demo records into the list.`);
  toast('success', 'Sample data loaded', `${added} demo records were added to the list.`);
  pushNotification('info', 'Sample data loaded', `${added} records added for demonstration.`);
  refresh();
}

/* ==========================================================================
   Routing
   ========================================================================== */
const PAGE_RENDERERS = {
  overview: renderOverview,
  calendar: () => { renderCalendar(); },
  records: renderRecords,
  analytics: renderAnalytics,
  visualizer: renderVisualizer,
  export: renderExport,
  settings: renderSettings,
};

function navigate(page) {
  if (!PAGE_RENDERERS[page]) page = 'overview';
  state.page = page;

  qsa('.page').forEach((section) => section.classList.toggle('is-active', section.dataset.page === page));
  qsa('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.nav === page));

  const navItem = qsa('.nav-item').find((item) => item.dataset.nav === page);
  const title = qs('#page-title');
  const subtitle = qs('#page-subtitle');
  if (title && navItem) title.textContent = navItem.dataset.title || 'PulseTrack';
  if (subtitle && navItem) subtitle.textContent = navItem.dataset.subtitle || '';

  if (window.location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  PAGE_RENDERERS[page]();
}

function openSidebar() {
  qs('#sidebar')?.classList.add('is-open');
  qs('#sidebar-scrim')?.classList.add('is-open');
}
function closeSidebar() {
  qs('#sidebar')?.classList.remove('is-open');
  qs('#sidebar-scrim')?.classList.remove('is-open');
}

/* ==========================================================================
   Event wiring
   ========================================================================== */
function bindEvents() {
  // navigation
  qsa('.nav-item').forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      navigate(item.dataset.nav);
    });
  });

  document.addEventListener('click', (event) => {
    const jump = event.target.closest('[data-nav-jump]');
    if (jump) {
      navigate(jump.dataset.navJump);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    const type = action.dataset.action;
    if (type === 'open-add') openRecordModal('add');
    if (type === 'export-csv') exportCsv();
    if (type === 'add-for-date') {
      openRecordModal('add');
      const dateInput = qs('#rec-date');
      if (dateInput) dateInput.value = action.dataset.date;
    }
    if (type === 'edit-date') openRecordModal('edit', action.dataset.date);
    if (type === 'delete-date') askDelete(action.dataset.date);
  });

  // topbar
  qs('#menu-toggle')?.addEventListener('click', openSidebar);
  qs('#sidebar-close')?.addEventListener('click', closeSidebar);
  qs('#sidebar-scrim')?.addEventListener('click', closeSidebar);
  qs('#quick-add')?.addEventListener('click', () => openRecordModal('add'));
  qs('#theme-toggle')?.addEventListener('click', () => {
    state.themePreference = effectiveTheme() === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveSettings();
    renderOverview();
    renderAnalytics();
    renderVisualizer();
  });

  const notifBtn = qs('#notif-btn');
  const notifPanel = qs('#notif-panel');
  notifBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    notifPanel?.classList.toggle('is-open');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.notif-wrap')) notifPanel?.classList.remove('is-open');
  });
  qs('#notif-clear')?.addEventListener('click', () => {
    notifications.length = 0;
    renderNotifications();
    notifPanel?.classList.remove('is-open');
  });

  // modals
  qsa('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => closeModal(button.dataset.closeModal));
  });
  qsa('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    });
  });
  qs('#confirm-accept')?.addEventListener('click', () => {
    const action = pendingConfirm;
    pendingConfirm = null;
    closeModal('confirm-modal');
    if (typeof action === 'function') action();
  });

  // record form
  qs('#record-form')?.addEventListener('submit', submitRecord);
  qs('#rec-clear')?.addEventListener('click', () => {
    const form = qs('#record-form');
    form?.reset();
    clearFormErrors();
    qs('#rec-date').value = isoDate(new Date());
    qs('#rec-steps').focus();
  });

  // records toolbar
  const search = qs('#record-search');
  search?.addEventListener('input', async () => {
    state.records.search = search.value;
    state.records.page = 1;
    const requestNumber = ++searchRequestNumber;
    if (!search.value.trim()) {
      serverSearchResults = null;
      renderRecords();
      return;
    }
    try {
      const { records: matches } = await apiRequest(`/api/records?search=${encodeURIComponent(search.value)}`);
      if (requestNumber !== searchRequestNumber) return;
      serverSearchResults = matches;
    } catch (error) {
      if (requestNumber !== searchRequestNumber) return;
      serverSearchResults = null;
      toast('error', 'Search failed', error.message);
    }
    renderRecords();
  });
  qs('#record-sort')?.addEventListener('change', (event) => {
    state.records.sort = event.target.value;
    state.records.page = 1;
    renderRecords();
  });
  qs('#record-sort-dir')?.addEventListener('click', () => {
    const [field, direction] = state.records.sort.split('-');
    const next = `${field}-${direction === 'asc' ? 'desc' : 'asc'}`;
    state.records.sort = next;
    const select = qs('#record-sort');
    if (select) select.value = next;
    const icon = qs('#record-sort-dir svg');
    if (icon) icon.setAttribute('data-lucide', next.endsWith('-asc') ? 'chevron-up' : 'chevron-down');
    refreshIcons(qs('#record-sort-dir'));
    renderRecords();
  });
  ['record-from', 'record-to'].forEach((id) => {
    qs(`#${id}`)?.addEventListener('change', (event) => {
      state.records[id === 'record-from' ? 'from' : 'to'] = event.target.value;
      state.records.page = 1;
      renderRecords();
    });
  });
  qs('#record-reset')?.addEventListener('click', () => {
    state.records = { ...state.records, search: '', from: '', to: '', page: 1, sort: 'date-desc' };
    if (search) search.value = '';
    const sort = qs('#record-sort');
    if (sort) sort.value = 'date-desc';
    const from = qs('#record-from');
    const to = qs('#record-to');
    if (from) from.value = '';
    if (to) to.value = '';
    renderRecords();
    toast('info', 'Filters cleared', 'Showing every record again.');
  });
  qs('#records-per-page')?.addEventListener('change', (event) => {
    state.records.perPage = Number(event.target.value);
    state.records.page = 1;
    renderRecords();
  });

  // overview range chips
  qsa('#overview-steps-range .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      qsa('#overview-steps-range .chip').forEach((item) => item.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.overviewRange = chip.dataset.range;
      renderOverview();
    });
  });

  // analytics range chips
  const analyticsChips = qs('#analytics-range');
  if (analyticsChips) {
    const customChip = document.createElement('button');
    customChip.className = 'chip';
    customChip.dataset.range = 'custom';
    customChip.textContent = 'Custom';
    analyticsChips.appendChild(customChip);
    qsa('#analytics-range .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        qsa('#analytics-range .chip').forEach((item) => item.classList.remove('is-active'));
        chip.classList.add('is-active');
        state.analyticsRange = chip.dataset.range;
        const custom = qs('#analytics-custom');
        if (custom) custom.hidden = chip.dataset.range !== 'custom';
        if (chip.dataset.range === 'custom' && !state.analyticsCustom.from) {
          const from = qs('#analytics-from');
          const to = qs('#analytics-to');
          if (from) from.value = records[0]?.date || isoDate(new Date());
          if (to) to.value = records[records.length - 1]?.date || isoDate(new Date());
        }
        renderAnalytics();
      });
    });
    qs('#analytics-apply')?.addEventListener('click', () => {
      state.analyticsCustom.from = qs('#analytics-from')?.value || '';
      state.analyticsCustom.to = qs('#analytics-to')?.value || '';
      renderAnalytics();
      toast('info', 'Range applied', 'Analytics recalculated for the selected window.');
    });
  }

  // calendar
  qs('#cal-prev')?.addEventListener('click', () => calendar.goToMonth(-1));
  qs('#cal-next')?.addEventListener('click', () => calendar.goToMonth(1));
  qs('#cal-today')?.addEventListener('click', () => calendar.goToToday());
  qs('#cal-grid')?.addEventListener('click', (event) => {
    const cell = event.target.closest('[data-date]');
    if (cell) calendar.select(cell.dataset.date);
  });

  // visualiser controls
  qs('#viz-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const date = qs('#viz-date').value;
    const steps = Number(qs('#viz-steps').value);
    const calories = Number(qs('#viz-calories').value);
    const sleep = Number(qs('#viz-sleep').value);

    if (!date) {
      toast('error', 'Date required', 'Pick a date before inserting a node.');
      return;
    }
    if (!Number.isFinite(steps) || steps < 0 || steps > 200000) {
      toast('error', 'Invalid steps', 'Steps must be between 0 and 200,000.');
      return;
    }
    if (!Number.isFinite(calories) || calories < 0 || calories > 20000) {
      toast('error', 'Invalid calories', 'Calories must be between 0 and 20,000 kcal.');
      return;
    }
    if (!Number.isFinite(sleep) || sleep < 0 || sleep > 24) {
      toast('error', 'Invalid sleep', 'Sleep must be between 0 and 24 hours.');
      return;
    }

    try {
      await apiRequest('/api/records', {
        method: 'POST',
        body: JSON.stringify({
          date,
          steps: Math.round(steps),
          calories: Math.round(calories),
          sleep: Math.round(sleep * 10) / 10,
        }),
      });
      await loadFromServer();
      logOperation('success', `Inserted node ${date} at the tail — circle re-linked.`);
      toast('success', 'Node inserted', `${date} was appended to the circular list.`);
      pushNotification('success', 'Node inserted', `${date} added to the linked list.`);
      qs('#viz-steps').value = '';
      qs('#viz-calories').value = '';
      qs('#viz-sleep').value = '';
      refresh();
    } catch (error) {
      toast('error', 'Insert failed', error.message);
      logOperation('error', `Insert rejected for ${date} — duplicate date.`);
    }
  });

  qs('#viz-search')?.addEventListener('click', async () => {
    const date = qs('#viz-date').value;
    if (!date) {
      toast('error', 'Date required', 'Enter the date you want to search for.');
      return;
    }
    try {
      await searchOnServer(date);
    } catch (error) {
      if (error.message !== 'Record not found.') {
        toast('error', 'Search failed', error.message);
        return;
      }
    }
    const index = visualizer.focusDate(date);
    const status = qs('#viz-status');
    if (index >= 0) {
      const node = tracker.getNodeAt(index);
      logOperation('info', `Search → ${date} found at position ${index}.`);
      toast('success', 'Node found', `${date} sits at position ${index} in the circle.`);
      if (status) {
        status.innerHTML = `<i data-lucide="search"></i><span>Found ${date} at position ${index} — ${fmt(node.steps)} steps, ${node.calories} kcal, ${node.sleep}h sleep.</span>`;
        refreshIcons(status);
      }
    } else {
      logOperation('info', `Search → ${date} not found.`);
      toast('info', 'Node not found', `${date} is not stored in the list.`);
      if (status) {
        status.innerHTML = `<i data-lucide="search"></i><span>${date} was not found in the circle.</span>`;
        refreshIcons(status);
      }
    }
  });

  qs('#viz-delete')?.addEventListener('click', () => {
    const date = qs('#viz-date').value;
    if (!date) {
      toast('error', 'Date required', 'Enter the date of the node to delete.');
      return;
    }
    if (!tracker.searchRecord(date)) {
      toast('info', 'Node not found', `${date} is not stored in the list.`);
      return;
    }
    askDelete(date);
  });

  qs('#viz-traverse')?.addEventListener('click', () => visualizer.traverse());
  qs('#viz-step')?.addEventListener('click', () => visualizer.stepForward());
  qs('#viz-stop')?.addEventListener('click', () => visualizer.stop());

  // export & import
  qs('#export-csv')?.addEventListener('click', exportCsv);
  qs('#export-json')?.addEventListener('click', exportJson);
  qs('#download-backup')?.addEventListener('click', downloadBackupFile);
  qs('#export-preview-refresh')?.addEventListener('click', renderExport);

  const importFile = qs('#import-file');
  importFile?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    qs('#import-text').value = text;
    handleImport(text);
    event.target.value = '';
  });

  const dropZone = qs('#import-drop');
  dropZone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('is-drag');
  });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('is-drag'));
  dropZone?.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropZone.classList.remove('is-drag');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const text = await file.text();
    qs('#import-text').value = text;
    handleImport(text);
  });

  qs('#import-run')?.addEventListener('click', () => {
    const text = qs('#import-text').value.trim();
    if (!text) {
      toast('error', 'Nothing to import', 'Choose a JSON file or paste a backup payload.');
      return;
    }
    handleImport(text);
  });
  qs('#import-sample')?.addEventListener('click', () => seedSampleData(30));

  // settings
  qsa('.theme-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.themePreference = card.dataset.themeChoice;
      applyTheme();
      saveSettings();
      renderOverview();
      renderAnalytics();
      renderVisualizer();
    });
  });
  qsa('.accent-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      applyAccent(dot.dataset.accent);
      renderOverview();
      renderAnalytics();
      renderVisualizer();
      toast('info', 'Accent updated', 'The new colour has been applied across the app.');
    });
  });

  qs('#clear-data')?.addEventListener('click', () => {
    confirmAction({
      title: 'Clear all data?',
      text: 'Every record will be removed from the circular linked list and SQLite. This cannot be undone.',
      confirmLabel: 'Clear everything',
      onConfirm: async () => {
        try {
          await apiRequest('/api/records', { method: 'DELETE' });
          await loadFromServer();
        } catch (error) {
          toast('error', 'Could not clear data', error.message);
          return;
        }
        records = [];
        activityLog.length = 0;
        state.selectedDate = isoDate(new Date());
        logOperation('error', 'Cleared the entire list.');
        toast('success', 'All data cleared', 'The circular list is empty again.');
        pushNotification('info', 'Data cleared', 'All records were removed from SQLite.');
        refresh();
      },
    });
  });

  qs('#seed-data')?.addEventListener('click', () => seedSampleData(30));

  // keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      qsa('.modal-backdrop:not([hidden])').forEach((modal) => closeModal(modal.id));
      notifPanel?.classList.remove('is-open');
    }
    if (event.key.toLowerCase() === 'n' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      openRecordModal('add');
    }
  });

  window.addEventListener('hashchange', () => {
    const page = window.location.hash.replace('#', '');
    if (page && page !== state.page) navigate(page);
  });

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.themePreference === 'system') {
      applyTheme();
      renderOverview();
      renderAnalytics();
    }
  });
}

function exportCsv() {
  try {
    const count = exportCSV(records);
    toast('success', 'CSV exported', `${count} record${count === 1 ? '' : 's'} written to pulsetrack-records.csv.`);
  } catch (error) {
    toast('error', 'Export failed', error.message);
  }
}

function exportJson() {
  try {
    const count = exportJSON(records);
    toast('success', 'JSON exported', `${count} record${count === 1 ? '' : 's'} written to pulsetrack-records.json.`);
  } catch (error) {
    toast('error', 'Export failed', error.message);
  }
}

function downloadBackupFile() {
  try {
    const count = downloadBackup(records);
    toast('success', 'Backup downloaded', `${count} record${count === 1 ? '' : 's'} saved as a timestamped backup.`);
  } catch (error) {
    toast('error', 'Backup failed', error.message);
  }
}

/* ==========================================================================
   Boot
   ========================================================================== */
async function boot() {
  const settings = Storage.loadSettings();
  state.themePreference = settings.theme || Storage.loadTheme() || 'dark';
  state.accent = settings.accent || '#34d399';

  applyTheme();
  applyAccent(state.accent);

  try {
    await loadFromServer();
    logOperation('info', `Restored ${records.length} node${records.length === 1 ? '' : 's'} from SQLite.`);
  } catch (error) {
    console.error('[PulseTrack] Could not load records from Flask:', error);
    toast('error', 'Could not load health records', error.message);
  }

  const today = qs('#today-label');
  if (today) today.textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });

  const hour = new Date().getHours();
  const heroTitle = qs('#hero-title');
  if (heroTitle) {
    heroTitle.textContent = hour < 12 ? 'Good morning, let’s check your rhythm.' : hour < 18 ? 'Good afternoon, keep the streak alive.' : 'Good evening, here is your day.';
  }

  bindEvents();
  refreshIcons();

  const hash = window.location.hash.replace('#', '');
  navigate(PAGE_RENDERERS[hash] ? hash : 'overview');

  renderNotifications();
  updateStorageWidget();

  setTimeout(() => {
    toast('info', 'Welcome to PulseTrack', 'Press “N” any time to log a new record.');
  }, 900);

  const splash = qs('#boot-splash');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('is-hidden');
      setTimeout(() => splash.remove(), 700);
    }, 620);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
