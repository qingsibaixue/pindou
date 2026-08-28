import { sys } from "cc";

export type GameLanguage = "zh" | "en";

const UI_TEXT: Record<GameLanguage, Record<string, string>> = {
  zh: {
    gameTitle: "拼豆小世界",
    subtitle: "把每一颗彩豆送回正确的位置",
    start: "开始游戏",
    levels: "选择关卡",
    levelButton: "关卡",
    pause: "暂 停",
    steps: "步数 {count}",
    progress: "当前第 {current} 关 · 已完成 {completed} 关",
    paused: "游戏暂停",
    resume: "继续游戏",
    restart: "重新开始",
    home: "返回主页",
    selectTitle: "选择关卡",
    page: "第 {current} / {total} 页",
    noLevels: "没有找到关卡",
    previous: "上一页",
    next: "下一页",
    back: "返 回",
    locked: "未解锁",
    current: "当前",
    completed: "已完成",
    challenge: "可挑战",
    picked: "一次拿起 {count} 颗！点空托盘暂存",
    tutorialSpace: "很好，现在找能填入空白底色的整片豆豆",
    tutorialPlaced: "成片落位！继续沿着颜色循环移动",
    win: "恭喜获胜！",
    levelSteps: "本关步数 {count}",
    nextLevel: "下一关",
    replay: "再来一局",
    fallbackGuide1: "点一整片错色豆豆，再点下方空托盘",
    fallbackGuide2: "先腾出一片空间，再按底色整组换位",
    fallbackGuideShape: "{name} · 观察轮廓，整片移动",
    fallbackGuideCycle: "{name} · 找到颜色循环",
    switchLanguage: "English",
  },
  en: {
    gameTitle: "Beadscape",
    subtitle: "Move each colorful group back to its matching space",
    start: "Play",
    levels: "Select Level",
    levelButton: "Levels",
    pause: "Pause",
    steps: "Moves {count}",
    progress: "Level {current} · {completed} completed",
    paused: "Paused",
    resume: "Resume",
    restart: "Restart",
    home: "Home",
    selectTitle: "Select Level",
    page: "Page {current} / {total}",
    noLevels: "No levels found",
    previous: "Previous",
    next: "Next",
    back: "Back",
    locked: "Locked",
    current: "Current",
    completed: "Done",
    challenge: "Play",
    picked: "Lifted {count} beads! Tap the empty tray",
    tutorialSpace: "Great! Now find a full group that fits the open color",
    tutorialPlaced: "Perfect drop! Keep following the color cycle",
    win: "Puzzle Complete!",
    levelSteps: "Moves {count}",
    nextLevel: "Next Level",
    replay: "Play Again",
    fallbackGuide1: "Lift one whole mismatched group, then tap the tray",
    fallbackGuide2: "Open some space, then move groups onto matching colors",
    fallbackGuideShape: "{name} · Read the shape and move the whole group",
    fallbackGuideCycle: "{name} · Find the color cycle",
    switchLanguage: "中文",
  },
};

const LEVEL_TITLES_EN = [
  "First Heart", "Spring Blossom", "Ocean Fish", "Wishing Star", "Brave Rocket",
  "Dreamy Cat", "Birthday Cake", "Rainbow Butterfly", "Shining Crown", "Four-Color Loop",
  "Candy Train", "Whale Song", "Set Sail", "Neon City", "Rhythm Rush",
  "Towering Tree", "Lighthouse Watch", "Hot Air Journey", "Rocket Launch", "Waterfall Lagoon",
  "Rainbow Kite", "Bubble Fish", "Twin Flight", "Gem Valley", "Planet Orbit",
  "Cloud Stairway", "Jewel Showcase", "Rocket Relay", "Lantern Street", "Colorful Clouds",
  "Snowy Camp", "Deep-Sea Submarine", "Desert Castle", "Forest Cabin", "Ancient Dinosaur",
  "Moon Base", "Steam Workshop", "Aurora Palace", "Sky Whale Island", "Time Hourglass",
  "Starfleet", "Twin Dragons", "Four Seasons", "Ocean City", "Magic Academy",
  "Galaxy Train", "Sky Park", "Guardian Temple", "World Mosaic", "Grand Celebration",
];

