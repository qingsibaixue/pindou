import {
  _decorator,
  Component,
  Sprite,
  Color,
  Vec3,
  tween,
  Tween,
  UITransform,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("FlyingBean")
export class FlyingBean extends Component {
  @property(Sprite)
  sprite: Sprite | null = null;

  /**
   * 当前这颗运行时棋子的颜色。
   */
  private _beanColor: Color = Color.WHITE.clone();

  /**
   * 对外提供颜色。
   */
  public get beanColor(): Color {
    return this._beanColor.clone();
  }

  /**
   * 初始化棋子。
   *
   * size：棋子渲染尺寸（宽=高）。
   * 棋盘来源 32，托盘来源 40，保持与来源处视觉一致。
   */
  public setup(color: Color, size = 32): void {
    this._beanColor = color.clone();

    if (this.sprite) {
      this.sprite.color = this._beanColor;

      this.sprite.node.active = true;

      const transform = this.sprite.node.getComponent(UITransform);

      if (transform) {
        transform.setContentSize(size, size);
      }
    }

    this.node.setScale(Vec3.ONE);
  }

  /**
   * 从当前位置飞向目标。
   *
   * targetPosition 必须和当前 FlyingBean
   * 使用同一个父节点本地坐标系。
   *
   * 当前项目里通常就是：
   * FloatingBeanQueue / beanLayer。
   */
  public flyTo(
    target: Vec3,
    onComplete?: () => void,
    delay = 0,
  ): void {
    Tween.stopAllByTarget(this.node);

    tween(this.node)
      .delay(delay)
      .to(
        0.16,
        {
          position: target,
        },
        {
          easing: "quadOut",
        },
      )
      .call(() => {
        console.log("[FlyingBean] arrived");

        onComplete?.();

        this.node.destroy();
      })
      .start();
  }
}
