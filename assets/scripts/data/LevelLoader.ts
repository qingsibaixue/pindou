// assets/scripts/data/LevelLoader.ts

import { resources, JsonAsset, sys } from "cc";

import { LevelData, DEFAULT_LEVEL, validateLevelData } from "./LevelData";

/**
 * LevelLoader
 *
 * 关卡 JSON 与游戏的连接层。
 *
 * 关卡来源（按优先级）：
 *
 * 1. Cocos sys.localStorage 里指定的关卡 ID（Web/小游戏平台通用）
 *    LevelLoader.setCurrentLevelId("level_002")
 *
 * 2. assets/resources/levels/{id}.json
 *    （关卡编辑器导出的 JSON 直接放到这个目录）
 *
 * 3. assets/resources/levels/level_001.json（默认第一关）
 *
 * 4. 内置 DEFAULT_LEVEL（以上都失败时的兜底）
 */
export class LevelLoader {
  /** resources 下的关卡目录 */
  private static readonly LEVELS_DIR = "levels";

  /** localStorage key：指定要加载的关卡 ID */
  private static readonly LEVEL_ID_KEY = "pindou_level_id";

  /** 未指定关卡 ID 时默认加载的第一关 */
  private static readonly FIRST_LEVEL_ID = "level_001";

  /** 指定下一次要加载的关卡 ID（Web/小游戏平台通用） */
  public static setCurrentLevelId(id: string): void {
    try {
      sys.localStorage.setItem(this.LEVEL_ID_KEY, id);
    } catch (e) {
      console.warn("[LevelLoader] localStorage unavailable:", e);
    }
  }

  public static getCurrentLevelId(): string {
    try {
      return sys.localStorage.getItem(this.LEVEL_ID_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  /**
   * 加载当前应该玩的关卡（异步）。
   *
   * 永远会回调一个可用关卡：
   * resources 里的 JSON -> 校验失败/不存在则回退 DEFAULT_LEVEL。
   */
  public static loadCurrentLevel(onLoaded: (level: LevelData) => void): void {
    const id = this.getCurrentLevelId() || this.FIRST_LEVEL_ID;

    this.loadLevelById(id, (level) => {
      if (level) {
        onLoaded(level);
        return;
      }

      if (id !== this.FIRST_LEVEL_ID) {
        // 指定关卡失败，再尝试第一关
        this.loadLevelById(this.FIRST_LEVEL_ID, (first) => {
          if (first) {
            this.setCurrentLevelId(this.FIRST_LEVEL_ID);
            onLoaded(first);
            return;
          }

          this.setCurrentLevelId(DEFAULT_LEVEL.id);
          onLoaded(DEFAULT_LEVEL);
        });
        return;
      }

      this.setCurrentLevelId(DEFAULT_LEVEL.id);
      onLoaded(DEFAULT_LEVEL);
    });
  }

  /**
   * 按 ID 从 resources/levels/{id} 加载关卡 JSON。
   *
   * 校验失败或资源不存在时回调 null。
   */
  public static loadLevelById(
    id: string,
    onLoaded: (level: LevelData | null) => void,
  ): void {
    const path = `${this.LEVELS_DIR}/${id}`;

    resources.load(path, JsonAsset, (err, asset) => {
      if (err || !asset) {
        console.warn(`[LevelLoader] level "${path}" not found:`, err);
        onLoaded(null);
        return;
      }

      const raw = (asset as JsonAsset).json as unknown as LevelData;

      const errors = validateLevelData(raw);

      if (errors.length > 0) {
        console.error(`[LevelLoader] level "${id}" invalid:\n` + errors.join("\n"));
        onLoaded(null);
        return;
      }

      onLoaded(raw);
    });
  }
}
