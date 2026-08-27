import {
  _decorator,
  Component,
  Sprite,
  SpriteFrame,
  Color,
  Vec3,
  tween,
  Tween,
} from "cc";

import { EMPTY_COLOR, BoardCellData } from "../data/LevelData";

const { ccclass, property } = _decorator;

@ccclass("BeanCell")
export class BeanCell extends Component {
  @property(Sprite)
  baseSprite: Sprite | null = null;

  @property(Sprite)
  beanSprite: Sprite | null = null;

  @property(SpriteFrame)
  baseSpriteFrame: SpriteFrame | null = null;

  @property(SpriteFrame)
  beanSpriteFrame: SpriteFrame | null = null;

  private _row = 0;
  private _col = 0;

  private _targetColorId = EMPTY_COLOR;

  private _beanColorId = EMPTY_COLOR;

  private _beanColor = Color.WHITE.clone();

  public get row(): number {
    return this._row;
  }

  public get col(): number {
    return this._col;
  }

  public get targetColorId(): number {
    return this._targetColorId;
  }

  public get beanColorId(): number {
    return this._beanColorId;
  }

  public get hasBean(): boolean {
    return this._beanColorId !== EMPTY_COLOR;
  }

  public get isMatched(): boolean {
    return this.hasBean && this._beanColorId === this._targetColorId;
  }

  public get isMismatched(): boolean {
    return this.hasBean && this._beanColorId !== this._targetColorId;
  }

  public setup(
    row: number,
    col: number,
    data: BoardCellData,
    targetColor: Color,
    beanColor: Color | null,
  ): void {
    this._row = row;
    this._col = col;

    this._targetColorId = data.targetColorId;

    this._beanColorId = data.beanColorId;

    if (beanColor) {
      this._beanColor = beanColor.clone();
    }

    if (this.baseSprite) {
      this.baseSprite.node.active = true;

      this.baseSprite.spriteFrame = this.baseSpriteFrame;

      this.baseSprite.color = targetColor;
    }

    this.refreshBeanVisual();
  }

  private refreshBeanVisual(): void {
    if (!this.beanSprite) {
      return;
    }

    this.beanSprite.node.active = this.hasBean;

    if (!this.hasBean) {
      return;
    }

    this.beanSprite.spriteFrame = this.beanSpriteFrame;

    this.beanSprite.color = this._beanColor;

    // 换关/重置复用节点时，停掉可能残留的旧脉冲补间
    Tween.stopAllByTarget(this.beanSprite.node);

    this.beanSprite.node.setScale(Vec3.ONE);
  }

  public takeBean(): {
    colorId: number;
    color: Color;
    worldPosition: Vec3;
  } | null {
    if (!this.hasBean) {
      return null;
    }

    const result = {
      colorId: this._beanColorId,

      color: this._beanColor.clone(),

      worldPosition: this.getBeanWorldPosition(),
    };

    this._beanColorId = EMPTY_COLOR;

    if (this.beanSprite) {
      Tween.stopAllByTarget(this.beanSprite.node);
      this.beanSprite.node.setScale(Vec3.ONE);
      this.beanSprite.node.active = false;
    }

    return result;
  }

  public placeBean(
    colorId: number,
    color: Color,
    playAnimation = true,
  ): boolean {
    if (this.hasBean) {
      return false;
    }

    this._beanColorId = colorId;

    this._beanColor = color.clone();

    this.refreshBeanVisual();

    if (playAnimation && this.beanSprite) {
      const node = this.beanSprite.node;

      Tween.stopAllByTarget(node);
      node.setScale(1, 1, 1);

      tween(node)
        .to(
          0.07,
          {
            scale: new Vec3(1.13, 0.9, 1),
          },
          {
            easing: "quadOut",
          },
        )
        .to(
          0.08,
          {
            scale: new Vec3(0.97, 1.07, 1),
          },
          {
            easing: "sineInOut",
          },
        )
        .to(
          0.09,
          {
            scale: Vec3.ONE,
          },
          {
            easing: "quadIn",
          },
        )
        .start();
    }

    return true;
  }

  public canPlaceBean(colorId: number): boolean {
    return !this.hasBean && this._targetColorId === colorId;
  }

  public getBeanWorldPosition(): Vec3 {
    return this.beanSprite
      ? this.beanSprite.node.worldPosition.clone()
      : this.node.worldPosition.clone();
  }

  public getTargetWorldPosition(): Vec3 {
    return this.baseSprite
      ? this.baseSprite.node.worldPosition.clone()
      : this.node.worldPosition.clone();
  }
}
