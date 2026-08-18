import {
  _decorator,
  Component,
  Prefab,
  Node,
  UITransform,
  instantiate,
  Color,
  Vec3,
} from "cc";

import { BeanBoard } from "./BeanBoard";
import { BeanCell } from "./BeanCell";
import { BeanTray } from "./BeanTray";
import { BeanSlot } from "./BeanSlot";

import {
  FloatingBeanQueue,
  FloatingBeanItem,
  FloatingBeanSourceType,
} from "./FloatingBeanQueue";

import { FlyingBean } from "./FlyingBean";

const { ccclass, property } = _decorator;

@ccclass("GameController")
export class GameController extends Component {
  @property(BeanBoard)
  beanBoard: BeanBoard | null = null;

  @property(BeanTray)
  beanTray: BeanTray | null = null;

  @property(FloatingBeanQueue)
  floatingQueue: FloatingBeanQueue | null = null;

  @property(Prefab)
  flyingBeanPrefab: Prefab | null = null;

  @property(Node)
  beanLayer: Node | null = null;

  private _busy = false;

  protected start(): void {
    if (
      !this.beanBoard ||
      !this.beanTray ||
      !this.floatingQueue ||
      !this.flyingBeanPrefab ||
      !this.beanLayer
    ) {
      console.error("[GameController] missing refs");
      return;
    }

    this.beanBoard.onBeanGroupClick = this.handleBoardGroupClick.bind(this);

    this.beanBoard.onEmptyCellClick = this.handleBoardEmptyClick.bind(this);

    this.beanTray.onSlotClick = this.handleTraySlotClick.bind(this);

    this.beanTray.onTrayClick = this.handleTrayAreaClick.bind(this);

    if (this.beanLayer.parent) {
      this.beanLayer.setSiblingIndex(this.beanLayer.parent.children.length - 1);
    }

    this.scheduleOnce(() => {
      if (this.beanBoard?.level) {
        this.beanTray?.setupLevel(this.beanBoard.level);
      }
    }, 0);

    console.log("[GameController] ready");
  }

  // =========================================================
  // Board -> Floating
  // =========================================================

  private handleBoardGroupClick(cells: BeanCell[]): void {
    if (this._busy || cells.length === 0) {
      return;
    }

    if (!this.floatingQueue?.hasGroup) {
      this.pickBoardGroup(cells);
      return;
    }

    this.cancelCurrentGroup(() => this.pickBoardGroup(cells));
  }

  private pickBoardGroup(cells: BeanCell[]): void {
    if (!this.beanBoard || !this.floatingQueue || this.floatingQueue.hasGroup) {
      return;
    }

    const colorId = cells[0].beanColorId;

    const minRow = Math.min(...cells.map((cell) => cell.row));

    const minCol = Math.min(...cells.map((cell) => cell.col));

    const items: FloatingBeanItem[] = [];

    for (const cell of cells) {
      const data = cell.takeBean();

      if (!data) {
        continue;
      }

      const item = this.createFloatingItem(
        data.colorId,
        data.color,
        data.worldPosition,
        FloatingBeanSourceType.Board,
        cell.row,
        cell.col,
        cell.row - minRow,
        cell.col - minCol,
      );

      if (!item) {
        cell.placeBean(data.colorId, data.color, false);

        continue;
      }

      items.push(item);
    }

    if (items.length === 0) {
      return;
    }

    const success = this.floatingQueue.setGroup({
      colorId,
      sourceType: FloatingBeanSourceType.Board,
      items,
    });

    if (!success) {
      this.restoreBoardItems(items);
      return;
    }

    console.log(
      `[GameController] board -> floating color=${colorId}, count=${items.length}`,
    );
  }

  // =========================================================
  // Tray -> Floating
  // =========================================================

  private handleTraySlotClick(slot: BeanSlot): void {
    if (this._busy || !this.beanTray || !this.floatingQueue) {
      return;
    }

    const index = this.beanTray.getSlotIndex(slot);

    if (index < 0) {
      return;
    }

    const row = Math.floor(index / this.beanTray.cols);

    const col = index % this.beanTray.cols;

    console.log(
      `[GameController] tray slot row=${row}, col=${col}, hasBean=${slot.hasBean}, color=${slot.colorId}, floating=${this.floatingQueue.hasGroup}`,
    );

    // 没有悬浮组：
    // 点击 Tray 豆 -> 悬浮
    if (!this.floatingQueue.hasGroup) {
      if (slot.hasBean) {
        this.pickTrayGroup(slot);
      }

      return;
    }

    const group = this.floatingQueue.getGroup();

    if (!group) {
      return;
    }

    // Board -> Tray
    // 已经由整个 Tray 区域处理
    if (group.sourceType === FloatingBeanSourceType.Board) {
      return;
    }

    // Tray -> Tray 禁止换位
    // 点 Tray 任意槽都只取消
    console.log(`[GameController] tray floating cancel row=${row}, col=${col}`);

    this.cancelCurrentGroup();
  }

