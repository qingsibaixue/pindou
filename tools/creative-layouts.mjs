const MIN_GROUP = 12;
const MAX_GROUP = 40;

const createMask = (rows = 26, cols = 18) =>
  Array.from({ length: rows }, () => new Array(cols).fill(false));

function rect(mask, x, y, width, height) {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      if (mask[row]?.[col] !== undefined) mask[row][col] = true;
    }
  }
}

function ellipse(mask, cx, cy, rx, ry) {
  for (let row = Math.floor(cy - ry); row <= Math.ceil(cy + ry); row++) {
    for (let col = Math.floor(cx - rx); col <= Math.ceil(cx + rx); col++) {
      if (mask[row]?.[col] === undefined) continue;
      const dx = (col - cx) / Math.max(1, rx);
      const dy = (row - cy) / Math.max(1, ry);
      if (dx * dx + dy * dy <= 1) mask[row][col] = true;
    }
  }
}

function triangle(mask, a, b, c) {
  const area = (p1, p2, p3) =>
    (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1])) / 2;
  const total = Math.abs(area(a, b, c));
  for (let row = Math.floor(Math.min(a[1], b[1], c[1])); row <= Math.ceil(Math.max(a[1], b[1], c[1])); row++) {
    for (let col = Math.floor(Math.min(a[0], b[0], c[0])); col <= Math.ceil(Math.max(a[0], b[0], c[0])); col++) {
      if (mask[row]?.[col] === undefined) continue;
      const point = [col, row];
      const sum = Math.abs(area(point, b, c)) + Math.abs(area(a, point, c)) + Math.abs(area(a, b, point));
      if (Math.abs(sum - total) < 0.01) mask[row][col] = true;
    }
  }
}

function line(mask, x0, y0, x1, y1, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(x0 + (x1 - x0) * step / steps);
    const y = Math.round(y0 + (y1 - y0) * step / steps);
    rect(mask, x - Math.floor((thickness - 1) / 2), y - Math.floor((thickness - 1) / 2), thickness, thickness);
  }
}

