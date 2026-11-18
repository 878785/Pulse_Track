/**
 * charts.js
 * ---------------------------------------------------------------------------
 * Thin Chart.js wrapper: keeps a registry of chart instances, exposes
 * theme aware colours and rebuilds charts when the palette changes.
 */

import Chart from 'chart.js/auto';

const registry = new Map();

/* -------------------------------------------------------------- palette */
function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function palette() {
  return {
    accent: cssVar('--accent', '#34d399'),
    accentStrong: cssVar('--accent-strong', '#10b981'),
    orange: '#fb923c',
    violet: '#a78bfa',
    sky: '#38bdf8',
    amber: '#fbbf24',
    rose: '#f472b6',
    text: cssVar('--text-soft', '#b3c8c2'),
    muted: cssVar('--muted', '#7b918b'),
    grid: 'rgba(127, 160, 152, 0.13)',
    border: cssVar('--border', 'rgba(255,255,255,0.08)'),
  };
}

/* ------------------------------------------------------------ registry */
export function getChart(id) {
  return registry.get(id) || null;
}

export function destroyChart(id) {
  const chart = registry.get(id);
  if (chart) {
    chart.destroy();
    registry.delete(id);
  }
}

export function destroyAll() {
  registry.forEach((chart) => chart.destroy());
  registry.clear();
}

/** Create (or replace) a chart bound to a canvas id. */
export function upsertChart(id, config) {
  destroyChart(id);
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const chart = new Chart(canvas, config);
  registry.set(id, chart);
  return chart;
}

/* ------------------------------------------------------------- helpers */
export function gradientFor(canvas, color, alphaTop = 0.38, alphaBottom = 0) {
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height || 260);
  gradient.addColorStop(0, hexToRgba(color, alphaTop));
  gradient.addColorStop(1, hexToRgba(color, alphaBottom));
  return gradient;
}

/** Scriptable gradient so the fill always matches the real chart area. */
export function areaGradient(color, alphaTop = 0.34) {
  return (context) => {
    const { chart } = context;
    const { ctx, chartArea } = chart;
    if (!chartArea) return hexToRgba(color, alphaTop);
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, hexToRgba(color, alphaTop));
    gradient.addColorStop(1, hexToRgba(color, 0));
    return gradient;
  };
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared scale / tooltip styling so every chart feels like one system. */
export function baseOptions(extra = {}) {
  const p = palette();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(9, 20, 17, 0.95)',
        borderColor: 'rgba(52, 211, 153, 0.35)',
        borderWidth: 1,
        titleColor: '#e8f3f0',
        bodyColor: '#b3c8c2',
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 5,
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { color: p.muted, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 18 },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: p.grid, drawBorder: false },
        ticks: { color: p.muted, font: { size: 11 }, padding: 6 },
        border: { display: false },
      },
    },
    ...extra,
  };
}

/* -------------------------------------------------------- chart presets */
export function lineChart(id, { labels, data, label, color, fill = true, stepped = false }) {
  const p = palette();
  if (!document.getElementById(id)) return null;
  const stroke = color || p.accent;
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: label || 'Value',
          data,
          borderColor: stroke,
          borderWidth: 2.4,
          tension: 0.36,
          stepped,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: stroke,
          pointHoverBorderColor: '#04150f',
          pointHoverBorderWidth: 2,
          fill: fill ? 'origin' : false,
          backgroundColor: fill ? areaGradient(stroke, 0.34) : 'transparent',
        },
      ],
    },
    options: baseOptions(),
  };
  return upsertChart(id, config);
}

export function barChart(id, { labels, data, label, color, rounded = true }) {
  const p = palette();
  if (!document.getElementById(id)) return null;
  const stroke = color || p.accent;
  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: label || 'Value',
          data,
          backgroundColor: hexToRgba(stroke, 0.72),
          hoverBackgroundColor: stroke,
          borderRadius: rounded ? 7 : 0,
          borderSkipped: false,
          maxBarThickness: 34,
        },
      ],
    },
    options: baseOptions(),
  };
  return upsertChart(id, config);
}

export function doughnutChart(id, { labels, data, colors }) {
  const config = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: 'rgba(0,0,0,0.25)',
          borderWidth: 3,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      animation: { duration: 750, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(9, 20, 17, 0.95)',
          borderColor: 'rgba(52, 211, 153, 0.35)',
          borderWidth: 1,
          padding: 11,
          cornerRadius: 10,
        },
      },
    },
  };
  return upsertChart(id, config);
}
