import { _decorator, Component, Node, Vec3, tween } from "cc";

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
  floatingScale = 1.04;

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

      tween(item.node).stop();

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
          }
        })
        .start();
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
      tween(item.node).stop();

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
    this._group = null;
    this._animating = false;
  }
}
