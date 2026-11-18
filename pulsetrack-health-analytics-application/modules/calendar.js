/**
 * calendar.js
 * ---------------------------------------------------------------------------
 * Interactive monthly calendar rendered from the records that are currently
 * stored in the circular linked list.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export class ActivityCalendar {
  constructor({ onSelect } = {}) {
    this.onSelect = onSelect;
    this.viewDate = new Date();
    this.selectedDate = null;
    this.records = [];
    this.byDate = new Map();
  }

  setRecords(records) {
    this.records = records;
    this.byDate = new Map(records.map((r) => [r.date, r]));
    this.render();
  }

  get monthLabel() {
    return this.viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  goToMonth(offset) {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + offset, 1);
    this.render();
  }

  goToToday() {
    this.viewDate = new Date();
    this.render();
  }

  select(dateString) {
    this.selectedDate = dateString;
    this.render();
    if (typeof this.onSelect === 'function') this.onSelect(dateString, this.byDate.get(dateString) || null);
  }

  /** Records that belong to the visible month. */
  monthRecords() {
    const prefix = `${this.viewDate.getFullYear()}-${String(this.viewDate.getMonth() + 1).padStart(2, '0')}`;
    return this.records.filter((r) => r.date.startsWith(prefix));
  }

  render() {
    this.renderHeader();
    this.renderGrid();
    this.renderSummary();
  }

  renderHeader() {
    const title = document.getElementById('cal-title');
    if (title) title.textContent = this.monthLabel;
    const weekdays = document.getElementById('cal-weekdays');
    if (weekdays && !weekdays.children.length) {
      weekdays.innerHTML = WEEKDAYS.map((d) => `<span>${d}</span>`).join('');
    }
  }

  renderGrid() {
    const grid = document.getElementById('cal-grid');
    if (!grid) return;

    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const leading = (firstDay.getDay() + 6) % 7; // Monday-first offset
    const todayIso = isoDate(new Date());

    const cells = [];

    // previous month filler
    for (let i = leading - 1; i >= 0; i -= 1) {
      const day = daysInPrevMonth - i;
      const date = new Date(year, month - 1, day);
      cells.push(this.buildCell(date, true, todayIso));
    }
    // current month
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push(this.buildCell(date, false, todayIso));
    }
    // next month filler to complete the grid
    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const date = new Date(year, month + 1, nextDay);
      cells.push(this.buildCell(date, true, todayIso));
      nextDay += 1;
    }

    grid.innerHTML = cells.join('');
  }

  buildCell(date, outside, todayIso) {
    const key = isoDate(date);
    const record = this.byDate.get(key);
    const classes = ['cal-day'];
    if (outside) classes.push('is-out');
    if (key === todayIso) classes.push('is-today');
    if (key === this.selectedDate) classes.push('is-selected');

    let dot = '';
    let stepsText = '';
    if (record) {
      const level = record.steps >= 10000 ? '#fbbf24' : record.steps >= 5000 ? 'var(--accent)' : '#38bdf8';
      dot = `<span class="cal-dot" style="--dot:${level}"></span>`;
      stepsText = `<span class="cal-steps">${formatCompact(record.steps)}</span>`;
    }

    return `<button class="${classes.join(' ')}" data-date="${key}" type="button">
      <span>${date.getDate()}</span>${dot}${stepsText}
    </button>`;
  }

  renderSummary() {
    const host = document.getElementById('cal-summary');
    if (!host) return;
    const records = this.monthRecords();

    if (!records.length) {
      host.innerHTML = `<div class="stat-cell"><span>Records this month</span><strong>0</strong><small>No data yet</small></div>
        <div class="stat-cell"><span>Total steps</span><strong>0</strong><small>—</small></div>
        <div class="stat-cell"><span>Average sleep</span><strong>0h</strong><small>—</small></div>
        <div class="stat-cell"><span>Total calories</span><strong>0</strong><small>—</small></div>`;
      return;
    }

    const totalSteps = records.reduce((sum, r) => sum + r.steps, 0);
    const totalCalories = records.reduce((sum, r) => sum + r.calories, 0);
    const avgSleep = records.reduce((sum, r) => sum + r.sleep, 0) / records.length;
    const best = records.reduce((a, b) => (b.steps > a.steps ? b : a));

    host.innerHTML = `
      <div class="stat-cell"><span>Records this month</span><strong>${records.length}</strong><small>${new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 0).getDate()} days</small></div>
      <div class="stat-cell"><span>Total steps</span><strong>${formatCompact(totalSteps)}</strong><small>avg ${formatCompact(Math.round(totalSteps / records.length))}/day</small></div>
      <div class="stat-cell"><span>Average sleep</span><strong>${avgSleep.toFixed(1)}h</strong><small>${Math.round(avgSleep * 10) / 10}h nightly</small></div>
      <div class="stat-cell"><span>Total calories</span><strong>${formatCompact(totalCalories)}</strong><small>avg ${formatCompact(Math.round(totalCalories / records.length))}/day</small></div>
      <div class="stat-cell"><span>Most active day</span><strong>${new Date(`${best.date}T00:00:00`).getDate()} ${new Date(`${best.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</strong><small>${formatCompact(best.steps)} steps</small></div>`;
  }
}

function formatCompact(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

export { isoDate, parseISO, formatCompact };
