// assets/scripts/game/BeanBoard.ts

import {
  _decorator,
  Component,
  Prefab,
  instantiate,
  Color,
  UITransform,
  Vec3,
} from "cc";

import {
  EMPTY_COLOR,
  LevelData,
  BoardCellData,
  DEFAULT_LEVEL,
  getCellIndex,
  isInsideBoard,
} from "../data/LevelData";

import { BeanCell } from "./BeanCell";

const { ccclass, property } = _decorator;

/**
 * BeanBoard
 *
 * 职责：
 *
 * 1. 根据 LevelData 创建棋盘。
 * 2. 管理所有 BeanCell。
 * 3. 处理棋盘点击。
 * 4. 查找“可移动的同色连通棋子组”。
 * 5. 查找棋盘空槽。
 *
 *
 * 最重要的规则：
 *
 * 已经匹配正确的棋子：
 *
 * beanColorId === targetColorId
 *
 * 属于完成状态。
 *
 * 它：
 *
 * - 不能被点击悬浮
 * - 不能进入 Flood Fill
 * - 不能被其它同色连通块穿过
 */
@ccclass("BeanBoard")
export class BeanBoard extends Component {
  // =========================================================
  // Inspector
  // =========================================================

  @property(Prefab)
  cellPrefab: Prefab | null = null;

  @property
  cellSize = 40;

  @property
  maxBoardWidth = 600;

  @property
  maxBoardHeight = 600;

  @property
  minCellSize = 18;

  /**
   * start 时是否自动加载内置 DEFAULT_LEVEL。
   *
   * 由 GameController 驱动关卡加载时置为 false，
   * 避免与异步 JSON 加载冲突（双重建关）。
   */
  @property
  autoLoadDefaultLevel = true;

  // =========================================================
  // Runtime
  // =========================================================

  private _level: LevelData | null = null;

  private _preferredCellSize = 40;

  /**
   * index =
   * row * cols + col
   */
  private _cells: Array<BeanCell | null> = [];

  /**
   * 玩家点击一个可移动棋子后：
   *
   * BeanBoard 找到整组同色连通块，
   * 再交给 GameController。
   */
  public onBeanGroupClick: ((cells: BeanCell[]) => void) | null = null;

  /**
   * 点击棋盘空槽。
   *
   * 后续：
   *
   * Floating Group
   * →
   * Board
   */
  public onEmptyCellClick: ((cell: BeanCell) => void) | null = null;

  // =========================================================
  // Lifecycle
  // =========================================================

  protected start(): void {
    if (this.autoLoadDefaultLevel) {
      this.loadLevel(DEFAULT_LEVEL);
    }
  }

  protected onLoad(): void {
    this._preferredCellSize = this.cellSize;
  }

  // =========================================================
  // Level
  // =========================================================

