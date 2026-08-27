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
  game,
  Game,
  sys,
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
import { DEFAULT_LEVEL, LevelData } from "../data/LevelData";
import { MiniGameBridge } from "../platform/MiniGameBridge";

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
  private _levelTitles = new Map<string, string>();
  private _levelSelectPanel: Node | null = null;
  private _homePanel: Node | null = null;
  private _pausePanel: Node | null = null;
  private _pauseButton: Node | null = null;
  private _guideLabel: Label | null = null;
  private _gameStarted = false;
  private _gameplayEnabled = false;
  private _currentLevelId = "";
  private _winShown = false;

  private static readonly COMPLETED_LEVELS_KEY = "pindou_completed_levels";
  private static readonly LEVELS_PER_PAGE = 8;

  protected onLoad(): void {
    // 关卡加载由本控制器异步驱动，关闭棋盘的默认自动建关
    if (this.beanBoard) {
      this.beanBoard.autoLoadDefaultLevel = false;
    }

    game.on(Game.EVENT_HIDE, this.onApplicationHide, this);
  }

  protected onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onApplicationHide, this);
  }

  protected start(): void {
    MiniGameBridge.initialize();

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

    this.createPauseButton();

    this.createGuideLabel();

    // 扫描 resources/levels/ 下所有 JSON 关卡
    this.discoverLevels();

    // 异步加载关卡 JSON（resources/levels/*.json），
    // 失败时 LevelLoader 内部回退 DEFAULT_LEVEL
    LevelLoader.loadCurrentLevel((level) => {
      if (!this.beanBoard || !this.beanTray) {
        return;
      }

      this.applyLevel(level);
      this.showHomePanel();
    });

    console.log("[GameController] ready");
  }

  private applyLevel(level: LevelData): void {
    if (!this.beanBoard || !this.beanTray) {
      return;
    }

    this.discardFloatingGroup();
    this.beanBoard.loadLevel(level);
    this.beanTray.setupLevel(level);
    this._currentLevelId = level.id;
    this._winShown = false;
    this.refreshGuideForLevel(level);

    console.log(
      `[GameController] level loaded: id=${level.id}, name=${level.name}, ` +
        `${level.rows}x${level.cols}, tray=${level.trayBeans.length}/${level.trayCapacity}`,
    );
  }

  private discardFloatingGroup(): void {
    const group = this.floatingQueue?.getGroup();
    if (group) {
      for (const item of group.items) {
        item.node.destroy();
      }
    }
    this.floatingQueue?.releaseGroup();
    this._busy = false;
  }

  private createGuideLabel(): void {
    const root = this.getLevelSelectRoot();
    if (!root || this._guideLabel) {
      return;
    }
    const node = this.makeLabel("", 19, new Color(55, 105, 91, 255));
    node.name = "LevelGuide";
    node.getComponent(UITransform)?.setContentSize(620, 42);
    node.parent = root;
    node.setPosition(0, -315);
    this._guideLabel = node.getComponent(Label);
  }

  private refreshGuideForLevel(level: LevelData): void {
    if (!this._guideLabel) {
      return;
    }
    if (level.guide) {
      this._guideLabel.string = level.guide;
      return;
    }
    const number = Number(level.id.match(/\d+/)?.[0] ?? 0);
    if (number === 1) {
      this._guideLabel.string = "点一整片错色豆豆，再点下方空托盘";
    } else if (number <= 3) {
      this._guideLabel.string = "先腾出一片空间，再按底色整组换位";
    } else if (number === 10) {
      this._guideLabel.string = "托盘只有20格：大豆群要分两轮完成";
    } else if (number < 10) {
      this._guideLabel.string = `${level.name} · 观察轮廓，整片移动`;
    } else {
      this._guideLabel.string = `${level.name} · 找到颜色循环`;
    }
  }

  private setGuide(text: string): void {
    if (this._guideLabel) {
      this._guideLabel.string = text;
    }
  }

  private onApplicationHide(): void {
    if (this._gameStarted && this._gameplayEnabled && !this._winShown) {
      this.showPausePanel();
    }
  }

  private createPauseButton(): void {
    const root = this.getLevelSelectRoot();
    if (!root || this._pauseButton) {
      return;
    }

    const button = this.makePanelButton("暂 停", () => this.showPausePanel(), true, 112);
    button.name = "PauseButton";
    button.parent = root;
    button.setPosition(230, 570);
    this._pauseButton = button;
    this.refreshPauseButton();
  }

  private refreshPauseButton(): void {
    if (this._pauseButton) {
      this._pauseButton.active = this._gameStarted && this._gameplayEnabled;
    }
  }

  private showHomePanel(): void {
    this._gameStarted = false;
    this._gameplayEnabled = false;
    this.refreshPauseButton();

    if (this._homePanel?.isValid) {
      this._homePanel.destroy();
      this._homePanel = null;
    }

    const root = this.getLevelSelectRoot();
    if (!root) {
      return;
    }

    const mask = this.makeMask("HomeMask", new Color(238, 252, 245, 255));
    if (!mask) {
      return;
    }
    mask.parent = root;

    const title = this.makeLabel("拼豆小世界", 48, new Color(32, 94, 75, 255));
    title.parent = mask;
    title.setPosition(0, 190);

    const subtitle = this.makeLabel("把每一颗彩豆送回正确的位置", 21, new Color(73, 116, 101, 255));
    subtitle.parent = mask;
    subtitle.setPosition(0, 125);

    const startBtn = this.makePanelButton("开始游戏", () => {
      mask.active = false;
      this._gameStarted = true;
      this._gameplayEnabled = true;
      this.refreshPauseButton();
    }, true, 280);
    startBtn.parent = mask;
    startBtn.setPosition(0, 15);

    const levelsBtn = this.makePanelButton("选择关卡", () => {
      mask.active = false;
      this.showLevelSelectPanel();
    }, true, 280);
    levelsBtn.parent = mask;
    levelsBtn.setPosition(0, -55);

    const completed = this.getCompletedLevelIds().size;
    const progress = this.makeLabel(`已完成 ${completed} 关`, 18, new Color(92, 129, 116, 255));
    progress.parent = mask;
    progress.setPosition(0, -135);

    this._homePanel = mask;
  }

  private showPausePanel(): void {
    if (!this._gameStarted || !this._gameplayEnabled || this._busy) {
      return;
    }

    this._gameplayEnabled = false;
    this.refreshPauseButton();

    const root = this.getLevelSelectRoot();
    const mask = this.makeMask("PauseMask");
    if (!root || !mask) {
      return;
    }
    mask.parent = root;

    const panel = this.makeDialogPanel(mask, 420, 420);
    const title = this.makeLabel("游戏暂停", 32, new Color(255, 255, 255, 255));
    title.parent = panel;
    title.setPosition(0, 140);

    const resumeBtn = this.makePanelButton("继续游戏", () => {
      mask.destroy();
      this._pausePanel = null;
      this._gameplayEnabled = true;
      this.refreshPauseButton();
    }, true, 270);
    resumeBtn.parent = panel;
    resumeBtn.setPosition(0, 55);

    const restartBtn = this.makePanelButton("重新开始", () => {
      mask.destroy();
      this._pausePanel = null;
      this.restartCurrentLevel();
      this._gameplayEnabled = true;
      this.refreshPauseButton();
    }, true, 270);
    restartBtn.parent = panel;
    restartBtn.setPosition(0, -10);

    const homeBtn = this.makePanelButton("返回主页", () => {
      mask.destroy();
      this._pausePanel = null;
      this.restartCurrentLevel();
      this.showHomePanel();
    }, true, 270);
    homeBtn.parent = panel;
    homeBtn.setPosition(0, -75);

    this._pausePanel = mask;
  }

  private makeMask(name: string, color = new Color(0, 0, 0, 185)): Node | null {
    const root = this.getLevelSelectRoot();
    if (!root) {
      return null;
    }
    const tf = root.getComponent(UITransform);
    const width = tf?.width ?? 720;
    const height = tf?.height ?? 1280;
    const mask = new Node(name);
    mask.addComponent(UITransform).setContentSize(width, height);
    mask.addComponent(BlockInputEvents);
    const graphics = mask.addComponent(Graphics);
    graphics.fillColor = color;
    graphics.fillRect(-width * 0.5, -height * 0.5, width, height);
    return mask;
  }

  private makeDialogPanel(parent: Node, width: number, height: number): Node {
    const panel = new Node("DialogPanel");
    panel.addComponent(UITransform).setContentSize(width, height);
    panel.parent = parent;
    const graphics = panel.addComponent(Graphics);
    graphics.fillColor = new Color(38, 65, 63, 250);
    graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 24);
    graphics.fill();
    return panel;
  }

  // =========================================================
  // 关卡选择面板
  // =========================================================

  /**
   * 供 Inspector 或代码调用：点“text”按钮时弹出面板。
   */
  public onLevelSelectButtonClicked(): void {
    if (!this._gameStarted || this._busy) {
      return;
    }
    this._gameplayEnabled = false;
    this.refreshPauseButton();
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

    // 窄屏按 fitHeight 裁切时仍保留左右安全边距。
    btnNode.setPosition(-230, btnNode.position.y, btnNode.position.z);

    const btn = btnNode.getComponent(Button);
    const label = btnNode.getComponentInChildren(Label);
    if (label) {
      label.string = "关卡";
    }

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
        const asset = a as JsonAsset;
        ids.add(asset.name);
        const data = asset.json as unknown as Partial<LevelData>;
        this._levelTitles.set(asset.name, data.name || asset.name);
      }
      this._levelIds = Array.from(ids).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
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

  private showLevelSelectPanel(page = -1): void {
    const root = this.getLevelSelectRoot();
    if (!root) {
      console.warn("[GameController] Canvas not found for level select panel");
      return;
    }

    this._levelSelectPanel?.destroy();
    const mask = this.makeMask("LevelSelectMask");
    if (!mask) {
      return;
    }
    mask.parent = root;

    const pageCount = Math.max(
      1,
      Math.ceil(this._levelIds.length / GameController.LEVELS_PER_PAGE),
    );
    const currentIndex = Math.max(0, this._levelIds.indexOf(this._currentLevelId));
    const selectedPage = Math.min(
      pageCount - 1,
      Math.max(
        0,
        page >= 0
          ? page
          : Math.floor(currentIndex / GameController.LEVELS_PER_PAGE),
      ),
    );

    const pw = 500;
    const ph = 760;
    const panel = this.makeDialogPanel(mask, pw, ph);

    const title = this.makeLabel(
      `选择关卡  ${selectedPage + 1}/${pageCount}`,
      30,
      new Color(255, 255, 255, 255),
    );
    title.parent = panel;
    title.setPosition(0, ph * 0.5 - 52);

    const list = new Node("LevelList");
    const listTf = list.addComponent(UITransform);
    listTf.setContentSize(pw - 60, ph - 150);
    list.parent = panel;
    list.setPosition(0, 35);

    const layout = list.addComponent(Layout);
    layout.type = Layout.Type.VERTICAL;
    layout.resizeMode = Layout.ResizeMode.CONTAINER;
    layout.spacingY = 8;

    if (this._levelIds.length === 0) {
      const empty = this.makeLabel("未在 resources/levels/ 发现关卡", 14, new Color(180, 180, 180, 255));
      empty.parent = list;
    } else {
      const completed = this.getCompletedLevelIds();
      const start = selectedPage * GameController.LEVELS_PER_PAGE;
      const end = Math.min(
        this._levelIds.length,
        start + GameController.LEVELS_PER_PAGE,
      );
      for (let index = start; index < end; index++) {
        const id = this._levelIds[index];
        const unlocked = index === 0 || completed.has(this._levelIds[index - 1]);
        const titleText = this._levelTitles.get(id) || id;
        const prefix = completed.has(id) ? "✓" : unlocked ? `${index + 1}.` : "🔒";
        const btn = this.makePanelButton(`${prefix} ${titleText}`, () => {
          this.switchToLevel(id);
          mask.destroy();
          this._levelSelectPanel = null;
          this._homePanel && (this._homePanel.active = false);
          this._gameStarted = true;
          this._gameplayEnabled = true;
          this.refreshPauseButton();
        }, unlocked, 400);
        btn.parent = list;
      }
    }

    layout.updateLayout(true);

    const previousBtn = this.makePanelButton("上一页", () => {
      mask.destroy();
      this._levelSelectPanel = null;
      this.showLevelSelectPanel(selectedPage - 1);
    }, selectedPage > 0, 150);
    previousBtn.parent = panel;
    previousBtn.setPosition(-95, -285);

    const nextBtn = this.makePanelButton("下一页", () => {
      mask.destroy();
      this._levelSelectPanel = null;
      this.showLevelSelectPanel(selectedPage + 1);
    }, selectedPage + 1 < pageCount, 150);
    nextBtn.parent = panel;
    nextBtn.setPosition(95, -285);

    const closeBtn = this.makePanelButton("返 回", () => {
      mask.destroy();
      this._levelSelectPanel = null;
      if (this._gameStarted && !this._winShown) {
        this._gameplayEnabled = true;
        this.refreshPauseButton();
      } else {
        this.showHomePanel();
      }
    }, true, 260);
    closeBtn.parent = panel;
    closeBtn.setPosition(0, -ph * 0.5 + 35);

    this._levelSelectPanel = mask;
  }

  private makePanelButton(
    text: string,
    callback: () => void,
    enabled = true,
    width = 240,
  ): Node {
    const w = width;
    const h = 50;
    const n = new Node("PanelBtn");
    n.addComponent(UITransform).setContentSize(w, h);

    const g = n.addComponent(Graphics);
    g.fillColor = enabled
      ? new Color(70, 174, 137, 255)
      : new Color(91, 105, 101, 255);
    g.roundRect(-w * 0.5, -h * 0.5, w, h, 12);
    g.fill();

    const label = this.makeLabel(text, 18, new Color(255, 255, 255, enabled ? 255 : 170));
    label.parent = n;

    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.96;
    btn.target = n;
    btn.interactable = enabled;

    if (enabled) {
      n.on(Node.EventType.TOUCH_END, callback, this);
    }

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

      this.applyLevel(level);
      LevelLoader.setCurrentLevelId(id);
    });
  }

  // =========================================================
  // Board -> Floating
  // =========================================================

  private handleBoardGroupClick(cells: BeanCell[]): void {
    if (!this._gameplayEnabled || this._busy || cells.length === 0) {
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

    const orderedCells = this.orderBoardCellsForOverflow(cells);
    const colorId = orderedCells[0].beanColorId;

    const minRow = Math.min(...orderedCells.map((cell) => cell.row));

    const minCol = Math.min(...orderedCells.map((cell) => cell.col));

    const items: FloatingBeanItem[] = [];

    for (const cell of orderedCells) {
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

    if (items.length > (this.beanTray?.capacity ?? 20)) {
      this.setGuide(`这片有 ${items.length} 颗，托盘装不完——留下的豆会形成第二轮`);
    } else if (this._currentLevelId === "level_001") {
      this.setGuide(`一次拿起 ${items.length} 颗！点空托盘暂存`);
    }
  }

  /**
   * 豆群大于托盘时，把最后留下的余量排成一个连通组。
   * 这样20颗先落下后，剩余4～5颗仍能一次拿起，形成清晰的第二轮，
   * 不会退化成逐颗清理。
   */
  private orderBoardCellsForOverflow(cells: BeanCell[]): BeanCell[] {
    const capacity = this.beanTray?.capacity ?? 20;
    const remainderCount = cells.length - capacity;
    if (remainderCount <= 0) {
      return cells;
    }

    const byPosition = new Map<string, BeanCell>();
    for (const cell of cells) {
      byPosition.set(`${cell.row}:${cell.col}`, cell);
    }

    // 尝试不同起点，寻找“先落20颗”和“留下余量”两侧都连通的切分。
    // 这比固定从一个角落截取更适合星形、回廊、火箭等手工轮廓。
    const candidates = [...cells].sort(
      (a, b) => b.row - a.row || b.col - a.col,
    );
    for (const seed of candidates) {
      const queue = [seed];
      const reserved: BeanCell[] = [];
      const visited = new Set<string>();

      while (queue.length > 0 && reserved.length < remainderCount) {
        const cell = queue.shift()!;
        const key = `${cell.row}:${cell.col}`;
        if (visited.has(key)) continue;
        visited.add(key);
        reserved.push(cell);
        for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
          const next = byPosition.get(`${cell.row + dr}:${cell.col + dc}`);
          if (next && !visited.has(`${next.row}:${next.col}`)) queue.push(next);
        }
      }

      const reservedSet = new Set(reserved);
      const firstBatch = cells.filter((cell) => !reservedSet.has(cell));
      if (
        reserved.length === remainderCount &&
        this.isConnectedBeanCells(reserved) &&
        this.isConnectedBeanCells(firstBatch)
      ) {
        return [...firstBatch, ...reserved];
      }
    }

    console.warn(`[GameController] no connected overflow split for ${cells.length} beans`);
    return cells;
  }

  private isConnectedBeanCells(cells: BeanCell[]): boolean {
    if (cells.length <= 1) return true;
    const allowed = new Map(cells.map((cell) => [`${cell.row}:${cell.col}`, cell]));
    const queue = [cells[0]];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const cell = queue.shift()!;
      const key = `${cell.row}:${cell.col}`;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
        const next = allowed.get(`${cell.row + dr}:${cell.col + dc}`);
        if (next && !visited.has(`${next.row}:${next.col}`)) queue.push(next);
      }
    }
    return visited.size === cells.length;
  }

  // =========================================================
  // Tray -> Floating
  // =========================================================

  private handleTraySlotClick(slot: BeanSlot): void {
    if (!this._gameplayEnabled || this._busy || !this.beanTray || !this.floatingQueue) {
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
    if (!this._gameplayEnabled || this._busy || !this.floatingQueue?.hasGroup) {
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

      const remaining = this.floatingQueue?.count ?? 0;
      if (remaining > 0) {
        this.setGuide(`托盘已装20颗，还剩 ${remaining} 颗悬浮；换手继续循环`);
      } else if (this._currentLevelId === "level_001") {
        this.setGuide("很好，现在找能填入空白底色的整片豆豆");
      }

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
      }, index * 0.012);
    });
  }

  // =========================================================
  // Floating -> Board
  // =========================================================

  private handleBoardEmptyClick(cell: BeanCell): void {
    if (!this._gameplayEnabled || this._busy || !this.floatingQueue?.hasGroup) {
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

      MiniGameBridge.vibrateLight();
      if (this._currentLevelId === "level_001") {
        this.setGuide("成片落位！继续沿着颜色循环移动");
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
      }, index * 0.012);
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

    // 悬浮棋子渲染尺寸与来源保持一致；大棋盘会自动缩小豆子。
    const boardBeanSize = this.beanBoard?.beanVisualSize ?? 32;
    bean.setup(color, sourceType === FloatingBeanSourceType.Tray ? 40 : boardBeanSize);

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
      this._gameplayEnabled = false;
      this.refreshPauseButton();
      this.markCurrentLevelCompleted();
      MiniGameBridge.vibrateSuccess();

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

    const nextId = this.getNextLevelId();
    const primaryBtn = this.makePanelButton(nextId ? "下一关" : "再来一局", () => {
      mask.destroy();
      nextId ? this.switchToLevel(nextId) : this.restartCurrentLevel();
      this._gameplayEnabled = true;
      this.refreshPauseButton();
    }, true, 250);
    primaryBtn.parent = panel;
    primaryBtn.setPosition(0, -8);

    // 选择关卡：打开关卡列表面板
    const selectBtn = this.makePanelButton("选择关卡", () => {
      mask.destroy();
      this.showLevelSelectPanel();
    }, true, 250);
    selectBtn.parent = panel;
    selectBtn.setPosition(0, -60);
  }

  /**
   * 重置游戏：重新加载当前关卡。
   */
  private restartCurrentLevel(): void {
    this.switchToLevel(this._currentLevelId || LevelLoader.getCurrentLevelId());
  }

  private getCompletedLevelIds(): Set<string> {
    try {
      const value = sys.localStorage.getItem(GameController.COMPLETED_LEVELS_KEY);
      const ids = value ? (JSON.parse(value) as unknown) : [];
      return new Set(
        Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [],
      );
    } catch (error) {
      console.warn("[GameController] read progress failed:", error);
      return new Set<string>();
    }
  }

  private markCurrentLevelCompleted(): void {
    if (!this._currentLevelId) {
      return;
    }
    try {
      const completed = this.getCompletedLevelIds();
      completed.add(this._currentLevelId);
      sys.localStorage.setItem(
        GameController.COMPLETED_LEVELS_KEY,
        JSON.stringify(Array.from(completed)),
      );
    } catch (error) {
      console.warn("[GameController] save progress failed:", error);
    }
  }

  private getNextLevelId(): string | null {
    const index = this._levelIds.indexOf(this._currentLevelId);
    return index >= 0 && index + 1 < this._levelIds.length
      ? this._levelIds[index + 1]
      : null;
  }
}
