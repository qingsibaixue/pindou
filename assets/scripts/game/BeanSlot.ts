import { _decorator, Component, Sprite, Color, Vec3 } from "cc";

const { ccclass, property } = _decorator;

export enum BeanSlotState {
  Empty,
  Occupied,
}

@ccclass("BeanSlot")
export class BeanSlot extends Component {
  /**
   * 槽底图片。
   * 对应你资源里的“暂存_格子.png”。
   *
   * 第一版它只是视觉背景，
   * 后面如果想做空槽高亮、闪烁，可以直接控制它。
   */
  @property(Sprite)
  slotSprite: Sprite | null = null;

  /**
   * 槽位里的拼豆图片。
   * 对应“拼豆_已完成.png”。
   *
   * 真正被染色、隐藏、恢复的都是这个 Sprite。
   */
  @property(Sprite)
  beanSprite: Sprite | null = null;

  /**
   * 当前槽位状态。
   *
   * 默认是 Empty，
   * 等 BeanTray 初始化时再调用 setBean() 填进去。
   */
  private _state: BeanSlotState = BeanSlotState.Empty;

  /**
   * 当前这颗豆的颜色。
   *
   * 保存下来有两个用途：
   * 1. 外部想知道当前槽里是什么颜色。
   * 2. 后面 refill / 动画时可以直接复用。
   */
  private _beanColor: Color = Color.WHITE.clone();

  /**
   * 当前槽位是否有豆。
   */
  public get hasBean(): boolean {
    return this._state === BeanSlotState.Occupied;
  }

  /**
   * 当前槽位状态。
   */
  public get state(): BeanSlotState {
    return this._state;
  }

  /**
   * 当前豆子的颜色。
   *
   * 返回 clone，避免外部直接修改我们的内部 Color 对象。
   */
  public get beanColor(): Color {
    return this._beanColor.clone();
  }

  /**
   * 给这个槽位放入一颗豆。
   *
   * BeanTray 初始化或者 refill 时调用。
   */
  public setBean(color: Color): void {
    this._beanColor = color.clone();

    this._state = BeanSlotState.Occupied;

    if (!this.beanSprite) {
      console.warn(
        `[BeanSlot] beanSprite is missing on node: ${this.node.name}`,
      );

      return;
    }

    // 设置颜色
    this.beanSprite.color = this._beanColor;

    // 确保豆子显示
    this.beanSprite.node.active = true;
  }

  /**
   * 取走一颗豆。
   *
   * 返回值是：
   * “这个豆子当前所在位置的世界坐标”
   *
   * FlyingBean 后面就从这个位置生成。
   */
  public takeBean(): Vec3 | null {
    // 已经没有豆了，不能重复取。
    if (!this.hasBean) {
      return null;
    }

    /**
     * 一定要先保存位置，
     * 再隐藏节点。
     *
     * 因为这个位置就是 FlyingBean 的起点。
     */
    const worldPosition = this.beanSprite
      ? this.beanSprite.node.worldPosition.clone()
      : this.node.worldPosition.clone();

    this._state = BeanSlotState.Empty;

    if (this.beanSprite) {
      this.beanSprite.node.active = false;
    }

    return worldPosition;
  }

  /**
   * 强制清空槽位。
   *
   * 和 takeBean 的区别：
   *
   * takeBean()
   * → 有玩法含义
   * → 会返回起飞坐标
   *
   * clear()
   * → 单纯清空状态
   * → 用于重置、换关卡、编辑器等。
   */
  public clear(): void {
    this._state = BeanSlotState.Empty;

    if (this.beanSprite) {
      this.beanSprite.node.active = false;
    }
  }
}