  public loadLevel(level: LevelData): void {
    this.clear();

    this._level = level;

    const expectedCount = level.rows * level.cols;

    if (level.cells.length !== expectedCount) {
      console.error(
        `[BeanBoard] invalid level cells count. expected=${expectedCount}, actual=${level.cells.length}`,
      );

      return;
    }

    // =====================================================
    // Board Size
    // =====================================================

    this.cellSize = Math.max(
      this.minCellSize,
      Math.min(
        this._preferredCellSize,
        Math.floor(this.maxBoardWidth / level.cols),
        Math.floor(this.maxBoardHeight / level.rows),
      ),
    );

    const width = level.cols * this.cellSize;

    const height = level.rows * this.cellSize;

    const transform = this.getComponent(UITransform);

    if (transform) {
      transform.setContentSize(width, height);
    }

    // =====================================================
    // Cell Array
    // =====================================================

    this._cells = new Array(expectedCount).fill(null);

    // =====================================================
    // Build
    // =====================================================

    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        const index = getCellIndex(row, col, level.cols);

        const data = level.cells[index];

        this.createCell(row, col, data);
      }
    }

    console.log(
      `[BeanBoard] level loaded rows=${level.rows}, cols=${level.cols}`,
    );

    console.log(
      `[BeanBoard] beans=${this.getBeanCount()}, mismatched=${this.getMismatchedCount()}`,
    );
  }

  // =========================================================
  // Create Cell
  // =========================================================

  private createCell(row: number, col: number, data: BoardCellData): void {
    if (!this._level || !this.cellPrefab) {
      return;
    }

    const node = instantiate(this.cellPrefab);

    node.parent = this.node;

    const prefabSize = node.getComponent(UITransform)?.width || 40;
    const scale = this.cellSize / prefabSize;
    node.setScale(scale, scale, 1);

    // =====================================================
    // Position
    // =====================================================

    const width = this._level.cols * this.cellSize;

    const height = this._level.rows * this.cellSize;

    const x = (col + 0.5) * this.cellSize - width * 0.5;

    const y = height * 0.5 - (row + 0.5) * this.cellSize;

    node.setPosition(x, y, 0);

    // =====================================================
    // BeanCell
    // =====================================================

    const cell = node.getComponent(BeanCell);

    if (!cell) {
      console.warn(`[BeanBoard] BeanCell missing row=${row}, col=${col}`);

      node.destroy();

      return;
    }

    // =====================================================
    // Colors
    // =====================================================

    const targetColor = this.getColor(data.targetColorId);

    let beanColor: Color | null = null;

    if (data.beanColorId !== EMPTY_COLOR) {
      beanColor = this.getColor(data.beanColorId);
    }

    // =====================================================
    // Setup
    // =====================================================

    cell.setup(row, col, data, targetColor, beanColor);

    const index = getCellIndex(row, col, this._level.cols);

    this._cells[index] = cell;
  }

  // =========================================================
  // Input
  // =========================================================

  /**
   * BeanInput 调用。
   *
   * local：
   * Board 本地坐标。
   */
  public handleClickByLocalPosition(local: Vec3): boolean {
    if (!this._level) {
      return false;
    }

    const width = this._level.cols * this.cellSize;

    const height = this._level.rows * this.cellSize;

    const localX = local.x + width * 0.5;

    const localY = height * 0.5 - local.y;

    const col = Math.floor(localX / this.cellSize);

    const row = Math.floor(localY / this.cellSize);

    return this.handleCellClick(row, col);
  }

  /**
   * 真正的棋盘点击。
   */
  public handleCellClick(row: number, col: number): boolean {
    const cell = this.getCell(row, col);

    if (!cell) {
      return false;
    }

    // =====================================================
    // Empty Cell
    // =====================================================

    if (!cell.hasBean) {
      console.log(
        `[BeanBoard] empty cell click row=${row}, col=${col}, targetColorId=${cell.targetColorId}`,
      );

      this.onEmptyCellClick?.(cell);

      return true;
    }

    // =====================================================
    // Matched Cell
    // =====================================================

    /**
     * 已经完成的棋子：
     *
     * 不能悬浮。
     *
     * 这一条就是这次最重要的修改之一。
     */
    if (cell.isMatched) {
      console.log(
        `[BeanBoard] matched bean locked row=${row}, col=${col}, colorId=${cell.beanColorId}`,
      );

      return false;
    }

    // =====================================================
    // Movable Bean
    // =====================================================

    const group = this.findConnectedBeans(row, col);

    if (group.length <= 0) {
      return false;
    }

    console.log(
      `[BeanBoard] movable bean group click colorId=${cell.beanColorId}, count=${group.length}`,
    );

    this.onBeanGroupClick?.(group);

    return true;
  }

  // =========================================================
  // Flood Fill
  // =========================================================

  /**
   * 查找：
   *
   * 上下左右相邻
   * +
   * beanColorId 相同
   * +
   * 当前棋子还没有匹配底色
   *
   * 的连通块。
   *
   *
   * 非常重要：
   *
   * 已经 matched 的棋子属于“锁死棋子”。
   *
   * 即使它颜色相同，
   * 也不能加入连通块。
   */
  public findConnectedBeans(startRow: number, startCol: number): BeanCell[] {
    if (!this._level) {
      return [];
    }

    const startCell = this.getCell(startRow, startCol);

    if (!startCell || !startCell.hasBean) {
      return [];
    }

    /**
     * 起点已经匹配：
     *
     * 不允许悬浮。
     */
    if (startCell.isMatched) {
      return [];
    }

    const targetBeanColorId = startCell.beanColorId;

    const result: BeanCell[] = [];

    const queue: Array<{
      row: number;
      col: number;
    }> = [
      {
        row: startRow,

        col: startCol,
      },
    ];

    const visited = new Set<number>();

    const directions = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (
        !isInsideBoard(
          current.row,
          current.col,
          this._level.rows,
          this._level.cols,
        )
      ) {
        continue;
      }

      const index = getCellIndex(current.row, current.col, this._level.cols);

      if (visited.has(index)) {
        continue;
      }

      visited.add(index);

      const cell = this._cells[index];

      if (!cell || !cell.hasBean) {
        continue;
      }

      // ===================================================
      // MATCHED = WALL
      // ===================================================

      /**
       * 已经匹配完成的棋子：
       *
       * 不能被拿起来。
       *
       * 而且这里直接 continue，
       * 所以不会继续从它向四周扩散。
       *
       * 它相当于 Flood Fill 的墙。
       */
      if (cell.isMatched) {
        continue;
      }

      // ===================================================
      // Color
      // ===================================================

      if (cell.beanColorId !== targetBeanColorId) {
        continue;
      }

      // ===================================================
      // Add
      // ===================================================

      result.push(cell);

      // ===================================================
      // Expand
      // ===================================================

      for (const direction of directions) {
        queue.push({
          row: current.row + direction[0],

          col: current.col + direction[1],
        });
      }
    }

    return result;
  }

  // =========================================================
  // Query
  // =========================================================

  public getCell(row: number, col: number): BeanCell | null {
    if (!this._level) {
      return null;
    }

    if (!isInsideBoard(row, col, this._level.rows, this._level.cols)) {
      return null;
    }

    const index = getCellIndex(row, col, this._level.cols);

    return this._cells[index] ?? null;
  }

  // =========================================================
  // Board Counts
  // =========================================================

  public getBeanCount(): number {
    let count = 0;

    for (const cell of this._cells) {
      if (cell?.hasBean) {
        count++;
      }
    }

    return count;
  }

  public getMismatchedCount(): number {
    let count = 0;

    for (const cell of this._cells) {
      if (cell?.isMismatched) {
        count++;
      }
    }

    return count;
  }

  public getMatchedCount(): number {
    let count = 0;

    for (const cell of this._cells) {
      if (cell?.isMatched) {
        count++;
      }
    }

    return count;
  }

  /**
   * 关卡是否全部完成。
   *
   * 只要还有错位棋子：
   *
   * false
   */
  public get isCompleted(): boolean {
    return this.getMismatchedCount() === 0;
  }

  // =========================================================
  // Empty Target Query
  // =========================================================

  /**
   * 获取：
   *
   * 当前没有棋子
   * +
   * 底色 == colorId
   *
   * 的所有棋盘空槽。
   */
  public getEmptyCellsByColor(colorId: number): BeanCell[] {
    const result: BeanCell[] = [];

    for (const cell of this._cells) {
      if (!cell) {
        continue;
      }

      if (cell.canPlaceBean(colorId)) {
        result.push(cell);
      }
    }

    return result;
  }

  // =========================================================
  // Color
  // =========================================================

  public getColor(colorId: number): Color {
    if (!this._level) {
      return Color.WHITE.clone();
    }

    const config = this._level.colors.find((item) => item.id === colorId);

    if (!config) {
      console.warn(`[BeanBoard] color config missing id=${colorId}`);

      return Color.WHITE.clone();
    }

    return new Color().fromHEX(config.hex);
  }

  // =========================================================
  // Getter
  // =========================================================

  public get level(): LevelData | null {
    return this._level;
  }

  public get beanVisualSize(): number {
    return this.cellSize * 0.8;
  }

  public get rows(): number {
    return this._level?.rows ?? 0;
  }

  public get cols(): number {
    return this._level?.cols ?? 0;
  }

  // =========================================================
  // Clear
  // =========================================================

  private clear(): void {
    this.node.removeAllChildren();

    this._cells.length = 0;

    this._level = null;
  }
}
