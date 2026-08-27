// assets/scripts/data/LevelData.ts

export const EMPTY_COLOR = -1;

export interface BeanColorData {
  id: number;
  hex: string;
}

export interface BoardCellData {
  targetColorId: number;
  beanColorId: number;
}

export interface LevelData {
  id: string;
  name: string;
  guide?: string;

  rows: number;
  cols: number;

  colors: BeanColorData[];
  cells: BoardCellData[];

  trayCapacity: number;
  trayBeans: number[];
}

// =========================================================
// Board
// =========================================================

export function getCellIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

export function isInsideBoard(
  row: number,
  col: number,
  rows: number,
  cols: number,
): boolean {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

// =========================================================
// Level Build
// =========================================================

export function createCellsFromLayers(
  targetLayer: number[][],
  beanLayer: number[][],
): BoardCellData[] {
  if (targetLayer.length !== beanLayer.length) {
    throw new Error("[LevelData] targetLayer rows != beanLayer rows");
  }

  const result: BoardCellData[] = [];

  for (let row = 0; row < targetLayer.length; row++) {
    if (targetLayer[row].length !== beanLayer[row].length) {
      throw new Error(`[LevelData] row=${row} column count mismatch`);
    }

    for (let col = 0; col < targetLayer[row].length; col++) {
      result.push({
        targetColorId: targetLayer[row][col],

        beanColorId: beanLayer[row][col],
      });
    }
  }

  return result;
}

// =========================================================
// Validation
// =========================================================

export function validateLevelData(level: LevelData): string[] {
  const errors: string[] = [];

  if (!level || typeof level !== "object") {
    return ["关卡数据必须是对象"];
  }

  if (!level.id || typeof level.id !== "string") {
    errors.push("关卡 id 不能为空");
  }

  if (!level.name || typeof level.name !== "string") {
    errors.push("关卡 name 不能为空");
  }

  if (!Number.isInteger(level.rows) || level.rows < 2 || level.rows > 32) {
    errors.push(`rows 必须是 2~32 的整数，当前=${level.rows}`);
  }

  if (!Number.isInteger(level.cols) || level.cols < 2 || level.cols > 32) {
    errors.push(`cols 必须是 2~32 的整数，当前=${level.cols}`);
  }

  if (!Array.isArray(level.colors) || level.colors.length === 0) {
    errors.push("colors 至少需要配置一种颜色");
    return errors;
  }

  if (!Array.isArray(level.cells)) {
    errors.push("cells 必须是数组");
    return errors;
  }

  if (!Array.isArray(level.trayBeans)) {
    errors.push("trayBeans 必须是数组");
    return errors;
  }

  const expectedCellCount = level.rows * level.cols;

  if (level.cells.length !== expectedCellCount) {
    errors.push(
      `棋盘数量错误：期望=${expectedCellCount}，实际=${level.cells.length}`,
    );
  }

  if (
    !Number.isInteger(level.trayCapacity) ||
    level.trayCapacity <= 0 ||
    level.trayCapacity > 20
  ) {
    errors.push(`trayCapacity 必须是 1~20 的整数，当前=${level.trayCapacity}`);
  }

  if (level.trayBeans.length > level.trayCapacity) {
    errors.push(
      `暂存槽棋子超过容量：棋子=${level.trayBeans.length}，容量=${level.trayCapacity}`,
    );
  }

  if (level.trayBeans.length !== 0) {
    errors.push("暂存槽必须空着开局；它只用于玩家临时中转整组豆豆");
  }

  const validColorIds = new Set<number>();

  for (const color of level.colors) {
    if (!color || typeof color !== "object") {
      errors.push("colors 中存在无效配置");
      continue;
    }
    if (!Number.isInteger(color.id) || color.id < 0) {
      errors.push(`颜色 id 必须是非负整数，当前=${color.id}`);
      continue;
    }

    if (validColorIds.has(color.id)) {
      errors.push(`颜色 id 重复：${color.id}`);
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(color.hex)) {
      errors.push(`颜色 ${color.id} 的 hex 无效：${color.hex}`);
    }

    validColorIds.add(color.id);
  }

  const targetCounts = new Map<number, number>();

  const boardBeanCounts = new Map<number, number>();

  const trayBeanCounts = new Map<number, number>();

  // -------------------------
  // Board
  // -------------------------

  for (let i = 0; i < level.cells.length; i++) {
    const cell = level.cells[i];

    if (!cell || typeof cell !== "object") {
      errors.push(`格子 ${i}：数据无效`);
      continue;
    }

    if (!validColorIds.has(cell.targetColorId)) {
      errors.push(`格子 ${i}：targetColorId=${cell.targetColorId} 未配置`);
    }

    targetCounts.set(
      cell.targetColorId,
      (targetCounts.get(cell.targetColorId) ?? 0) + 1,
    );

    if (cell.beanColorId === EMPTY_COLOR) {
      continue;
    }

    if (!validColorIds.has(cell.beanColorId)) {
      errors.push(`格子 ${i}：beanColorId=${cell.beanColorId} 未配置`);
    }

    boardBeanCounts.set(
      cell.beanColorId,
      (boardBeanCounts.get(cell.beanColorId) ?? 0) + 1,
    );
  }

  // -------------------------
  // Tray
  // -------------------------

  for (let i = 0; i < level.trayBeans.length; i++) {
    const colorId = level.trayBeans[i];

    if (!Number.isInteger(colorId)) {
      errors.push(`暂存槽 ${i}：colorId 必须是整数，当前=${colorId}`);
      continue;
    }

    if (colorId === EMPTY_COLOR) {
      continue;
    }

    if (!validColorIds.has(colorId)) {
      errors.push(`暂存槽 ${i}：colorId=${colorId} 未配置`);

      continue;
    }

    trayBeanCounts.set(colorId, (trayBeanCounts.get(colorId) ?? 0) + 1);
  }

  // -------------------------
  // 数量守恒
  // -------------------------

  for (const color of level.colors) {
    const targetCount = targetCounts.get(color.id) ?? 0;

    const boardCount = boardBeanCounts.get(color.id) ?? 0;

    const trayCount = trayBeanCounts.get(color.id) ?? 0;

    const totalBeanCount = boardCount + trayCount;

    if (targetCount !== totalBeanCount) {
      errors.push(
        `颜色 ${color.id} 数量不匹配：目标底=${targetCount}，棋盘棋子=${boardCount}，暂存棋子=${trayCount}，实际总棋子=${totalBeanCount}`,
      );
    }
  }

  return errors;
}

// =========================================================
// Test Level
// =========================================================

export const DEFAULT_COLORS: BeanColorData[] = [
  {
    id: 0,
    hex: "#E8F7F5",
  },
  {
    id: 1,
    hex: "#F45B78",
  },
  {
    id: 2,
    hex: "#FFD65A",
  },
  {
    id: 3,
    hex: "#55A9E8",
  },
];

const DEFAULT_TARGET_LAYER: number[][] = [
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
  [1, 1, 1, 2, 2, 2, 3, 3, 3],
];

const DEFAULT_BEAN_LAYER: number[][] = [
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
  [2, 2, 2, 3, 3, 3, 1, 1, 1],
];

const DEFAULT_TRAY_BEANS: number[] = [];

export const DEFAULT_LEVEL: LevelData = {
  id: "test_level_001",

  name: "Large Group Cycle Test",

  rows: DEFAULT_TARGET_LAYER.length,

  cols: DEFAULT_TARGET_LAYER[0].length,

  colors: DEFAULT_COLORS,

  cells: createCellsFromLayers(DEFAULT_TARGET_LAYER, DEFAULT_BEAN_LAYER),

  trayCapacity: 20,

  trayBeans: DEFAULT_TRAY_BEANS,
};