  private pickTrayGroup(clickedSlot: BeanSlot): void {
    if (
      !this.beanTray ||
      !this.floatingQueue ||
      this.floatingQueue.hasGroup ||
      !clickedSlot.hasBean
    ) {
      return;
    }

    const slots = this.findConnectedTrayBeans(clickedSlot);

    console.log(
      `[GameController] tray group color=${clickedSlot.colorId}, count=${slots.length}`,
    );

    if (slots.length === 0) {
      return;
    }

    const indexes = slots.map((slot) => this.beanTray!.getSlotIndex(slot));

    const minRow = Math.min(
      ...indexes.map((index) => Math.floor(index / this.beanTray!.cols)),
    );

    const minCol = Math.min(
      ...indexes.map((index) => index % this.beanTray!.cols),
    );

    const colorId = clickedSlot.colorId;

    const items: FloatingBeanItem[] = [];

    for (const slot of slots) {
      const index = this.beanTray.getSlotIndex(slot);

      const row = Math.floor(index / this.beanTray.cols);

      const col = index % this.beanTray.cols;

      const data = this.beanTray.takeBeanFromSlot(slot);

      if (!data) {
        continue;
      }

      const item = this.createFloatingItem(
        data.colorId,
        data.color,
        data.worldPosition,
        FloatingBeanSourceType.Tray,
        row,
        col,
        row - minRow,
        col - minCol,
      );

      if (!item) {
        slot.setBean(data.colorId, data.color);

        continue;
      }

      items.push(item);
    }

    if (items.length === 0) {
      return;
    }

    const success = this.floatingQueue.setGroup({
      colorId,
      sourceType: FloatingBeanSourceType.Tray,
      items,
    });

    console.log(
      `[GameController] tray -> floating success=${success}, count=${items.length}`,
    );

    if (!success) {
      this.restoreTrayItems(items);
    }
  }

  // =========================================================
  // Board -> Tray
  // =========================================================

  private handleTrayAreaClick(): void {
    if (this._busy || !this.floatingQueue?.hasGroup) {
      return;
    }

    const group = this.floatingQueue.getGroup();

    if (!group || group.sourceType !== FloatingBeanSourceType.Board) {
      return;
    }

    console.log("[GameController] tray area click -> place");

    this.placeFloatingToTray();
  }

  private placeFloatingToTray(): void {
    if (
      !this.beanTray ||
      !this.floatingQueue ||
      !this.beanLayer ||
      !this.floatingQueue.hasGroup
    ) {
      return;
    }

    const group = this.floatingQueue.getGroup();

    if (!group || group.sourceType !== FloatingBeanSourceType.Board) {
      return;
    }

    const emptySlots = this.beanTray.getEmptySlots();

    if (emptySlots.length === 0) {
      console.log("[GameController] tray full");

      return;
    }

    const count = Math.min(emptySlots.length, this.floatingQueue.count);

    const items = this.floatingQueue.takeItems(count);

    if (items.length === 0) {
      return;
    }

    const transform = this.beanLayer.getComponent(UITransform);

    if (!transform) {
      return;
    }

    console.log(
      `[GameController] floating -> tray count=${items.length}, remaining=${this.floatingQueue.count}`,
    );

    this._busy = true;

    let finished = 0;

    const finish = () => {
      finished++;

      if (finished !== items.length) {
        return;
      }

      this.beanTray?.compactBeans();

      this._busy = false;

      this.checkGameComplete();
    };

    items.forEach((item, index) => {
      const target = emptySlots[index];

      const bean = item.node.getComponent(FlyingBean);

      if (!bean) {
        item.node.destroy();
        finish();
        return;
      }

      const targetLocal = transform.convertToNodeSpaceAR(
        target.getTargetWorldPosition(),
      );

      bean.flyTo(targetLocal, () => {
        this.beanTray?.placeBeanToSlot(target, item.colorId, bean.beanColor);

        finish();
      });
    });
  }

  // =========================================================
  // Floating -> Board
  // =========================================================

