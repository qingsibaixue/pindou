import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEVEL_COUNT = 50;
const TRAY_CAPACITY = 20;
const MAX_BOARD_PIXELS = 600;
const MIN_CELL_SIZE = 18;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function components(indexes, cols) {
  const remaining = new Set(indexes);
  const sizes = [];
  while (remaining.size > 0) {
    const start = remaining.values().next().value;
    remaining.delete(start);
    const queue = [start];
    let size = 0;
    while (queue.length > 0) {
      const index = queue.shift();
      size++;
      const row = Math.floor(index / cols);
      const col = index % cols;
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const next = (row + dr) * cols + col + dc;
        if (remaining.delete(next)) queue.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes;
}

function hasConnectedSplit(indexes, cols, firstSize) {
  if (indexes.length <= firstSize) return true;
  const allowed = new Set(indexes);
  const remainderSize = indexes.length - firstSize;
  for (const seed of indexes) {
    const queue = [seed];
    const seen = new Set();
    const remainder = [];
    while (queue.length > 0 && remainder.length < remainderSize) {
      const index = queue.shift();
      if (seen.has(index)) continue;
      seen.add(index);
      remainder.push(index);
      const row = Math.floor(index / cols);
      const col = index % cols;
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const next = (row + dr) * cols + col + dc;
        if (allowed.has(next) && !seen.has(next)) queue.push(next);
      }
    }
    const reserved = new Set(remainder);
    const first = indexes.filter((index) => !reserved.has(index));
    if (components(remainder, cols).length === 1 && components(first, cols).length === 1) {
      return true;
    }
  }
  return false;
}

function cycleLengths(permutation) {
  const seen = new Set();
  const result = [];
  for (const start of permutation.keys()) {
    if (seen.has(start)) continue;
    let current = start;
    let length = 0;
    while (!seen.has(current)) {
      seen.add(current);
      length++;
      current = permutation.get(current);
    }
    result.push(length);
  }
  return result.sort((a, b) => a - b);
}

const levels = [];
for (let number = 1; number <= LEVEL_COUNT; number++) {
  const id = `level_${String(number).padStart(3, "0")}`;
  const path = resolve("assets/resources/levels", `${id}.json`);
  const level = JSON.parse(readFileSync(path, "utf8"));
  assert(level.id === id, `${id}: id mismatch`);
  assert(level.name && level.guide, `${id}: missing name or guide`);
  assert(level.rows >= 2 && level.rows <= 32, `${id}: rows out of range`);
  assert(level.cols >= 2 && level.cols <= 32, `${id}: cols out of range`);
  assert(level.cells.length === level.rows * level.cols, `${id}: cell count mismatch`);
  assert(level.trayCapacity === TRAY_CAPACITY, `${id}: tray capacity must be 20`);
  assert(level.trayBeans.length === 0, `${id}: tray must start empty`);
  assert(level.cells.every((cell) => cell.beanColorId >= 0), `${id}: board has an opening bean hole`);

  const cellSize = Math.max(
    MIN_CELL_SIZE,
    Math.min(40, Math.floor(MAX_BOARD_PIXELS / level.cols), Math.floor(MAX_BOARD_PIXELS / level.rows)),
  );
  assert(level.cols * cellSize <= MAX_BOARD_PIXELS, `${id}: board too wide after scaling`);
  assert(level.rows * cellSize <= MAX_BOARD_PIXELS, `${id}: board too tall after scaling`);

  const targetCounts = new Map();
  const beanCounts = new Map();
  const targetIndexes = new Map();
  const mapping = new Map();
  level.cells.forEach((cell, index) => {
    targetCounts.set(cell.targetColorId, (targetCounts.get(cell.targetColorId) || 0) + 1);
    beanCounts.set(cell.beanColorId, (beanCounts.get(cell.beanColorId) || 0) + 1);
    if (cell.targetColorId > 0) {
      if (!targetIndexes.has(cell.targetColorId)) targetIndexes.set(cell.targetColorId, []);
      targetIndexes.get(cell.targetColorId).push(index);
      const previous = mapping.get(cell.targetColorId);
      assert(previous === undefined || previous === cell.beanColorId, `${id}: target region mixes bean colors`);
      mapping.set(cell.targetColorId, cell.beanColorId);
      assert(cell.targetColorId !== cell.beanColorId, `${id}: colored cell starts already matched`);
    }
  });
  for (const color of level.colors) {
    assert(targetCounts.get(color.id) === beanCounts.get(color.id), `${id}: color ${color.id} is not conserved`);
  }

  const sizes = [];
  for (const [colorId, indexes] of targetIndexes) {
    assert(components(indexes, level.cols).length === 1, `${id}: target ${colorId} is disconnected`);
    assert(hasConnectedSplit(indexes, level.cols, TRAY_CAPACITY), `${id}: target ${colorId} lacks connected overflow split`);
    sizes.push(indexes.length);
  }
  assert(new Set(sizes).size === 1, `${id}: group sizes differ (${sizes.join(",")})`);
  assert([...mapping.values()].every((value) => mapping.has(value)), `${id}: bean mapping is not a permutation`);

  const cycles = cycleLengths(mapping);
  if (number >= 21 && number <= 40) {
    assert(cycles.join(",") === "5", `${id}: five-color chapter must use one 5-cycle`);
  }
  if (number >= 41) {
    const expected = number % 3 === 0 ? "6" : number % 3 === 1 ? "3,3" : "2,2,2";
    assert(cycles.join(",") === expected, `${id}: expected cycles ${expected}, got ${cycles.join(",")}`);
  }

  levels.push({ level, sizes, cycles, cellSize });
}

assert(new Set(levels.map(({ level }) => level.name)).size === LEVEL_COUNT, "level names must be unique");
assert(new Set(levels.map(({ level }) => level.guide)).size === LEVEL_COUNT, "level guides must be unique");
assert(
  new Set(levels.map(({ level }) => level.cells.map((cell) => cell.targetColorId > 0 ? "1" : "0").join(""))).size === LEVEL_COUNT,
  "level silhouettes must be unique",
);

console.log(`PASS: ${LEVEL_COUNT} levels validated`);
for (const start of [1, 11, 21, 31, 41]) {
  const chapter = levels.slice(start - 1, start === 41 ? 50 : start + 9);
  const shapes = chapter.map(({ level }) => `${level.rows}x${level.cols}`).join(", ");
  const cycles = [...new Set(chapter.map((item) => item.cycles.join("+")))].join(" / ");
  console.log(`chapter ${start}-${start + chapter.length - 1}: ${shapes}; cycles=${cycles}`);
}
