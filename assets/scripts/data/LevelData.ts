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

  const expectedCellCount = level.rows * level.cols;

  if (level.cells.length !== expectedCellCount) {
    errors.push(
      `棋盘数量错误：期望=${expectedCellCount}，实际=${level.cells.length}`,
    );
  }

  if (level.trayCapacity <= 0) {
    errors.push(`trayCapacity 必须大于0，当前=${level.trayCapacity}`);
  }

  if (level.trayBeans.length > level.trayCapacity) {
    errors.push(
      `暂存槽棋子超过容量：棋子=${level.trayBeans.length}，容量=${level.trayCapacity}`,
    );
  }

  const validColorIds = new Set(level.colors.map((item) => item.id));

  const targetCounts = new Map<number, number>();

  const boardBeanCounts = new Map<number, number>();

  const trayBeanCounts = new Map<number, number>();

  // -------------------------
  // Board
  // -------------------------

  for (let i = 0; i < level.cells.length; i++) {
    const cell = level.cells[i];

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
    hex: "#42C7C7",
  },
  {
    id: 1,
    hex: "#24B83F",
  },
];

const DEFAULT_TARGET_LAYER: number[][] = [
  [1, 1, 1, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 1],

  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0],
];

const DEFAULT_BEAN_LAYER: number[][] = [
  [0, 0, 1, 1, 1, 0, 0, 1, 1],
  [0, 0, 1, 1, -1, 0, 0, 1, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 0],

  [1, 1, 0, 0, 0, 1, 1, 1, 0],
  [1, -1, 0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, -1],
];

const DEFAULT_TRAY_BEANS: number[] = [0, 0, 1];

export const DEFAULT_LEVEL: LevelData = {
  id: "test_level_001",

  name: "Connected Group Test",

  rows: DEFAULT_TARGET_LAYER.length,

  cols: DEFAULT_TARGET_LAYER[0].length,

  colors: DEFAULT_COLORS,

  cells: createCellsFromLayers(DEFAULT_TARGET_LAYER, DEFAULT_BEAN_LAYER),

  trayCapacity: 30,

  trayBeans: DEFAULT_TRAY_BEANS,
};
