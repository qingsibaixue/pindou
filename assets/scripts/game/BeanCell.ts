import {
  _decorator,
  Component,
  Sprite,
  SpriteFrame,
  Color,
  Vec3,
  tween,
} from "cc";

const { ccclass, property } = _decorator;

export enum BeanState {
  Empty,
  Preview,
  Flying,
  Filled,
}

@ccclass("BeanCell")
export class BeanCell extends Component {
  @property(Sprite)
  sprite: Sprite | null = null;

  @property(SpriteFrame)
  previewSpriteFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  filledSpriteFrame: SpriteFrame | null = null;

  private _row = 0;

  private _col = 0;

  private _colorId = -1;

  private _state: BeanState = BeanState.Empty;

  public get row(): number {
    return this._row;
  }

  public get col(): number {
    return this._col;
  }

  public get colorId(): number {
    return this._colorId;
  }

  public get state(): BeanState {
    return this._state;
  }

  public get beanColor(): Color {
    if (!this.sprite) {
      return Color.WHITE.clone();
    }

    return this.sprite.color.clone();
  }

  public getWorldPosition(): Vec3 {
    return this.node.worldPosition.clone();
  }

  public setup(row: number, col: number, colorId: number, color: Color): void {
    this._row = row;
    this._col = col;
    this._colorId = colorId;

    if (this.sprite) {
      this.sprite.color = color;
    }

    this.setState(BeanState.Preview);
  }

  public setState(state: BeanState): void {
    this._state = state;

    if (!this.sprite) {
      return;
    }

    switch (state) {
      case BeanState.Preview:
        this.sprite.spriteFrame = this.previewSpriteFrame;
        break;

      case BeanState.Filled:
        this.sprite.spriteFrame = this.filledSpriteFrame;
        break;
    }
  }

  /**
   * 开始填充。
   * 用 Flying 状态防止飞行动画期间重复点击。
   */
  public beginFill(): boolean {
    if (this._state !== BeanState.Preview) {
      return false;
    }

    this._state = BeanState.Flying;

    return true;
  }

  /**
   * 飞豆抵达后切换为完成状态。
   */
  public fill(): void {
    if (this._state === BeanState.Filled) {
      return;
    }

    this.setState(BeanState.Filled);

    this.node.setScale(0.8, 0.8, 1);

    tween(this.node)
      .to(0.06, {
        scale: new Vec3(1.15, 1.15, 1),
      })
      .to(0.08, {
        scale: Vec3.ONE,
      })
      .start();
  }

  public cancelFill(): void {
    if (this._state !== BeanState.Flying) {
      return;
    }

    this._state = BeanState.Preview;
  }
}
