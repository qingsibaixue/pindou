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
      return;
    }

    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return;
    }

    const ui = event.getUILocation();

    const local = transform.convertToNodeSpaceAR(new Vec3(ui.x, ui.y, 0));

    const width = transform.contentSize.width;

    const height = transform.contentSize.height;

    const anchorX = transform.anchorPoint.x;

    const anchorY = transform.anchorPoint.y;

    const left = -width * anchorX;

    const right = width * (1 - anchorX);

    const bottom = -height * anchorY;

    const top = height * (1 - anchorY);

    // 只允许 Board 自己范围内的点击
    if (
      local.x < left ||
      local.x > right ||
      local.y < bottom ||
      local.y > top
    ) {
      return;
    }

    this.board.handleClickByLocalPosition(local);
  }
}
