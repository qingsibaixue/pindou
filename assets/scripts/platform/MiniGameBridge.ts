/**
 * 微信（wx）、抖音（tt）、快手（ks）小游戏的轻量能力桥。
 * 玩法代码只依赖这个文件，平台 SDK 不存在时会静默回退到 Web。
 */
type MiniGameHost = {
  showShareMenu?: (options?: Record<string, unknown>) => void;
  vibrateShort?: (options?: Record<string, unknown>) => void;
};

type MiniGameGlobals = {
  wx?: MiniGameHost;
  tt?: MiniGameHost;
  ks?: MiniGameHost;
};

export type MiniGamePlatform = "wechat" | "douyin" | "kuaishou" | "web";

export class MiniGameBridge {
  private static get globals(): MiniGameGlobals {
    return globalThis as unknown as MiniGameGlobals;
  }

  public static get platform(): MiniGamePlatform {
    if (this.globals.wx) return "wechat";
    if (this.globals.tt) return "douyin";
    if (this.globals.ks) return "kuaishou";
    return "web";
  }

  private static get host(): MiniGameHost | null {
    return this.globals.wx || this.globals.tt || this.globals.ks || null;
  }

  public static initialize(): void {
    try {
      this.host?.showShareMenu?.({ withShareTicket: false });
      console.log(`[MiniGameBridge] platform=${this.platform}`);
    } catch (error) {
      console.warn("[MiniGameBridge] share menu unavailable:", error);
    }
  }

  public static vibrateSuccess(): void {
    this.vibrateLight();
  }

  public static vibrateLight(): void {
    try {
      this.host?.vibrateShort?.({ type: "light" });
    } catch (error) {
      console.warn("[MiniGameBridge] vibration unavailable:", error);
    }
  }
}
