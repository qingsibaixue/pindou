import { _decorator, Component, Sprite, Color, Vec3, tween } from "cc";

const { ccclass, property } = _decorator;

@ccclass("FlyingBean")
export class FlyingBean extends Component {
  @property(Sprite)
  sprite: Sprite | null = null;

  public setup(color: Color): void {
    if (this.sprite) {
      this.sprite.color = color;
    }
  }

  /**
   * 注意：
   * 这里传入的 targetPosition 是 FlyingLayer 下的“本地坐标”
   * 不再使用 worldPosition 做 tween。
   */
  public flyTo(targetPosition: Vec3, onComplete: () => void): void {
    const start = this.node.position.clone();

    console.log("[FlyingBean] local start:", start, "target:", targetPosition);

    // 先明显抬起来
    const liftPoint = new Vec3(start.x, start.y + 80, 0);

    // 中间形成弧线
    const arcPoint = new Vec3(
      (start.x + targetPosition.x) * 0.5,
      Math.max(start.y, targetPosition.y) + 160,
      0,
    );

    this.node.setScale(0.8, 0.8, 1);

    tween(this.node)
      .to(
        0.12,
        {
          position: liftPoint,
          scale: new Vec3(1.1, 1.1, 1),
        },
        {
          easing: "quadOut",
        },
      )
      .to(
        0.25,
        {
          position: arcPoint,
        },
        {
          easing: "sineOut",
        },
      )
      .to(
        0.22,
        {
          position: targetPosition.clone(),
          scale: Vec3.ONE,
        },
        {
          easing: "quadIn",
        },
      )
      .call(() => {
        console.log("[FlyingBean] arrived");

        onComplete();

        this.node.destroy();
      })
      .start();
  }
}
