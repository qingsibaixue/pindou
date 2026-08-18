import { _decorator, Component, Node, Vec3, tween, Tween } from "cc";

const { ccclass, property } = _decorator;

export enum FloatingBeanSourceType {
  Board = "board",
  Tray = "tray",
}

export interface FloatingBeanItem {
  node: Node;
  colorId: number;
  sourceType: FloatingBeanSourceType;

  relativeRow: number;
  relativeCol: number;

  originalLocalPosition: Vec3;

  sourceRow: number;
  sourceCol: number;
}

export interface FloatingBeanGroup {
  colorId: number;
  sourceType: FloatingBeanSourceType;
  items: FloatingBeanItem[];
}

@ccclass("FloatingBeanQueue")
export class FloatingBeanQueue extends Component {
  @property
  floatingOffsetX = -5;

  @property
  floatingOffsetY = 7;

  @property
  liftDuration = 0.08;

  @property
  restoreDuration = 0.08;

  @property
  floatingScale = 1.0;

  /** 悬浮呼吸动画开关 */
  @property
  breathEnabled = true;

  /** 呼吸缩放幅度上限（实际每颗豆在 50%~100% 之间随机） */
  @property
  breathScale = 0.09;

  private _group: FloatingBeanGroup | null = null;

  private _animating = false;

  // =========================================================
  // State
  // =========================================================

  public get hasGroup(): boolean {
    return !!this._group && this._group.items.length > 0;
  }

  public get count(): number {
    return this._group?.items.length ?? 0;
  }

  public get colorId(): number {
    return this._group?.colorId ?? -1;
  }

  public getGroup(): FloatingBeanGroup | null {
    if (!this._group) {
      return null;
    }

    return {
      ...this._group,
      items: [...this._group.items],
    };
  }

  // =========================================================
  // Set
  // =========================================================

  public setGroup(group: FloatingBeanGroup): boolean {
    if (this._animating || this.hasGroup || group.items.length === 0) {
      return false;
    }

    const invalid = group.items.some(
      (item) =>
        item.colorId !== group.colorId || item.sourceType !== group.sourceType,
    );

    if (invalid) {
      return false;
    }

    this._group = {
      ...group,
      items: [...group.items],
    };

    this.playLiftAnimation();

    return true;
  }

  // =========================================================
  // Lift
  // =========================================================

  private playLiftAnimation(): void {
    if (!this._group) {
      return;
    }

    const items = this._group.items;

    if (items.length === 0) {
      return;
    }

    this._animating = true;

    let finished = 0;

    for (const item of items) {
      const target = new Vec3(
        item.originalLocalPosition.x + this.floatingOffsetX,

        item.originalLocalPosition.y + this.floatingOffsetY,

        item.originalLocalPosition.z,
      );

      Tween.stopAllByTarget(item.node);

      tween(item.node)
        .to(
          this.liftDuration,
          {
            position: target,

            scale: new Vec3(this.floatingScale, this.floatingScale, 1),
          },
          {
            easing: "quadOut",
          },
        )
        .call(() => {
          finished++;

          if (finished === items.length) {
            this._animating = false;

            this.startBreathing();
          }
        })
        .start();
    }
  }

  /**
   * 悬浮呼吸动画：
   * 每颗豆的幅度 / 周期 / 起始延迟都带随机，
   * 看起来自然不整齐。
   *
   * 注意：
   * repeatForever 只会重复紧邻的前一个动作，
   * 必须先 union() 把整段合并成一个整体再 repeatForever，
   * 否则播完一遍就"卡住"（之前只呼吸一次的根因）。
   */
  private startBreathing(): void {
    if (!this.breathEnabled || !this._group) {
      return;
    }

    for (const item of this._group.items) {
      const amp = this.breathScale * (0.5 + Math.random() * 0.5);

      const up = new Vec3(1 + amp, 1 + amp, 1);
      const down = new Vec3(1 - amp, 1 - amp, 1);

      const half = 0.45 + Math.random() * 0.45;

      // 每颗豆随机先放大或先缩小，看起来更自然
      const startUp = Math.random() > 0.5;

      tween(item.node)
        .delay(Math.random() * 0.35)
        .to(
          half,
          {
            scale: startUp ? up : down,
          },
          {
            easing: "sineInOut",
          },
        )
        .to(
          half,
          {
            scale: startUp ? down : up,
          },
          {
            easing: "sineInOut",
          },
        )
        .to(
          half,
          {
            scale: Vec3.ONE,
          },
          {
            easing: "sineInOut",
          },
        )
        // 合并整段（含 delay）为一个动作，repeatForever 才能整体循环
        .union()
        .repeatForever()
        .start();
    }
  }

  /** 停掉指定豆节点上的所有补间并复位缩放 */
  private stopItemTweens(items: FloatingBeanItem[]): void {
    for (const item of items) {
      Tween.stopAllByTarget(item.node);
      item.node.setScale(Vec3.ONE);
    }
  }

  // =========================================================
  // Consume
  // =========================================================

  /**
   * 部分取走。
   *
   * Tray 空位不足时：
   * 能放多少就拿多少，
   * 剩余继续悬浮。
   */
  public takeItems(count: number): FloatingBeanItem[] {
    if (!this._group || this._animating || count <= 0) {
      return [];
    }

    const items = this._group.items.splice(
      0,
      Math.min(count, this._group.items.length),
    );

    this.stopItemTweens(items);

    if (this._group.items.length === 0) {
      this._group = null;
    }

    return items;
  }

  /**
   * 整组取走。
   */
  public takeGroup(): FloatingBeanGroup | null {
    if (!this._group || this._animating) {
      return null;
    }

    const group = this._group;

    this._group = null;

    this.stopItemTweens(group.items);

    return group;
  }

  // =========================================================
  // Restore
  // =========================================================

  public restoreVisual(onComplete?: () => void): boolean {
    if (!this._group || this._animating) {
      return false;
    }

    const items = this._group.items;

    if (items.length === 0) {
      return false;
    }

    this._animating = true;

    let finished = 0;

    for (const item of items) {
      Tween.stopAllByTarget(item.node);

      tween(item.node)
        .to(
          this.restoreDuration,
          {
            position: item.originalLocalPosition.clone(),

            scale: Vec3.ONE,
          },
          {
            easing: "quadOut",
          },
        )
        .call(() => {
          finished++;

          if (finished === items.length) {
            this._animating = false;

            onComplete?.();
          }
        })
        .start();
    }

    return true;
  }

  // =========================================================
  // Query
  // =========================================================

  public containsSourcePosition(
    sourceType: FloatingBeanSourceType,

    row: number,
    col: number,
  ): boolean {
    if (!this._group || this._group.sourceType !== sourceType) {
      return false;
    }

    return this._group.items.some(
      (item) => item.sourceRow === row && item.sourceCol === col,
    );
  }

  // =========================================================
  // Release
  // =========================================================

  public releaseGroup(): void {
    // 防御：直接释放时（如换关、取消）也要停掉呼吸等补间，
    // 否则 repeatForever 的补间会挂在已被销毁/复用的节点上报错
    if (this._group) {
      for (const item of this._group.items) {
        Tween.stopAllByTarget(item.node);
      }
    }

    this._group = null;
    this._animating = false;
  }
}