  private handleBoardEmptyClick(cell: BeanCell): void {
    if (this._busy || !this.floatingQueue?.hasGroup) {
      return;
    }

    const group = this.floatingQueue.getGroup();

    if (!group) {
      return;
    }

    // Board 自己悬浮后点原位置
    // -> 取消
    if (
      group.sourceType === FloatingBeanSourceType.Board &&
      this.floatingQueue.containsSourcePosition(
        FloatingBeanSourceType.Board,
        cell.row,
        cell.col,
      )
    ) {
      this.cancelCurrentGroup();
      return;
    }

    if (!cell.canPlaceBean(group.colorId)) {
      return;
    }

    const targets = this.findConnectedBoardTargets(cell, group.colorId);

    if (targets.length === 0) {
      return;
    }

    const count = Math.min(targets.length, this.floatingQueue.count);

    console.log(
      `[GameController] board place available=${targets.length}, place=${count}, floating=${this.floatingQueue.count}`,
    );

    this.placeFloatingToBoard(targets.slice(0, count));
  }

  private placeFloatingToBoard(targets: BeanCell[]): void {
    if (!this.floatingQueue || !this.beanLayer || targets.length === 0) {
      return;
    }

    const sourceGroup = this.floatingQueue.getGroup();

    if (!sourceGroup) {
      return;
    }

    const items = this.floatingQueue.takeItems(targets.length);

    if (items.length === 0) {
      return;
    }

    const transform = this.beanLayer.getComponent(UITransform);

    if (!transform) {
      return;
    }

    console.log(
      `[GameController] floating -> board count=${items.length}, remaining=${this.floatingQueue.count}`,
    );

    this._busy = true;

    let finished = 0;

    const finish = () => {
      finished++;

      if (finished !== items.length) {
        return;
      }

      if (sourceGroup.sourceType === FloatingBeanSourceType.Tray) {
        if (sourceGroup.sourceType === FloatingBeanSourceType.Tray) {
          const currentGroup = this.floatingQueue?.getGroup();

          if (!currentGroup || this.floatingQueue?.count === 0) {
            // 已经全部离开 Tray
            this.beanTray?.compactBeans();
          } else {
            // 还有 Tray 豆悬浮
            // 它们的位置必须继续视为被占用
            const reserved = new Set<number>();

            for (const item of currentGroup.items) {
              const index =
                item.sourceRow * this.beanTray!.cols + item.sourceCol;

              reserved.add(index);
            }

            this.beanTray?.compactBeansWithReserved(reserved);
          }
        }
      }

      this._busy = false;

      this.checkGameComplete();
    };

    items.forEach((item, index) => {
      const target = targets[index];

      const bean = item.node.getComponent(FlyingBean);

      if (!bean) {
        item.node.destroy();
        finish();
        return;
      }

      const targetLocal = transform.convertToNodeSpaceAR(
        target.getTargetWorldPosition(),
      );

      bean.flyTo(targetLocal, () => {
        target.placeBean(item.colorId, bean.beanColor, true);

        finish();
      });
    });
  }

  // =========================================================
  // Cancel
  // =========================================================

  private cancelCurrentGroup(onComplete?: () => void): void {
    if (this._busy || !this.floatingQueue?.hasGroup) {
      onComplete?.();
      return;
    }

    const group = this.floatingQueue.getGroup();

    if (!group) {
      onComplete?.();
      return;
    }

    // Tray：
    // 直接恢复原槽
    // 不动画
    // 不 compact
    if (group.sourceType === FloatingBeanSourceType.Tray) {
      this.restoreTrayItems(group.items);

      this.floatingQueue.releaseGroup();

      console.log("[GameController] tray floating cancelled");

      onComplete?.();
      return;
    }

    // Board：
    // 保留回落动画
    this._busy = true;

    const started = this.floatingQueue.restoreVisual(() => {
      this.restoreBoardItems(group.items);

      this.floatingQueue?.releaseGroup();

      this._busy = false;

      console.log("[GameController] board floating cancelled");

      onComplete?.();
    });

    if (!started) {
      this.restoreBoardItems(group.items);

      this.floatingQueue.releaseGroup();

      this._busy = false;

      onComplete?.();
    }
  }

  // =========================================================
  // Restore
  // =========================================================

  private restoreBoardItems(items: FloatingBeanItem[]): void {
    for (const item of items) {
      const cell = this.beanBoard?.getCell(item.sourceRow, item.sourceCol);

      const bean = item.node.getComponent(FlyingBean);

      if (cell && bean) {
        cell.placeBean(item.colorId, bean.beanColor, false);
      }

      item.node.destroy();
    }
  }

