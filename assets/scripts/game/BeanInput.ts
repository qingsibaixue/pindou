import { _decorator, Component, EventTouch, Node, UITransform, Vec3 } from "cc";

import { BeanBoard } from "./BeanBoard";

const { ccclass, property } = _decorator;

@ccclass("BeanInput")
export class BeanInput extends Component {
  @property(BeanBoard)
  board: BeanBoard | null = null;

  protected onEnable(): void {
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  protected onDisable(): void {
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.board) {
      console.warn("[BeanInput] BeanBoard is not bound in Inspector.");
      return;
    }

    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      console.warn("[BeanInput] UITransform is missing.");
      return;
    }

    const uiLocation = event.getUILocation();

    const local = transform.convertToNodeSpaceAR(
      new Vec3(uiLocation.x, uiLocation.y, 0),
    );

    console.log(
      `[BeanInput] click local=(${local.x.toFixed(1)}, ${local.y.toFixed(1)})`,
    );

    this.board.tryFillByLocalPosition(local);
  }
}
