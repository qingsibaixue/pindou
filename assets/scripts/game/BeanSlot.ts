import { _decorator, Component, Sprite, Color, Vec3 } from "cc";

const { ccclass, property } = _decorator;

export interface TrayBeanData {
  colorId: number;
  color: Color;
  worldPosition: Vec3;
}

@ccclass("BeanSlot")
export class BeanSlot extends Component {
  @property(Sprite)
  beanSprite: Sprite | null = null;

  private _colorId = -1;
  private _beanColor = Color.WHITE.clone();

  public get hasBean(): boolean {
    return this._colorId >= 0;
  }

  public get colorId(): number {
    return this._colorId;
  }

  public get beanColor(): Color {
    return this._beanColor.clone();
  }

  /**
   * 放入一颗棋子。
   */
  public setBean(colorId: number, color: Color): void {
    this._colorId = colorId;
    this._beanColor = color.clone();

    if (this.beanSprite) {
      this.beanSprite.color = this._beanColor;
      this.beanSprite.node.active = true;
    }
  }

  /**
   * 取出真实棋子。
   *
   * 调用后：
   * - Slot 立即变空
   * - 原棋子立即隐藏
   * - FloatingBean 接管视觉
   */
  public takeBean(): TrayBeanData | null {
    if (!this.hasBean) {
      return null;
    }

    const data: TrayBeanData = {
      colorId: this._colorId,
      color: this._beanColor.clone(),
      worldPosition: this.getTargetWorldPosition(),
    };

    this.clear();

    return data;
  }

  /**
   * Slot 中心的世界坐标。
   *
   * 有棋子时优先取棋子的位置，
   * 空槽时仍然可以作为 FlyingBean 的目标点。
   */
  public getTargetWorldPosition(): Vec3 {
    if (this.beanSprite && this.beanSprite.node.active) {
      return this.beanSprite.node.worldPosition.clone();
    }

    return this.node.worldPosition.clone();
  }

  /**
   * 清空 Slot。
   */
  public clear(): void {
    this._colorId = -1;
    this._beanColor = Color.WHITE.clone();

    if (this.beanSprite) {
      this.beanSprite.node.active = false;
    }
  }
}
