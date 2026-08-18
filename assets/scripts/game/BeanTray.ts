import {
  _decorator,
  Component,
  Prefab,
  instantiate,
  Vec3,
  Color,
  Node,
  EventTouch,
  UITransform,
} from "cc";

import { BeanSlot, TrayBeanData } from "./BeanSlot";
import { LevelData, EMPTY_COLOR } from "../data/LevelData";

const { ccclass, property } = _decorator;

@ccclass("BeanTray")
export class BeanTray extends Component {
  @property(Prefab)
  slotPrefab: Prefab | null = null;

  @property rows = 3;
  @property cols = 10;

  @property cellWidth = 48;
  @property cellHeight = 48;

  @property gapX = 8;
  @property gapY = 8;

  public onSlotClick: ((slot: BeanSlot) => void) | null = null;

  public onTrayClick: (() => void) | null = null;

  private _slots: BeanSlot[] = [];
  private _level: LevelData | null = null;

  protected onLoad(): void {
    this.buildSlots();
  }

  protected onEnable(): void {
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  protected onDisable(): void {
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  private onTouchEnd(event: EventTouch): void {
    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return;
    }

    const ui = event.getUILocation();

    const local = transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));

    const size = transform.contentSize;

    const anchor = transform.anchorPoint;

    const left = -size.width * anchor.x;

    const right = size.width * (1 - anchor.x);

    const bottom = -size.height * anchor.y;

    const top = size.height * (1 - anchor.y);

    if (
      local.x < left ||
      local.x > right ||
      local.y < bottom ||
      local.y > top
    ) {
      return;
    }

    // 先检查是否点到具体 Slot：
    // 命中槽位时只派发槽位点击，
    // 让 GameController 决定"放下当前悬浮 + 悬浮这颗"的连贯操作
    for (let i = 0; i < this._slots.length; i++) {
      const slot = this._slots[i];

      const pos = slot.node.position;

      const dx = Math.abs(local.x - pos.x);

      const dy = Math.abs(local.y - pos.y);

      if (dx > this.cellWidth * 0.5 || dy > this.cellHeight * 0.5) {
        continue;
      }

      const row = Math.floor(i / this.cols);

      const col = i % this.cols;

      console.log(
        `[BeanTray] slot click row=${row}, col=${col}, hasBean=${slot.hasBean}, colorId=${slot.colorId}`,
      );

      this.onSlotClick?.(slot);

      return;
    }

    // 没点到 Slot，才算整个 Tray 区域点击
    this.onTrayClick?.();

