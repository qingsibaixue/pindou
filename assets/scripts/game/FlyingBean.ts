import { _decorator, Component, Node, Sprite, Color, Vec3, tween } from "cc";

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

  public flyTo(targetWorldPosition: Vec3, onComplete: () => void): void {
    const start = this.node.worldPosition.clone();

    const middle = new Vec3(
      (start.x + targetWorldPosition.x) * 0.5,
      Math.max(start.y, targetWorldPosition.y) + 120,
      start.z,
    );

    tween(this.node)
      .to(
        0.18,
        {
          worldPosition: middle,
          scale: new Vec3(1.12, 1.12, 1),
        },
        {
          easing: "quadOut",
        },
      )
      .to(
        0.14,
        {
          worldPosition: targetWorldPosition,
          scale: Vec3.ONE,
        },
        {
          easing: "quadIn",
        },
      )
      .call(() => {
        onComplete();
        this.node.destroy();
      })
      .start();
  }
}
