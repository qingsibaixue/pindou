import { _decorator, Component, Sprite, Color, Vec3, tween } from "cc";

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
   */
  public setup(color: Color): void {
    this._beanColor = color.clone();

    if (this.sprite) {
      this.sprite.color = this._beanColor;

      this.sprite.node.active = true;
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
  public flyTo(target: Vec3, onComplete?: () => void): void {
    tween(this.node).stop();

    tween(this.node)
      .to(
        0.18,
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
