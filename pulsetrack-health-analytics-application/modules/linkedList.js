/**
 * linkedList.js
 * ---------------------------------------------------------------------------
 * Browser-side mirror of the authoritative Python circular linked list.
 *
 * Flask reloads these records from the backend after every mutation. The
 * mirror lets the dashboard render its diagram and charts without storing data.
 *
 *   head ──▶ [node] ──▶ [node] ──▶ [node] ──┐
 *     ▲                                     │
 *     └─────────────────────────────────────┘
 *
 * SQLite is the durable store; the Python list performs backend record logic.
 */

export class CircularNode {
  constructor(date, steps, calories, sleep, id = null) {
    this.id = id;
    this.date = date;          // YYYY-MM-DD
    this.steps = steps;        // integer
    this.calories = calories;  // integer (kcal)
    this.sleep = sleep;        // decimal hours
    this.next = null;          // pointer to the following node
  }

  /** Plain object copy (no pointer) — safe for tables, charts and exports. */
  toRecord() {
    return {
      id: this.id,
      date: this.date,
      steps: this.steps,
      calories: this.calories,
      sleep: this.sleep,
    };
  }

  /** Human friendly label used by the visualiser and console log. */
  get label() {
    const d = new Date(`${this.date}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  }
}

/**
 * HealthTracker — the Circular Linked List used by the whole application.
 */
export class HealthTracker {
  constructor() {
    this.head = null;      // first node
    this.tail = null;      // last node (tail.next === head)
    this.size = 0;         // node count
    this.current = null;   // traversal cursor
    this.operations = 0;   // counter shown in the visualiser console
  }

  /* ---------------------------------------------------------------- basics */
  isEmpty() {
    return this.head === null;
  }

  /** True when the circular chain is intact (used as a self check). */
  isValid() {
    if (!this.head) return this.tail === null;
    let node = this.head;
    let steps = 0;
    do {
      steps += 1;
      node = node.next;
      if (steps > this.size + 2) return false; // guard against endless loops
    } while (node !== this.head);
    return steps === this.size && this.tail.next === this.head;
  }

  /* ---------------------------------------------------------------- insert */
  /**
   * Append a new record at the tail and close the circle.
   * @throws {Error} when a record for the same date already exists.
   */
  addRecord({ id = null, date, steps, calories, sleep }) {
    if (this.searchRecord(date)) {
      throw new Error(`A record for ${date} already exists in the list.`);
    }
    const node = new CircularNode(date, steps, calories, sleep, id);

    if (!this.head) {
      // First node points to itself — the smallest possible circle.
      node.next = node;
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;   // new node links back to the head
      this.tail.next = node;   // previous tail points to the new node
      this.tail = node;        // new node becomes the tail
    }

    this.size += 1;
    this.current = this.head;
    this.operations += 1;
    return node;
  }

  /* ---------------------------------------------------------------- search */
  /** Find a node by date. Starts at head and wraps around the circle. */
  searchRecord(date) {
    if (!this.head) return null;
    let node = this.head;
    let guard = 0;
    do {
      if (node.date === date) return node;
      node = node.next;
      guard += 1;
    } while (node !== this.head && guard <= this.size);
    return null;
  }

  /* ---------------------------------------------------------------- update */
  /** Update an existing node. Returns the updated node or null. */
  updateRecord(date, data = {}) {
    const node = this.searchRecord(date);
    if (!node) return null;
    if (data.date !== undefined) node.date = data.date;
    if (data.steps !== undefined) node.steps = data.steps;
    if (data.calories !== undefined) node.calories = data.calories;
    if (data.sleep !== undefined) node.sleep = data.sleep;
    this.operations += 1;
    return node;
  }

  /* ---------------------------------------------------------------- delete */
  /** Remove a node and re-close the circle. Returns the removed node or null. */
  deleteRecord(date) {
    if (!this.head) return null;

    // Deleting the head
    if (this.head.date === date) {
      const removed = this.head;
      if (this.head === this.tail) {
        this.head = null;
        this.tail = null;
        this.size = 0;
        this.current = null;
        this.operations += 1;
        return removed;
      }
      const newHead = this.head.next;
      this.tail.next = newHead; // circle stays closed
      this.head = newHead;
      this.size -= 1;
      this.current = this.head;
      this.operations += 1;
      return removed;
    }

    // Deleting any other node
    let prev = this.head;
    let node = this.head.next;
    let guard = 0;
    while (node !== this.head && guard <= this.size) {
      if (node.date === date) {
        prev.next = node.next;
        if (node === this.tail) this.tail = prev;
        this.size -= 1;
        this.current = this.head;
        this.operations += 1;
        return node;
      }
      prev = node;
      node = node.next;
      guard += 1;
    }
    return null;
  }

  /* ------------------------------------------------------------- traversal */
  /**
   * Visit every node once, starting at the head and wrapping at the tail.
   * @param {(node: CircularNode, index: number) => void} visitor
   */
  traverse(visitor) {
    const visited = [];
    if (!this.head) return visited;
    let node = this.head;
    let guard = 0;
    do {
      visited.push(node);
      if (typeof visitor === 'function') visitor(node, visited.length - 1);
      node = node.next;
      guard += 1;
    } while (node !== this.head && guard <= this.size);
    return visited;
  }

  /** Flatten the list into an array of plain records (in list order). */
  getAllRecords() {
    return this.traverse().map((node) => node.toRecord());
  }

  /** Node at a given index (0 = head) — used by the visualiser. */
  getNodeAt(index) {
    if (!this.head || index < 0 || index >= this.size) return null;
    let node = this.head;
    for (let i = 0; i < index; i += 1) node = node.next;
    return node;
  }

  /** Index of a node by date, or -1. */
  indexOf(date) {
    const index = this.traverse().findIndex((node) => node.date === date);
    return index;
  }

  /** Removes every node and resets the circle. */
  clear() {
    this.head = null;
    this.tail = null;
    this.size = 0;
    this.current = null;
    this.operations += 1;
  }

  /* ------------------------------------------------------------ statistics */
  getStats() {
    const records = this.getAllRecords();
    const count = records.length;
    if (!count) {
      return {
        count: 0, totalSteps: 0, totalCalories: 0, totalSleep: 0,
        avgSteps: 0, avgCalories: 0, avgSleep: 0,
        maxSteps: 0, minSteps: 0, maxCalories: 0, minCalories: 0,
        maxSleep: 0, minSleep: 0, bestDate: null,
      };
    }
    const steps = records.map((r) => r.steps);
    const calories = records.map((r) => r.calories);
    const sleep = records.map((r) => r.sleep);
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const maxSteps = Math.max(...steps);
    const bestDate = records.find((r) => r.steps === maxSteps)?.date ?? null;

    return {
      count,
      totalSteps: sum(steps),
      totalCalories: sum(calories),
      totalSleep: Math.round(sum(sleep) * 10) / 10,
      avgSteps: Math.round(sum(steps) / count),
      avgCalories: Math.round(sum(calories) / count),
      avgSleep: Math.round((sum(sleep) / count) * 10) / 10,
      maxSteps,
      minSteps: Math.min(...steps),
      maxCalories: Math.max(...calories),
      minCalories: Math.min(...calories),
      maxSleep: Math.max(...sleep),
      minSleep: Math.min(...sleep),
      bestDate,
    };
  }
}

export { HealthTracker as CircularLinkedList };