    console.log("[BeanTray] tray area click");
  }

  public buildSlots(): void {
    if (!this.slotPrefab) {
      console.warn("[BeanTray] slotPrefab missing");

      return;
    }

    this.clearSlots();

    const width = this.cols * this.cellWidth + (this.cols - 1) * this.gapX;

    const height = this.rows * this.cellHeight + (this.rows - 1) * this.gapY;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const node = instantiate(this.slotPrefab);

        node.parent = this.node;

        const x =
          col * (this.cellWidth + this.gapX) +
          this.cellWidth * 0.5 -
          width * 0.5;

        const y =
          height * 0.5 -
          row * (this.cellHeight + this.gapY) -
          this.cellHeight * 0.5;

        node.setPosition(x, y, 0);

        const slot = node.getComponent(BeanSlot);

        if (!slot) {
          node.destroy();
          continue;
        }

        slot.clear();

        this._slots.push(slot);
      }
    }

    console.log(`[BeanTray] built slots=${this._slots.length}`);
  }

  public compactBeansWithReserved(reservedIndexes: Set<number>): void {
    const beans: Array<{
      colorId: number;
      color: Color;
    }> = [];

    for (let i = 0; i < this._slots.length; i++) {
      if (reservedIndexes.has(i)) {
        continue;
      }

      const slot = this._slots[i];

      if (!slot.hasBean) {
        continue;
      }

      beans.push({
        colorId: slot.colorId,
        color: slot.beanColor,
      });
    }

    // 只清非保留位置
    for (let i = 0; i < this._slots.length; i++) {
      if (reservedIndexes.has(i)) {
        continue;
      }

      this._slots[i].clear();
    }

    let beanIndex = 0;

    for (let i = 0; i < this._slots.length; i++) {
      // 悬浮棋子占着这个逻辑位置
      if (reservedIndexes.has(i)) {
        continue;
      }

      if (beanIndex >= beans.length) {
        break;
      }

      const bean = beans[beanIndex++];

      this._slots[i].setBean(bean.colorId, bean.color);
    }

    console.log(
      `[BeanTray] compact reserved=${reservedIndexes.size}, beans=${beans.length}`,
    );
  }

  public setupLevel(level: LevelData): void {
    this._level = level;

    this.clearBeans();

    const count = Math.min(level.trayBeans.length, this.capacity);

    for (let i = 0; i < count; i++) {
      const colorId = level.trayBeans[i];

      if (colorId === EMPTY_COLOR) {
        continue;
      }

      const color = this.getColor(colorId);

      if (color) {
        this._slots[i].setBean(colorId, color);
      }
    }

    console.log(
      `[BeanTray] setup beans=${this.beanCount}, empty=${this.emptyCount}`,
    );
  }

  public getSlot(index: number): BeanSlot | null {
    return this._slots[index] ?? null;
  }

  public getSlotIndex(slot: BeanSlot): number {
    return this._slots.indexOf(slot);
  }

  public getEmptySlots(): BeanSlot[] {
    return this._slots.filter((slot) => !slot.hasBean);
  }

  public getOccupiedSlots(): BeanSlot[] {
    return this._slots.filter((slot) => slot.hasBean);
  }

  /**
   * 真正取出棋子。
   *
   * 注意：
   * 这里只 take，
   * 绝对不 compact。
   */
  public takeBeanFromSlot(slot: BeanSlot): TrayBeanData | null {
    const data = slot.takeBean();

    if (data) {
      console.log(
        `[BeanTray] take slot=${this.getSlotIndex(
          slot,
        )}, color=${data.colorId}`,
      );
    }

    return data;
  }

  /**
   * 真正放入棋子。
   *
   * 注意：
   * 单颗 arrived 时不 compact。
   */
  public placeBeanToSlot(
    slot: BeanSlot,
    colorId: number,
    color: Color,
  ): boolean {
    if (slot.hasBean) {
      return false;
    }

    slot.setBean(colorId, color);

    console.log(
      `[BeanTray] place slot=${this.getSlotIndex(slot)}, color=${colorId}`,
    );

    return true;
  }

  /**
   * 一整批动作结束后统一整理。
   *
   * [豆][空][豆][空]
   * ↓
   * [豆][豆][空][空]
   */
  public compactBeans(): void {
    const beans: Array<{
      colorId: number;
      color: Color;
    }> = [];

    for (const slot of this._slots) {
      if (!slot.hasBean) {
        continue;
      }

      beans.push({
        colorId: slot.colorId,

        color: slot.beanColor,
      });
    }

    for (const slot of this._slots) {
      slot.clear();
    }

    for (let i = 0; i < beans.length; i++) {
      this._slots[i].setBean(beans[i].colorId, beans[i].color);
    }

    console.log(`[BeanTray] compact beans=${beans.length}`);
  }

  public getColor(colorId: number): Color | null {
    const config = this._level?.colors.find((item) => item.id === colorId);

    return config ? new Color().fromHEX(config.hex) : null;
  }

  public clearBeans(): void {
    for (const slot of this._slots) {
      slot.clear();
    }
  }

  private clearSlots(): void {
    for (const slot of this._slots) {
      slot.node.destroy();
    }

    this._slots.length = 0;
  }

  public get capacity(): number {
    return this._slots.length;
  }

  public get beanCount(): number {
    return this._slots.reduce(
      (count, slot) => count + (slot.hasBean ? 1 : 0),
      0,
    );
  }

  public get emptyCount(): number {
    return this.capacity - this.beanCount;
  }

  public get isFull(): boolean {
    return this.capacity > 0 && this.emptyCount === 0;
  }

  public get isEmpty(): boolean {
    return this.beanCount === 0;
  }

  public get isCleared(): boolean {
    return this.isEmpty;
  }
}