const LEVEL_GUIDES_EN = [
  "Lift one whole mismatched group first",
  "Rotate the petals as complete groups",
  "Swim the whole fish body back to its color",
  "Follow the star points to find the swap order",
  "Start by reading the rocket tip",
  "A color cycle is hiding inside the cat",
  "Move the cake one full layer at a time",
  "Alternate the left and right wings",
  "Read the colors at the crown tips first",
  "Follow the turns around the four-color loop",
  "Move the candy cars along the winding track",
  "Relay the whale colors like rolling waves",
  "Clear one sail before completing the hull",
  "Use the skyline heights to read the color flow",
  "Drop each note as one group, in rhythm",
  "Grow from the crown down to the roots",
  "Light the tower from the lamp room to the rocks",
  "Rise from the basket all the way to the balloon",
  "Complete the launch from flame to nose cone",
  "Let the water fall from cloud to lagoon",
  "Pass the five kites along the arc",
  "Move the fish at different beats, never one bead at a time",
  "Relay the two flights in opposite directions",
  "Build the peaks before filling the valley",
  "Follow the orbit to read the five-color cycle",
  "Mind the landing where the stairs turn",
  "Clear the upper jewels to make room below",
  "Relay the rockets diagonally in two batches",
  "Move each lantern whole and light the street",
  "Flow the five clouds between upper and lower layers",
  "Read three layers from summit to camp",
  "The submarine lanes travel in opposite directions",
  "Rebuild the castle blocks like steps",
  "The roof and foundation follow different rhythms",
  "Trace the uneven color groups from spine to tail",
  "Expand the base from the center toward both wings",
  "Relay along the bends of the steam pipes",
  "Complete the central aurora spire first",
  "Float the whale island along two wave rows",
  "Wide ends and a narrow center reveal the hourglass",
  "Move the fleet as two coordinated columns",
  "Two three-color cycles orbit the center pearl",
  "The upper and lower gardens are separate cycles",
  "Light the whole city one color district at a time",
  "Complete the academy's central tower first",
  "The upper and lower trains run opposite ways",
  "Complete the six-color ring around the sky park",
  "Drop colors from the temple roof to its base",
  "Find separate cycles in the upper and lower mosaic",
  "Finale: discover the paired color relationships",
];

export class Localization {
  private static readonly STORAGE_KEY = "pindou_language";
  private static _language: GameLanguage | null = null;

  public static get language(): GameLanguage {
    if (!this._language) this._language = this.loadLanguage();
    return this._language;
  }

  public static get isEnglish(): boolean {
    return this.language === "en";
  }

  public static toggle(): GameLanguage {
    this.setLanguage(this.isEnglish ? "zh" : "en");
    return this.language;
  }

  public static setLanguage(language: GameLanguage): void {
    this._language = language;
    try {
      sys.localStorage.setItem(this.STORAGE_KEY, language);
    } catch (error) {
      console.warn("[Localization] language preference could not be saved:", error);
    }
  }

  public static t(key: string, values: Record<string, string | number> = {}): string {
    const template = UI_TEXT[this.language][key] ?? UI_TEXT.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
  }

  public static levelTitle(id: string, fallback: string): string {
    if (!this.isEnglish) return fallback;
    const index = this.levelIndex(id);
    return index >= 0 ? LEVEL_TITLES_EN[index] ?? fallback : fallback;
  }

  public static levelGuide(id: string, fallback = ""): string {
    if (!this.isEnglish) return fallback;
    const index = this.levelIndex(id);
    return index >= 0 ? LEVEL_GUIDES_EN[index] ?? fallback : fallback;
  }

  private static levelIndex(id: string): number {
    return Number(id.match(/\d+/)?.[0] ?? 0) - 1;
  }

  private static loadLanguage(): GameLanguage {
    try {
      const saved = sys.localStorage.getItem(this.STORAGE_KEY);
      if (saved === "zh" || saved === "en") return saved;
    } catch (error) {
      console.warn("[Localization] language preference could not be read:", error);
    }

    const info = sys as unknown as { languageCode?: string; language?: string };
    const browserLanguage = String(info.languageCode || info.language || "en").toLowerCase();
    return browserLanguage.startsWith("zh") ? "zh" : "en";
  }
}
