import { _decorator, Component, Prefab, instantiate, Vec3, Color } from "cc";

import { BeanSlot } from "./BeanSlot";

const { ccclass, property } = _decorator;

@ccclass("BeanTray")
export class BeanTray extends Component {
  /**
   * BeanSlot.prefab
   */
  @property(Prefab)
  slotPrefab: Prefab | null = null;

  /**
   * 行数
   * 默认 3 行
   */
  @property
  rows = 3;

  /**
   * 列数
   * 默认 10 列
   */
  @property
  cols = 10;

  /**
   * 每个槽位横向占用距离
   */
  @property
  cellWidth = 48;

  /**
   * 每个槽位纵向占用距离
   */
  @property
  cellHeight = 48;

  /**
   * 横向间距
   */
  @property
  gapX = 8;

  /**
   * 纵向间距
   */
  @property
  gapY = 8;

  /**
   * 所有动态生成出来的槽位
   */
  private _slots: BeanSlot[] = [];

  protected start(): void {
    this.buildSlots();

    // 第一版先全部放同一种颜色
    this.refill(new Color().fromHEX("#42D7D0"));
  }

  /**
   * 动态生成整个托盘
   */
  public buildSlots(): void {
    if (!this.slotPrefab) {
      console.warn("[BeanTray] slotPrefab is missing");

      return;
    }

    this.clearSlots();

    const totalWidth = this.cols * this.cellWidth + (this.cols - 1) * this.gapX;

    const totalHeight =
      this.rows * this.cellHeight + (this.rows - 1) * this.gapY;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const node = instantiate(this.slotPrefab);

        node.parent = this.node;

        /**
         * 以 BeanTray 中心为原点排列
         */
        const x =
          col * (this.cellWidth + this.gapX) +
          this.cellWidth * 0.5 -
          totalWidth * 0.5;

        const y =
          totalHeight * 0.5 -
          row * (this.cellHeight + this.gapY) -
          this.cellHeight * 0.5;

        node.setPosition(new Vec3(x, y, 0));

        const slot = node.getComponent(BeanSlot);

        if (!slot) {
          console.warn("[BeanTray] BeanSlot component missing");

          node.destroy();

          continue;
        }

        this._slots.push(slot);
      }
    }

    console.log(`[BeanTray] built ${this._slots.length} slots`);
  }

  /**
   * 从托盘取走一颗豆。
   *
   * 返回该豆子当前的世界坐标，
   * 给 FlyingBean 作为起点。
   */
  public takeBean(): Vec3 | null {
    for (const slot of this._slots) {
      if (!slot.hasBean) {
        continue;
      }

      return slot.takeBean();
    }

    console.warn("[BeanTray] no available bean");

    return null;
  }

  /**
   * 给所有空槽补豆。
   *
   * 第一版统一颜色。
   */
  public refill(color: Color): void {
    for (const slot of this._slots) {
      if (slot.hasBean) {
        continue;
      }

      slot.setBean(color);
    }

    console.log(`[BeanTray] refill, remaining=${this.remaining}`);
  }

  /**
   * 清空所有豆。
   * 但槽位节点继续保留。
   */
  public clearBeans(): void {
    for (const slot of this._slots) {
      slot.clear();
    }
  }

  /**
   * 删除所有动态生成的槽位节点。
   */
  public clearSlots(): void {
    for (const slot of this._slots) {
      slot.node.destroy();
    }

    this._slots.length = 0;
  }

  /**
   * 当前还剩多少颗豆。
   */
  public get remaining(): number {
    let count = 0;

    for (const slot of this._slots) {
      if (slot.hasBean) {
        count++;
      }
    }

    return count;
  }

  /**
   * 托盘总容量。
   */
  public get capacity(): number {
    return this._slots.length;
  }

  /**
   * 是否已经没有豆了。
   */
  public get isEmpty(): boolean {
    return this.remaining <= 0;
  }
}
