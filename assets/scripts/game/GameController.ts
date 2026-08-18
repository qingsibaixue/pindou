import {
  _decorator,
  Component,
  Prefab,
  Node,
  UITransform,
  instantiate,
  Color,
  Vec3,
  Button,
  Label,
  Graphics,
  Layout,
  BlockInputEvents,
  EventHandler,
  director,
  resources,
  JsonAsset,
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

import { LevelLoader } from "../data/LevelLoader";
import { DEFAULT_LEVEL } from "../data/LevelData";

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

  /**
   * 场景里已有的“text”按钮（关卡选择触发按钮）。
   * 不填的话代码会尝试按名字 "Button" 查找。
   */
  @property(Node)
  levelSelectButton: Node | null = null;

  /**
   * 关卡选择面板挂载的根节点，默认 Canvas。
   */
  @property(Node)
  levelSelectRoot: Node | null = null;

  private _busy = false;
  private _levelIds: string[] = [];
  private _levelSelectPanel: Node | null = null;
  private _winShown = false;

  protected onLoad(): void {
    // 关卡加载由本控制器异步驱动，关闭棋盘的默认自动建关
    if (this.beanBoard) {
      this.beanBoard.autoLoadDefaultLevel = false;
    }
  }

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

    // 绑定“text”按钮，点击弹出关卡列表面板
    this.bindLevelSelectButton();

    // 扫描 resources/levels/ 下所有 JSON 关卡
    this.discoverLevels();

    // 异步加载关卡 JSON（resources/levels/*.json），
    // 失败时 LevelLoader 内部回退 DEFAULT_LEVEL
    LevelLoader.loadCurrentLevel((level) => {
      if (!this.beanBoard || !this.beanTray) {
        return;
      }

      this.beanBoard.loadLevel(level);

      this.beanTray.setupLevel(level);

      this._winShown = false;

      console.log(
        `[GameController] level loaded: id=${level.id}, name=${level.name}, ` +
          `${level.rows}x${level.cols}, tray=${level.trayBeans.length}/${level.trayCapacity}`,
      );
    });

    console.log("[GameController] ready");
  }

  // =========================================================
  // 关卡选择面板
  // =========================================================

  /**
   * 供 Inspector 或代码调用：点“text”按钮时弹出面板。
   */
  public onLevelSelectButtonClicked(): void {
    this.showLevelSelectPanel();
  }

  private bindLevelSelectButton(): void {
    let btnNode = this.levelSelectButton;

    if (!btnNode) {
      btnNode = this.node.getChildByName("Button");
    }

    if (!btnNode) {
      return;
    }

    const btn = btnNode.getComponent(Button);

    if (btn) {
      const ev = new EventHandler();
      ev.target = this.node;
      ev.component = "GameController";
      ev.handler = "onLevelSelectButtonClicked";
      btn.clickEvents.push(ev);
    } else {
      btnNode.on(Node.EventType.TOUCH_END, this.onLevelSelectButtonClicked, this);
    }
  }

  private discoverLevels(): void {
    resources.loadDir("levels", JsonAsset, (err, assets) => {
      if (err || !assets) {
        console.warn("[GameController] discover levels failed:", err);
        return;
      }

      const ids = new Set<string>();
      for (const a of assets) {
        ids.add((a as { name: string }).name);
      }
      this._levelIds = Array.from(ids).sort();
      console.log(`[GameController] discovered levels: ${this._levelIds.join(", ")}`);
    });
  }

  private getLevelSelectRoot(): Node | null {
    if (this.levelSelectRoot) {
      return this.levelSelectRoot;
    }

    const scene = director.getScene();
    return scene ? scene.getChildByName("Canvas") : null;
  }

  private showLevelSelectPanel(): void {
    if (this._levelSelectPanel) {
      this._levelSelectPanel.active = true;
      return;
    }

    const root = this.getLevelSelectRoot();
    if (!root) {
      console.warn("[GameController] Canvas not found for level select panel");
      return;
    }

    const canvasTf = root.getComponent(UITransform);
    const cw = canvasTf ? canvasTf.width : 1280;
    const ch = canvasTf ? canvasTf.height : 720;

    // 全屏遮罩（阻断输入）
    const mask = new Node("LevelSelectMask");
    mask.addComponent(UITransform).setContentSize(cw, ch);
    mask.addComponent(BlockInputEvents);
    const maskG = mask.addComponent(Graphics);
    maskG.fillColor = new Color(0, 0, 0, 180);
    maskG.fillRect(-cw * 0.5, -ch * 0.5, cw, ch);
    mask.parent = root;

    // 面板
    const panel = new Node("LevelSelectPanel");
    const pw = 320;
    const ph = 420;
    const pTf = panel.addComponent(UITransform);
    pTf.setContentSize(pw, ph);
    panel.parent = mask;

    const pg = panel.addComponent(Graphics);
    pg.fillColor = new Color(40, 44, 52, 245);
    pg.roundRect(-pw * 0.5, -ph * 0.5, pw, ph, 14);
    pg.fill();

    // 标题
    const title = this.makeLabel("选择关卡", 24, new Color(255, 255, 255, 255));
    title.parent = panel;
    title.setPosition(0, ph * 0.5 - 40);

    // 关卡列表（带 Layout 自动排列）
    const list = new Node("LevelList");
    const listTf = list.addComponent(UITransform);
    listTf.setContentSize(pw - 40, ph - 110);
    list.parent = panel;
    list.setPosition(0, 20);

    const layout = list.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
    layout.spacingY = 8;

    if (this._levelIds.length === 0) {
      const empty = this.makeLabel("未在 resources/levels/ 发现关卡", 14, new Color(180, 180, 180, 255));
      empty.parent = list;
    } else {
      for (const id of this._levelIds) {
        const btn = this.makePanelButton(id, () => {
          this.switchToLevel(id);
          mask.active = false;
        });
        btn.parent = list;
      }
    }

    layout.updateLayout(true);

    // 关闭按钮
    const closeBtn = this.makePanelButton("关 闭", () => {
      mask.active = false;
    });
    closeBtn.parent = panel;
    closeBtn.setPosition(0, -ph * 0.5 + 34);

    this._levelSelectPanel = mask;
  }

  private makePanelButton(text: string, callback: () => void): Node {
    const w = 240;
    const h = 40;
    const n = new Node("PanelBtn");
    n.addComponent(UITransform).setContentSize(w, h);

    const g = n.addComponent(Graphics);
    g.fillColor = new Color(74, 144, 217, 255);
    g.roundRect(-w * 0.5, -h * 0.5, w, h, 8);
    g.fill();

    const label = this.makeLabel(text, 16, new Color(255, 255, 255, 255));
    label.parent = n;

    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.96;
    btn.target = n;

    n.on(Node.EventType.TOUCH_END, callback, this);

    return n;
  }

  private makeLabel(text: string, fontSize: number, color: Color): Node {
    const n = new Node("Label");
    n.addComponent(UITransform).setContentSize(260, 36);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = fontSize;
    l.color = color;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    l.verticalAlign = Label.VerticalAlign.CENTER;
    return n;
  }

  /**
   * 切换到指定关卡（resources/levels/{id}.json）。
   */
  private switchToLevel(id: string): void {
    if (!this.beanBoard || !this.beanTray) {
      return;
    }

    LevelLoader.loadLevelById(id, (level) => {
      if (!level) {
        console.warn(`[GameController] switch to level "${id}" failed`);
        return;
      }

      this.beanBoard!.loadLevel(level);
      this.beanTray!.setupLevel(level);
      LevelLoader.setCurrentLevelId(id);
      this._winShown = false;

      console.log(
        `[GameController] switched to level: id=${level.id}, name=${level.name}, ` +
          `${level.rows}x${level.cols}, tray=${level.trayBeans.length}/${level.trayCapacity}`,
      );
    });
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

    // Board 悬浮中点击托盘：
    // 自动把悬浮棋子放进托盘，
    // 放完后如果点的是有豆的槽位，接续悬浮那颗豆
    if (group.sourceType === FloatingBeanSourceType.Board) {
      const pickColorId = slot.hasBean ? slot.colorId : null;

      this.placeFloatingToTray(pickColorId);

      return;
    }

    // Tray -> Tray：
    // 先收回当前悬浮的托盘豆，
    // 再悬浮刚点的那颗（换手）
    const pickColorId = slot.hasBean ? slot.colorId : null;

    this.cancelCurrentGroup(() => {
      if (pickColorId !== null) {
        this.pickTrayGroupByColor(pickColorId);
      }
    });
  }

  /**
   * 按颜色找到托盘上的第一颗豆并悬浮它的连通组。
   *
   * 用于"放下 / 收回动画结束后的接续悬浮"：
   * 放置和 compact 会让豆子移动位置，
   * 所以不能持有旧槽位引用，而是重新按颜色查找。
   */
  private pickTrayGroupByColor(colorId: number): void {
    if (!this.beanTray || this.floatingQueue?.hasGroup) {
      return;
    }

    const slot = this.beanTray
      .getOccupiedSlots()
      .find((occupied) => occupied.colorId === colorId);

    if (slot) {
      this.pickTrayGroup(slot);
    }
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

  /**
   * 把悬浮的棋盘豆放进托盘。
   *
   * @param pickColorIdAfter 放完后要接续悬浮的托盘豆颜色。
   *                         放置 + compact 会让豆子移动，
   *                         所以这里只传颜色，完成后按颜色重新查找。
   */
  private placeFloatingToTray(pickColorIdAfter: number | null = null): void {
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

      // 托盘满：放不下就直接换手，悬浮点击的那颗豆
      if (pickColorIdAfter !== null) {
        this.pickTrayGroupByColor(pickColorIdAfter);
      }

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

      // 放下动作完成，接续悬浮点击的那颗托盘豆
      if (pickColorIdAfter !== null) {
        this.pickTrayGroupByColor(pickColorIdAfter);
      }

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

    // 悬浮棋子渲染尺寸与来源保持一致：
    // 棋盘 32，托盘 40
    bean.setup(color, sourceType === FloatingBeanSourceType.Tray ? 40 : 32);

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
      if (this._winShown) {
        return;
      }

      this._winShown = true;

      console.log("[GameController] GAME COMPLETE!");

      this.showWinPanel();
    }
  }

  // =========================================================
  // 获胜弹窗
  // =========================================================

  private showWinPanel(): void {
    const root = this.getLevelSelectRoot();

    if (!root) {
      console.warn("[GameController] Canvas not found for win panel");
      return;
    }

    const canvasTf = root.getComponent(UITransform);
    const cw = canvasTf ? canvasTf.width : 1280;
    const ch = canvasTf ? canvasTf.height : 720;

    // 全屏遮罩（阻断输入）
    const mask = new Node("WinMask");
    mask.addComponent(UITransform).setContentSize(cw, ch);
    mask.addComponent(BlockInputEvents);
    const maskG = mask.addComponent(Graphics);
    maskG.fillColor = new Color(0, 0, 0, 180);
    maskG.fillRect(-cw * 0.5, -ch * 0.5, cw, ch);
    mask.parent = root;

    // 面板
    const panel = new Node("WinPanel");
    const pw = 320;
    const ph = 260;
    const pTf = panel.addComponent(UITransform);
    pTf.setContentSize(pw, ph);
    panel.parent = mask;

    const pg = panel.addComponent(Graphics);
    pg.fillColor = new Color(40, 44, 52, 245);
    pg.roundRect(-pw * 0.5, -ph * 0.5, pw, ph, 14);
    pg.fill();

    // 标题
    const title = this.makeLabel("恭喜获胜！", 28, new Color(255, 215, 80, 255));
    title.parent = panel;
    title.setPosition(0, ph * 0.5 - 55);

    // 再来一局：重置当前关卡
    const againBtn = this.makePanelButton("再来一局", () => {
      mask.destroy();
      this.restartCurrentLevel();
    });
    againBtn.parent = panel;
    againBtn.setPosition(0, -8);

    // 选择关卡：打开关卡列表面板
    const selectBtn = this.makePanelButton("选择关卡", () => {
      mask.destroy();
      this.showLevelSelectPanel();
    });
    selectBtn.parent = panel;
    selectBtn.setPosition(0, -60);
  }

  /**
   * 重置游戏：重新加载当前关卡。
   */
  private restartCurrentLevel(): void {
    this.switchToLevel(LevelLoader.getCurrentLevelId());
  }
}