function componentsFromIndexes(indexes, cols) {
  const remaining = new Set(indexes);
  const components = [];
  while (remaining.size) {
    const start = remaining.values().next().value;
    remaining.delete(start);
    const queue = [start];
    const component = [];
    while (queue.length) {
      const index = queue.shift();
      component.push(index);
      const row = Math.floor(index / cols), col = index % cols;
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const nextRow = row + dr, nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextCol >= cols) continue;
        const next = nextRow * cols + nextCol;
        if (remaining.delete(next)) queue.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

function maskIndexes(mask) {
  const result = [];
  mask.forEach((row, r) => row.forEach((filled, c) => filled && result.push(r * mask[0].length + c)));
  return result;
}

function connectMask(mask) {
  let components = componentsFromIndexes(maskIndexes(mask), mask[0].length);
  while (components.length > 1) {
    let best = null;
    for (const a of components[0]) {
      for (let group = 1; group < components.length; group++) {
        for (const b of components[group]) {
          const ar = Math.floor(a / mask[0].length), ac = a % mask[0].length;
          const br = Math.floor(b / mask[0].length), bc = b % mask[0].length;
          const distance = Math.abs(ar - br) + Math.abs(ac - bc);
          if (!best || distance < best.distance) best = { distance, ar, ac, br, bc };
        }
      }
    }
    line(mask, best.ac, best.ar, best.bc, best.ar);
    line(mask, best.bc, best.ar, best.bc, best.br);
    components = componentsFromIndexes(maskIndexes(mask), mask[0].length);
  }
}

function normalize(mask) {
  connectMask(mask);
  let points = maskIndexes(mask);
  if (points.length % 2 === 1) {
    const index = points[points.length - 1];
    const row = Math.floor(index / mask[0].length), col = index % mask[0].length;
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      if (mask[row + dr]?.[col + dc] === false) { mask[row + dr][col + dc] = true; break; }
    }
  }
  points = maskIndexes(mask);
  const rows = points.map((index) => Math.floor(index / mask[0].length));
  const cols = points.map((index) => index % mask[0].length);
  const minRow = Math.min(...rows), maxRow = Math.max(...rows);
  const minCol = Math.min(...cols), maxCol = Math.max(...cols);
  return Array.from({ length: maxRow - minRow + 1 }, (_, r) =>
    Array.from({ length: maxCol - minCol + 1 }, (_, c) => Boolean(mask[minRow + r]?.[minCol + c])),
  );
}

const connected = (indexes, cols) =>
  indexes.length === 0 || componentsFromIndexes(indexes, cols).length === 1;

function hasConnectedTraySplit(indexes, cols) {
  if (indexes.length <= 20) return true;
  const allowed = new Set(indexes);
  const remainderSize = indexes.length - 20;
  for (const seed of indexes) {
    const queue = [seed], seen = new Set([seed]), remainder = [];
    while (queue.length && remainder.length < remainderSize) {
      const index = queue.shift();
      remainder.push(index);
      const row = Math.floor(index / cols), col = index % cols;
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const nextRow = row + dr, nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextCol >= cols) continue;
        const next = nextRow * cols + nextCol;
        if (allowed.has(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    const reserved = new Set(remainder);
    if (remainder.length === remainderSize && connected(remainder, cols) && connected(indexes.filter((i) => !reserved.has(i)), cols)) {
      return true;
    }
  }
  return false;
}

function chunkCandidates(remaining, size, cols, variant) {
  const indexes = [...remaining];
  const orders = [
    [[-1, 0], [0, 1], [1, 0], [0, -1]],
    [[0, 1], [1, 0], [0, -1], [-1, 0]],
    [[1, 0], [0, -1], [-1, 0], [0, 1]],
    [[0, -1], [-1, 0], [0, 1], [1, 0]],
  ];
  const boundary = indexes.filter((index) => {
    const row = Math.floor(index / cols), col = index % cols;
    return [[-1, 0], [0, -1], [0, 1], [1, 0]]
      .filter(([dr, dc]) => {
        const nextRow = row + dr, nextCol = col + dc;
        return nextRow >= 0 && nextCol >= 0 && nextCol < cols && remaining.has(nextRow * cols + nextCol);
      }).length < 4;
  });
  const ordered = boundary.sort((a, b) => ((a * 7 + variant * 13) % 97) - ((b * 7 + variant * 13) % 97));
  const stride = Math.max(1, Math.floor(ordered.length / 24));
  const seeds = ordered.filter((_, index) => index % stride === 0).slice(0, 28);
  const candidates = [];
  const signatures = new Set();
  for (const seed of seeds) {
    for (let orderIndex = 0; orderIndex < orders.length; orderIndex++) {
      const queue = [seed], seen = new Set([seed]), chunk = [];
      const order = orders[(orderIndex + variant) % orders.length];
      while (queue.length && chunk.length < size) {
        const index = queue.shift();
        if (!remaining.has(index)) continue;
        chunk.push(index);
        const row = Math.floor(index / cols), col = index % cols;
        for (const [dr, dc] of order) {
          const nextRow = row + dr, nextCol = col + dc;
          if (nextRow < 0 || nextCol < 0 || nextCol >= cols) continue;
          const next = nextRow * cols + nextCol;
          if (remaining.has(next) && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      if (chunk.length !== size) continue;
      const chosen = new Set(chunk);
      if (hasConnectedTraySplit(chunk, cols) && connected(indexes.filter((index) => !chosen.has(index)), cols)) {
        const signature = [...chunk].sort((a, b) => a - b).join(",");
        if (!signatures.has(signature)) {
          signatures.add(signature);
          candidates.push(chunk);
          if (candidates.length >= 24) return candidates;
        }
      }
    }
  }
  return candidates;
}

function partitionMask(remaining, sizes, cols, variant, index = 0) {
  if (index === sizes.length - 1) {
    const last = [...remaining];
    return last.length === sizes[index] && connected(last, cols) && hasConnectedTraySplit(last, cols) ? [last] : null;
  }
  const candidates = chunkCandidates(remaining, sizes[index], cols, variant + index * 3);
  for (const chunk of candidates) {
    const next = new Set(remaining);
    chunk.forEach((cell) => next.delete(cell));
    const rest = partitionMask(next, sizes, cols, variant, index + 1);
    if (rest) return [chunk, ...rest];
  }
  return null;
}

function pairedSizes(total, count, variant) {
  const half = total / 2;
  if (count === 4) {
    let first = Math.max(
      MIN_GROUP,
      half - MAX_GROUP,
      Math.min(MAX_GROUP, Math.floor(half / 2) - 4 + variant % 9, half - MIN_GROUP),
    );
    let second = half - first;
    if (first === second && first > MIN_GROUP && second < MAX_GROUP) {
      first--;
      second++;
    }
    if (second < MIN_GROUP || second > MAX_GROUP) throw new Error(`creative mask ${variant}: total ${total} is unsuitable`);
    return [first, first, second, second];
  }
  const base = Math.floor(half / 3);
  let first = Math.max(MIN_GROUP, Math.min(MAX_GROUP, base - 3 + variant % 5));
  let second = Math.max(MIN_GROUP, Math.min(MAX_GROUP, base - 1 + (variant * 2) % 5));
  let third = half - first - second;
  while (third > MAX_GROUP && second < MAX_GROUP) { second++; third--; }
  while (third < MIN_GROUP && second > MIN_GROUP) { second--; third++; }
  if (new Set([first, second, third]).size === 1 && first > MIN_GROUP && third < MAX_GROUP) {
    first--;
    third++;
  }
  if ([first, second, third].some((size) => size < MIN_GROUP || size > MAX_GROUP)) {
    throw new Error(`creative mask ${variant}: total ${total} is unsuitable`);
  }
  return [first, first, second, second, third, third];
}

function densePairedSizes(total, count, variant) {
  if (total % 2 !== 0 || count % 2 !== 0) {
    throw new Error(`dense board ${variant}: total and region count must be even`);
  }
  const pairCount = count / 2;
  const half = total / 2;
  const base = Math.floor(half / pairCount);
  const sizes = new Array(pairCount).fill(base);
  for (let i = 0; i < half - base * pairCount; i++) {
    sizes[(i + variant) % pairCount]++;
  }

  for (let i = 0; i < Math.floor(pairCount / 2); i++) {
    const low = (i + variant) % pairCount;
    const high = (pairCount - 1 - i + variant) % pairCount;
    if (low === high) continue;
    const delta = 1 + (variant + i) % 3;
    const transferable = Math.min(delta, sizes[high] - MIN_GROUP, MAX_GROUP - sizes[low]);
    if (transferable > 0) {
      sizes[low] += transferable;
      sizes[high] -= transferable;
    }
  }

  if (sizes.some((size) => size < MIN_GROUP || size > MAX_GROUP)) {
    throw new Error(`dense board ${variant}: unsuitable paired sizes ${sizes.join("/")}`);
  }
  if (new Set(sizes).size < 2) {
    const donor = sizes.findIndex((size) => size > MIN_GROUP);
    const receiver = sizes.findIndex((size, index) => index !== donor && size < MAX_GROUP);
    if (donor < 0 || receiver < 0) throw new Error(`dense board ${variant}: cannot vary sizes`);
    sizes[donor]--;
    sizes[receiver]++;
  }
  return sizes.flatMap((size) => [size, size]);
}

function rowSnake(rows, cols) {
  const path = [];
  for (let row = 0; row < rows; row++) {
    const columns = Array.from({ length: cols }, (_, col) => row % 2 === 0 ? col : cols - 1 - col);
    columns.forEach((col) => path.push(row * cols + col));
  }
  return path;
}

function columnSnake(rows, cols) {
  const path = [];
  for (let col = 0; col < cols; col++) {
    const rowIndexes = Array.from({ length: rows }, (_, row) => col % 2 === 0 ? row : rows - 1 - row);
    rowIndexes.forEach((row) => path.push(row * cols + col));
  }
  return path;
}

function spiralPath(rows, cols) {
  const path = [];
  let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col++) path.push(top * cols + col);
    top++;
    for (let row = top; row <= bottom; row++) path.push(row * cols + right);
    right--;
    if (top <= bottom) {
      for (let col = right; col >= left; col--) path.push(bottom * cols + col);
      bottom--;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row--) path.push(row * cols + left);
      left++;
    }
  }
  return path;
}

function carveDenseArtwork(rawMask, variant) {
  const normalized = normalize(rawMask);
  let rows = normalized.length;
  let cols = normalized[0].length;
  if ((rows * cols) % 2 !== 0) {
    if (cols < 18) cols++;
    else rows++;
  }

  const total = rows * cols;
  const regionCount = total <= 300 ? 8 : total <= 400 ? 10 : 12;
  const sizes = densePairedSizes(total, regionCount, variant);
  const canvas = Array.from({ length: rows }, () => new Array(cols).fill("."));
  let chunks = null;
  // 仅在章节起点、恐龙里程碑和终章保留明确的螺旋节奏，
  // 其余关卡使用不规则连通色块，避免满盘关卡再次形成机械重复。
  if (![26, 35, 50].includes(variant)) {
    chunks = partitionMask(new Set(Array.from({ length: total }, (_, index) => index)), sizes, cols, variant * 5);
  }
  if (!chunks) {
    const pathFactories = [rowSnake, columnSnake, spiralPath];
    const path = pathFactories[variant % pathFactories.length](rows, cols);
    if (variant % 2 === 0) path.reverse();
    let cursor = 0;
    chunks = sizes.map((size) => {
      const chunk = path.slice(cursor, cursor + size);
      cursor += size;
      return chunk;
    });
  }

  chunks.forEach((chunk, index) => {
    const letter = String.fromCharCode(65 + index);
    chunk.forEach((cell) => {
      canvas[Math.floor(cell / cols)][cell % cols] = letter;
    });
  });
  if (chunks.flat().length !== total || canvas.some((row) => row.includes("."))) {
    throw new Error(`dense board ${variant}: board was not fully colored`);
  }

  return {
    art: canvas.map((row) => row.join("")),
    beanMapping: Array.from({ length: regionCount }, (_, index) => index % 2 === 0 ? index + 2 : index),
    designedSizes: sizes,
  };
}

function carveArtwork(rawMask, regionCount, variant) {
  const mask = normalize(rawMask);
  const cols = mask[0].length;
  const all = maskIndexes(mask);
  if (regionCount === "auto") {
    regionCount = all.length >= 156 || (all.length >= 100 && variant % 3 === 0) ? 6 : 4;
  }
  const rawSizes = pairedSizes(all.length, regionCount, variant);
  const pairs = [];
  for (let index = 0; index < rawSizes.length; index += 2) pairs.push([rawSizes[index], rawSizes[index + 1]]);
  pairs.sort((a, b) => b[0] - a[0]);
  const sizes = pairs.flat();
  const chunks = partitionMask(new Set(all), sizes, cols, variant);
  if (!chunks) throw new Error(`creative mask ${variant}: cannot partition ${sizes.join("+")}`);
  const canvas = mask.map((row) => row.map(() => "."));
  chunks.forEach((chunk, index) => chunk.forEach((cell) => {
    canvas[Math.floor(cell / cols)][cell % cols] = String.fromCharCode(65 + index);
  }));
  return {
    art: canvas.map((row) => row.join("")),
    beanMapping: Array.from({ length: regionCount }, (_, index) => index % 2 === 0 ? index + 2 : index),
    designedSizes: sizes,
  };
}

function drawTheme(number) {
  const m = createMask();
  switch (number) {
    case 12: ellipse(m,9,13,6,4); triangle(m,[3,13],[0,9],[1,15]); triangle(m,[9,16],[13,20],[8,18]); line(m,12,9,14,5); line(m,14,5,16,7); break;
    case 13: triangle(m,[8,3],[8,15],[2,15]); triangle(m,[9,5],[9,15],[15,15]); triangle(m,[2,16],[15,16],[12,21]); line(m,8,3,8,18,2); break;
    case 14: rect(m,2,10,4,11); rect(m,7,6,4,15); rect(m,12,12,4,9); triangle(m,[7,6],[9,2],[11,6]); rect(m,1,20,16,2); break;
    case 15: line(m,5,5,5,18,3); line(m,5,5,13,3,3); line(m,13,3,13,15,3); ellipse(m,3,19,3,2); ellipse(m,11,16,3,2); break;
    case 16: ellipse(m,9,7,6,5); ellipse(m,5,11,4,4); ellipse(m,13,11,4,4); rect(m,7,11,4,11); triangle(m,[7,17],[2,22],[9,20]); triangle(m,[10,17],[16,22],[9,20]); break;
    case 17: triangle(m,[6,20],[12,20],[10,7]); rect(m,6,5,7,4); triangle(m,[6,5],[9,2],[13,5]); triangle(m,[11,6],[17,3],[17,10]); rect(m,4,20,11,2); break;
    case 18: ellipse(m,9,8,6,7); line(m,5,12,8,19); line(m,13,12,10,19); rect(m,7,18,5,4); break;
    case 19: triangle(m,[9,2],[5,8],[13,8]); rect(m,5,8,9,10); triangle(m,[5,13],[2,19],[6,18]); triangle(m,[13,13],[16,19],[12,18]); triangle(m,[7,18],[11,18],[9,24]); break;
    case 20: ellipse(m,8,5,6,3); ellipse(m,13,7,4,3); rect(m,8,7,5,11); ellipse(m,9,20,7,3); line(m,8,12,4,17,2); break;
    case 21: triangle(m,[9,2],[3,9],[9,16]); triangle(m,[9,2],[15,9],[9,16]); line(m,9,15,6,22,2); triangle(m,[6,18],[3,20],[7,21]); break;
    case 22: ellipse(m,9,11,6,5); triangle(m,[4,11],[0,6],[0,16]); triangle(m,[9,7],[13,3],[13,8]); ellipse(m,13,10,1,1); break;
    case 23: triangle(m,[5,3],[2,8],[8,8]); rect(m,3,8,5,8); line(m,5,15,11,22,3); triangle(m,[13,5],[10,10],[16,10]); rect(m,11,10,5,7); line(m,13,16,10,21,3); break;
    case 24: triangle(m,[1,20],[7,7],[10,20]); triangle(m,[7,20],[13,4],[17,20]); triangle(m,[10,10],[13,4],[15,11]); rect(m,1,20,16,2); break;
    case 25: ellipse(m,9,12,6,6); line(m,1,15,17,9,2); ellipse(m,14,5,2,2); break;
    case 26: rect(m,2,18,5,4); rect(m,6,14,5,8); rect(m,10,10,5,12); ellipse(m,12,7,5,3); line(m,4,18,12,7,2); break;
    case 27: triangle(m,[9,2],[3,10],[15,10]); triangle(m,[3,10],[9,21],[15,10]); ellipse(m,9,11,3,3); break;
    case 28: triangle(m,[5,3],[2,8],[8,8]); rect(m,3,8,5,7); line(m,5,14,12,21,3); triangle(m,[13,8],[10,13],[16,13]); rect(m,11,13,5,6); break;
    case 29: rect(m,4,7,10,12); triangle(m,[4,7],[9,2],[14,7]); rect(m,3,18,12,3); line(m,6,10,12,17,2); line(m,12,10,6,17,2); break;
    case 30: ellipse(m,5,11,4,4); ellipse(m,10,8,5,5); ellipse(m,14,12,3,4); rect(m,3,11,13,5); line(m,5,16,12,21,2); break;
    case 31: triangle(m,[1,19],[7,5],[12,19]); triangle(m,[7,19],[13,8],[17,19]); triangle(m,[4,22],[8,15],[12,22]); rect(m,1,21,16,2); break;
    case 32: ellipse(m,9,13,7,4); rect(m,7,7,5,4); rect(m,9,5,2,4); triangle(m,[3,13],[0,9],[0,17]); line(m,12,10,16,6,2); break;
    case 33: rect(m,3,8,4,13); rect(m,11,8,4,13); rect(m,6,12,6,9); triangle(m,[3,8],[5,3],[7,8]); triangle(m,[11,8],[13,3],[15,8]); rect(m,2,20,14,2); break;
    case 34: rect(m,4,11,10,11); triangle(m,[2,11],[9,4],[16,11]); rect(m,7,15,4,7); rect(m,11,7,2,5); break;
    case 35: ellipse(m,9,12,6,4); ellipse(m,14,7,3,3); line(m,12,9,14,7,3); triangle(m,[4,12],[0,7],[1,15]); rect(m,5,14,3,8); rect(m,11,14,3,8); triangle(m,[5,8],[7,4],[9,9]); triangle(m,[8,8],[10,3],[12,9]); break;
    case 36: ellipse(m,9,15,7,5); ellipse(m,9,10,4,4); rect(m,2,18,15,4); ellipse(m,4,7,2,2); line(m,4,9,7,13,2); break;
    case 37: rect(m,2,11,14,11); triangle(m,[2,11],[6,7],[10,11]); rect(m,12,5,3,8); ellipse(m,5,16,3,3); ellipse(m,12,17,3,3); break;
    case 38: rect(m,3,14,12,8); triangle(m,[3,14],[6,5],[9,14]); triangle(m,[7,14],[10,2],[13,14]); triangle(m,[11,14],[14,7],[16,14]); break;
    case 39: ellipse(m,9,12,7,4); triangle(m,[3,12],[0,8],[0,16]); triangle(m,[8,9],[11,3],[13,10]); rect(m,4,16,11,4); ellipse(m,9,5,3,3); break;
    case 40: triangle(m,[3,3],[15,3],[9,12]); triangle(m,[3,21],[15,21],[9,12]); rect(m,3,2,12,2); rect(m,3,21,12,2); break;
    case 41: triangle(m,[2,8],[8,8],[6,12]); rect(m,4,5,2,4); triangle(m,[9,14],[16,14],[13,19]); rect(m,12,10,2,5); line(m,6,11,13,15,2); break;
    case 42: line(m,3,5,14,19,4); line(m,15,5,4,19,4); ellipse(m,9,12,3,3); triangle(m,[2,4],[6,3],[4,8]); triangle(m,[16,4],[12,3],[14,8]); break;
    case 43: ellipse(m,9,11,3,3); ellipse(m,9,5,3,4); ellipse(m,14,9,4,3); ellipse(m,12,15,3,4); ellipse(m,6,15,3,4); ellipse(m,4,9,4,3); line(m,9,14,9,23,2); break;
    case 44: rect(m,1,14,16,7); rect(m,3,8,3,7); rect(m,8,5,3,10); rect(m,13,10,3,5); line(m,1,22,17,22,2); line(m,2,24,16,24,2); break;
    case 45: rect(m,3,12,12,10); rect(m,7,6,4,16); triangle(m,[6,6],[9,2],[12,6]); triangle(m,[2,12],[5,8],[8,12]); triangle(m,[10,12],[13,8],[16,12]); break;
    case 46: rect(m,3,5,12,15); triangle(m,[3,5],[9,2],[15,5]); ellipse(m,6,21,2,2); ellipse(m,12,21,2,2); rect(m,5,8,3,4); rect(m,10,8,3,4); break;
    case 47: ellipse(m,9,10,6,6); ellipse(m,9,10,2,2); line(m,9,16,9,22,3); triangle(m,[2,22],[9,15],[16,22]); break;
    case 48: rect(m,3,13,12,9); rect(m,6,8,6,6); triangle(m,[4,8],[9,2],[14,8]); rect(m,1,21,16,2); line(m,6,13,6,21,2); line(m,12,13,12,21,2); break;
    case 49: rect(m,3,5,12,16); ellipse(m,9,5,2,2); ellipse(m,15,13,2,2); ellipse(m,3,16,2,2); ellipse(m,9,21,2,2); break;
    case 50: ellipse(m,9,13,6,6); line(m,9,2,9,22,2); line(m,1,13,17,13,2); line(m,3,5,15,21,2); line(m,15,5,3,21,2); triangle(m,[4,22],[9,15],[14,22]); break;
  }
  return m;
}

export function createCreativeLayouts() {
  return Array.from({ length: 39 }, (_, index) => {
    const number = index + 12;
    const layout = number >= 26
      ? carveDenseArtwork(drawTheme(number), number)
      : carveArtwork(drawTheme(number), "auto", number);
    return layout;
  });
}
