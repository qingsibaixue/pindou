import {
  _decorator,
  Component,
  Prefab,
  instantiate,
  Color,
  Node,
  UITransform,
  Vec3,
} from "cc";

import { FlyingBean } from "./FlyingBean";
import { BeanTray } from "./BeanTray";

import { EMPTY_COLOR, LevelData } from "../data/LevelData";

import { BeanCell } from "./BeanCell";

const { ccclass, property } = _decorator;

const TEST_LEVEL: LevelData = {
  id: "test_001",
  name: "Test",

  rows: 10,
  cols: 10,

  colors: [
    { id: 0, hex: "#42D7D0" },
    { id: 1, hex: "#20C75A" },
  ],

  cells: [
    -1, -1, 0, 0, -1, -1, 0, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0,
    0, -1, -1, -1, 0, 0, 0, 0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0, -1, -1, -1,
    -1, -1, -1, -1, 0, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  ],

  beanCounts: {
    0: 50,
  },
};

@ccclass("BeanBoard")
export class BeanBoard extends Component {
  @property(Prefab)
  cellPrefab: Prefab | null = null;

  @property
  cellSize = 40;

  @property(Prefab)
  flyingBeanPrefab: Prefab | null = null;

  @property(Node)
  flyingLayer: Node | null = null;

  @property(BeanTray)
  beanTray: BeanTray | null = null;

  private _level: LevelData | null = null;

  private _cells: Array<BeanCell | null> = [];

  private _remainingCount = 0;

  protected start(): void {
    this.loadLevel(TEST_LEVEL);
  }

  public loadLevel(level: LevelData): void {
    this.clear();

    this._level = level;

    const width = level.cols * this.cellSize;

    const height = level.rows * this.cellSize;

    const transform = this.getComponent(UITransform);

    transform?.setContentSize(width, height);

    this._cells = new Array(level.rows * level.cols).fill(null);

    this._remainingCount = 0;

    for (let row = 0; row < level.rows; row++) {
      for (let col = 0; col < level.cols; col++) {
        const index = row * level.cols + col;

        const colorId = level.cells[index];

        if (colorId === EMPTY_COLOR) {
          continue;
        }

        this.createCell(row, col, colorId);

        this._remainingCount++;
      }
    }

    console.log(`[BeanBoard] remaining = ${this._remainingCount}`);
  }

  private createCell(row: number, col: number, colorId: number): void {
    if (!this._level || !this.cellPrefab) {
      return;
    }

    const node = instantiate(this.cellPrefab);

    node.parent = this.node;

    const width = this._level.cols * this.cellSize;

    const height = this._level.rows * this.cellSize;

    const x = (col + 0.5) * this.cellSize - width * 0.5;

    const y = height * 0.5 - (row + 0.5) * this.cellSize;

    node.setPosition(x, y, 0);

    const cell = node.getComponent(BeanCell);

    if (!cell) {
      return;
    }

    const config = this._level.colors.find((value) => value.id === colorId);

    const color = config ? new Color().fromHEX(config.hex) : Color.WHITE;

    cell.setup(row, col, colorId, color);

    const index = row * this._level.cols + col;

    this._cells[index] = cell;
  }

  public tryFillByLocalPosition(local: Vec3): boolean {
    if (!this._level) {
      return false;
    }

    const width = this._level.cols * this.cellSize;

    const height = this._level.rows * this.cellSize;

    const localX = local.x + width * 0.5;

    const localY = height * 0.5 - local.y;

    const col = Math.floor(localX / this.cellSize);

    const row = Math.floor(localY / this.cellSize);

    return this.tryFill(row, col);
  }

  public tryFill(row: number, col: number): boolean {
    if (!this._level) {
      return false;
    }

    if (
      row < 0 ||
      row >= this._level.rows ||
      col < 0 ||
      col >= this._level.cols
    ) {
      return false;
    }

    const index = row * this._level.cols + col;

    const cell = this._cells[index];

    if (!cell) {
      return false;
    }

    /**
     * Flying 状态防止玩家
     * 在飞豆期间重复点同一格。
     */
    if (!cell.beginFill()) {
      return false;
    }

    /**
     * 托盘已经空了。
     *
     * 第一版先自动补满。
     * 后面可以换成补豆动画。
     */
    if (this.beanTray && this.beanTray.isEmpty) {
      this.beanTray.refill(cell.beanColor);
    }

    /**
     * 真正开始飞豆。
     */
    const success = this.flyBeanToCell(cell);

    /**
     * 如果托盘或 Prefab
     * 出问题导致没飞成功，
     * 要把 Cell 状态退回去。
     */
    if (!success) {
      cell.cancelFill();

      return false;
    }

    return true;
  }

  /**
   * 从 BeanTray 取一颗真实的豆，
   * 然后让 FlyingBean 从对应槽位飞向目标。
   */
  private flyBeanToCell(cell: BeanCell): boolean {
    if (!this.flyingBeanPrefab || !this.flyingLayer || !this.beanTray) {
      console.warn("[BeanBoard] flying references missing");

      return false;
    }

    /**
     * BeanTray 内部自己决定
     * 到底从哪个 BeanSlot 取。
     *
     * BeanBoard 不需要知道 Slot 细节。
     */
    const spawnWorldPosition = this.beanTray.takeBean();

    if (!spawnWorldPosition) {
      console.warn("[BeanBoard] no bean available in tray");

      return false;
    }

    const flyingNode = instantiate(this.flyingBeanPrefab);

    flyingNode.parent = this.flyingLayer;

    const flyingLayerTransform = this.flyingLayer.getComponent(UITransform);

    if (!flyingLayerTransform) {
      console.warn("[BeanBoard] FlyingLayer needs UITransform");

      flyingNode.destroy();

      return false;
    }

    /**
     * 托盘 Slot 的世界坐标
     * 转 FlyingLayer 本地坐标。
     */
    const startLocal =
      flyingLayerTransform.convertToNodeSpaceAR(spawnWorldPosition);

    /**
     * 目标 BeanCell 世界坐标
     * 转 FlyingLayer 本地坐标。
     */
    const targetLocal = flyingLayerTransform.convertToNodeSpaceAR(
      cell.node.worldPosition,
    );

    flyingNode.setPosition(startLocal);

    const flyingBean = flyingNode.getComponent(FlyingBean);

    if (!flyingBean) {
      console.warn("[BeanBoard] FlyingBean component missing");

      flyingNode.destroy();

      return false;
    }

    /**
     * 飞行豆颜色与目标格一致。
     */
    flyingBean.setup(cell.beanColor);

    flyingBean.flyTo(targetLocal, () => {
      /**
       * 飞豆真正到达后，
       * 目标格才切换 Filled。
       */
      cell.fill();

      this._remainingCount--;

      console.log(`[BeanBoard] remaining = ${this._remainingCount}`);

      if (this._remainingCount <= 0) {
        this.onLevelComplete();
      }
    });

    return true;
  }

  private onLevelComplete(): void {
    console.log("LEVEL COMPLETE!");
  }

  private clear(): void {
    this.node.removeAllChildren();

    this._cells.length = 0;

    this._remainingCount = 0;
  }
}
