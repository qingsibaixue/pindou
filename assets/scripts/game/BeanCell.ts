import {
  _decorator,
  Component,
  Sprite,
  SpriteFrame,
  Color,
  tween,
  Vec3,
} from "cc";

const { ccclass, property } = _decorator;

export enum BeanState {
  Empty,
  Preview,
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
  private _state = BeanState.Empty;

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

  public setup(row: number, col: number, colorId: number, color: Color): void {
    this._row = row;
    this._col = col;
    this._colorId = colorId;

    if (!this.sprite) {
      return;
    }

    this.sprite.color = color;

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

  public fill(): void {
    if (this._state === BeanState.Filled) {
      return;
    }

    this.setState(BeanState.Filled);

    this.node.setScale(0.75, 0.75, 1);

    tween(this.node)
      .to(0.08, {
        scale: new Vec3(1.12, 1.12, 1),
      })
      .to(0.06, {
        scale: Vec3.ONE,
      })
      .start();
  }

  public get beanColor(): Color {
    return this.sprite ? this.sprite.color.clone() : Color.WHITE.clone();
  }

  public getWorldPosition(): Vec3 {
    return this.node.worldPosition.clone();
  }
}
