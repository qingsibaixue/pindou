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

import { EMPTY_COLOR, LevelData } from "../data/LevelData";

import { BeanCell, BeanState } from "./BeanCell";

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

  @property(Node)
  beanSpawnPoint: Node | null = null;

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

    if (cell.state === BeanState.Filled) {
      return false;
    }

    cell.fill();

    this._remainingCount--;

    if (this._remainingCount <= 0) {
      this.onLevelComplete();
    }

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

  private flyBeanToCell(cell: BeanCell): void {
    if (!this.flyingBeanPrefab || !this.flyingLayer || !this.beanSpawnPoint) {
      return;
    }

    const flyingNode = instantiate(this.flyingBeanPrefab);

    flyingNode.parent = this.flyingLayer;

    flyingNode.setWorldPosition(this.beanSpawnPoint.worldPosition);

    const flyingBean = flyingNode.getComponent(FlyingBean);

    if (!flyingBean) {
      flyingNode.destroy();
      return;
    }

    flyingBean.setup(cell.beanColor);

    flyingBean.flyTo(cell.getWorldPosition(), () => {
      cell.fill();

      this._remainingCount--;

      if (this._remainingCount <= 0) {
        this.onLevelComplete();
      }
    });
  }
}