  private restoreTrayItems(items: FloatingBeanItem[]): void {
    if (!this.beanTray) {
      for (const item of items) {
        item.node.destroy();
      }

      return;
    }

    const emptySlots = this.beanTray.getEmptySlots();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const bean = item.node.getComponent(FlyingBean);

      const slot = emptySlots[i];

      if (slot && bean) {
        slot.setBean(item.colorId, bean.beanColor);
      }

      item.node.destroy();
    }

    this.beanTray.compactBeans();

    console.log(`[GameController] tray restore count=${items.length}`);
  }

  // =========================================================
  // Floating Item
  // =========================================================

  private createFloatingItem(
    colorId: number,
    color: Color,
    worldPosition: Vec3,
    sourceType: FloatingBeanSourceType,
    sourceRow: number,
    sourceCol: number,
    relativeRow: number,
    relativeCol: number,
  ): FloatingBeanItem | null {
    if (!this.beanLayer || !this.flyingBeanPrefab) {
      return null;
    }

    const transform = this.beanLayer.getComponent(UITransform);

    if (!transform) {
      return null;
    }

    const node = instantiate(this.flyingBeanPrefab);

    node.parent = this.beanLayer;

    const local = transform.convertToNodeSpaceAR(worldPosition);

    node.setPosition(local);

    const bean = node.getComponent(FlyingBean);

    if (!bean) {
      node.destroy();
      return null;
    }

    bean.setup(color);

    return {
      node,
      colorId,
      sourceType,
      sourceRow,
      sourceCol,
      relativeRow,
      relativeCol,
      originalLocalPosition: local.clone(),
    };
  }

  // =========================================================
  // Tray Search
  // =========================================================

  private findConnectedTrayBeans(start: BeanSlot): BeanSlot[] {
    if (!this.beanTray || !start.hasBean) {
      return [];
    }

    const startIndex = this.beanTray.getSlotIndex(start);

    if (startIndex < 0) {
      return [];
    }

    const colorId = start.colorId;

    const queue = [
      {
        row: Math.floor(startIndex / this.beanTray.cols),
        col: startIndex % this.beanTray.cols,
      },
    ];

    const visited = new Set<string>();

    const result: BeanSlot[] = [];

    while (queue.length) {
      const current = queue.shift()!;

      const key = `${current.row}:${current.col}`;

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);

      const slot = this.getTraySlot(current.row, current.col);

      if (!slot || !slot.hasBean || slot.colorId !== colorId) {
        continue;
      }

      result.push(slot);

      queue.push(
        {
          row: current.row - 1,
          col: current.col,
        },
        {
          row: current.row + 1,
          col: current.col,
        },
        {
          row: current.row,
          col: current.col - 1,
        },
        {
          row: current.row,
          col: current.col + 1,
        },
      );
    }

    return result;
  }

  // =========================================================
  // Board Search
  // =========================================================

  private findConnectedBoardTargets(
    start: BeanCell,
    colorId: number,
  ): BeanCell[] {
    if (!this.beanBoard) {
      return [];
    }

    const queue = [
      {
        row: start.row,
        col: start.col,
      },
    ];

    const visited = new Set<string>();

    const result: BeanCell[] = [];

    while (queue.length) {
      const current = queue.shift()!;

      const key = `${current.row}:${current.col}`;

      if (visited.has(key)) {
        continue;
      }

      visited.add(key);

      const cell = this.beanBoard.getCell(current.row, current.col);

      if (!cell || !cell.canPlaceBean(colorId)) {
        continue;
      }

      result.push(cell);

      queue.push(
        {
          row: current.row - 1,
          col: current.col,
        },
        {
          row: current.row + 1,
          col: current.col,
        },
        {
          row: current.row,
          col: current.col - 1,
        },
        {
          row: current.row,
          col: current.col + 1,
        },
      );
    }

    return result;
  }

  private getTraySlot(row: number, col: number): BeanSlot | null {
    if (
      !this.beanTray ||
      row < 0 ||
      row >= this.beanTray.rows ||
      col < 0 ||
      col >= this.beanTray.cols
    ) {
      return null;
    }

    return this.beanTray.getSlot(row * this.beanTray.cols + col);
  }

  // =========================================================
  // Complete
  // =========================================================

  private checkGameComplete(): void {
    if (!this.beanBoard || !this.beanTray || !this.floatingQueue) {
      return;
    }

    if (
      this.beanBoard.isCompleted &&
      this.beanTray.isCleared &&
      !this.floatingQueue.hasGroup
    ) {
      console.log("[GameController] GAME COMPLETE!");
    }
  }
}
