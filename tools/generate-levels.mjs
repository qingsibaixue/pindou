import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCreativeLayouts } from "./creative-layouts.mjs";

const outputDir = resolve("assets/resources/levels");
const TRAY_CAPACITY = 20;
const MIN_GROUP_SIZE = 12;
const MAX_GROUP_SIZE = 40;

mkdirSync(outputDir, { recursive: true });

const colorThemes = [
  ["#F45B78", "#FF9E5E", "#FFD65A", "#55C878", "#4EA8E8", "#9271D1"],
  ["#2E9C8C", "#6EC6B8", "#A8DB68", "#FFD166", "#EF767A", "#7B6FC2"],
  ["#4059AD", "#68A0CF", "#89D6C7", "#F4B942", "#E76D83", "#925FA6"],
  ["#E85D75", "#F49A68", "#F6CF57", "#78C850", "#4D9DE0", "#7768AE"],
  ["#F06F8E", "#FFB56B", "#F7DD72", "#62C4A5", "#55A8D8", "#9A77C8"],
];

const lateColorExtensions = [
  ["#20B7A7", "#E879C6", "#8CCB4B", "#5267C8", "#E4583E", "#2F7F72"],
  ["#E15C9A", "#4E8ED8", "#F09B3D", "#4CB96B", "#B55FC2", "#C75A55"],
  ["#2DAA9B", "#EF8A47", "#75B94E", "#D85B9B", "#596FD0", "#C78A32"],
  ["#25A99A", "#D968B6", "#86BD43", "#5269C6", "#E45B3E", "#338372"],
  ["#3AA99C", "#E46BB5", "#86BF4F", "#5D6BC5", "#E25D45", "#357F73"],
];

const levelNames = [
  "心动初遇", "春日小花", "蓝海游鱼", "许愿星光", "勇气火箭",
  "甜梦猫咪", "生日蛋糕", "彩翼蝴蝶", "闪耀皇冠", "四色回廊",
  "糖果列车", "鲸歌远航", "风帆出海", "霓虹之城", "跃动乐章",
  "参天大树", "灯塔守望", "热气球之旅", "火箭升空", "飞瀑入潭",
  "彩虹风筝", "泡泡鱼群", "双向飞行", "宝石山谷", "星球轨道",
  "云端阶梯", "珠宝橱窗", "火箭接力", "灯笼长街", "五彩祥云",
  "雪山营地", "深海潜艇", "沙漠城堡", "森林木屋", "远古恐龙",
  "月球基地", "蒸汽工坊", "极光冰宫", "天空鲸岛", "时光沙漏",
  "星际舰队", "双龙戏珠", "四季花园", "海上都市", "魔法学院",
  "银河列车", "天空乐园", "守护神殿", "世界拼图", "万象庆典",
];

const levelGuides = [
  "先拿起一整片错色豆豆", "让花瓣整片轮换", "让鱼身整片游回底色", "沿星角寻找换位顺序", "从火箭头开始观察",
  "猫咪轮廓里藏着颜色循环", "蛋糕分层整片搬运", "左右翅膀交替归位", "先看皇冠尖角的颜色", "沿回廊转角寻找换位顺序",
  "沿弯曲车轨，让糖果车厢依次换位", "让鲸身色块像海浪一样接力", "先腾空一面帆，再完成船身", "从高低楼顶判断颜色去向", "让音符按节拍整片落豆",
  "从树冠向树根完成生长", "灯塔由光室向礁石逐层点亮", "让气球从篮筐一路升到球顶", "从火焰向箭头完成升空", "水流从云端落入潭底",
  "五只风筝沿弧线依次换色", "鱼群错峰游动，不要追单颗豆", "两排火箭反向接力", "先立山峰，再填山谷", "沿轨道判断五色循环",
  "阶梯有转折，留意中间平台", "上排宝石先腾出下排空间", "火箭沿对角线分批接力", "整盏灯笼搬运，点亮长街", "让五朵云在上下层流动",
  "从山顶到营地分三层判断", "潜艇编队上下反向航行", "城堡砖块按阶梯重建", "屋顶与地基使用不同节奏", "从背脊到尾巴，寻找大小不同的色块",
  "基地由中心向两翼展开", "沿蒸汽管道的折线接力", "先完成冰宫中央尖塔", "鲸岛按两排波浪顺序漂移", "上下宽、中间窄是沙漏线索",
  "六艘舰船按两列编队归位", "两组三色循环围绕中心宝珠", "上下花园是两组独立三色循环", "城市六区整片点亮", "先完成中央学院主塔",
  "上下列车反向行驶", "围绕中心乐园完成六色环", "从神殿顶端向基座落豆", "上下拼图片分别寻找循环", "最终庆典：识别三组对称关系",
];

function composeHorizontal(parts, gap = 1, padding = 1) {
  const height = Math.max(...parts.map((part) => part.length));
  const normalized = parts.map((part) => {
    const width = Math.max(...part.map((row) => row.length));
    return Array.from({ length: height }, (_, row) =>
      (part[row] || "").padEnd(width, "."),
    );
  });
  const spacer = ".".repeat(gap);
  const edge = ".".repeat(padding);
  return Array.from({ length: height }, (_, row) =>
    `${edge}${normalized.map((part) => part[row]).join(spacer)}${edge}`,
  );
}

function composeVertical(parts, gap = 0, padding = 1) {
  const width = Math.max(...parts.flat().map((row) => row.length));
  const edge = ".".repeat(width + padding * 2);
  const rows = [];
  parts.forEach((part, index) => {
    for (const row of part) {
      const left = Math.floor((width - row.length) / 2);
      const right = width - row.length - left;
      rows.push(`${".".repeat(padding + left)}${row}${".".repeat(padding + right)}`);
    }
    if (index < parts.length - 1) {
      for (let i = 0; i < gap; i++) rows.push(edge);
    }
  });
  return rows;
}

function motifPoints(pattern) {
  const points = [];
  pattern.forEach((row, r) => {
    [...row].forEach((value, c) => {
      if (value === "#") points.push([r, c]);
    });
  });
  return points;
}

function rotatePoints(points, turns = 0) {
  let result = points.map(([row, col]) => [row, col]);
  for (let turn = 0; turn < ((turns % 4) + 4) % 4; turn++) {
    result = result.map(([row, col]) => [col, -row]);
  }
  const minRow = Math.min(...result.map(([row]) => row));
  const minCol = Math.min(...result.map(([, col]) => col));
  return result.map(([row, col]) => [row - minRow, col - minCol]);
}

function motifScene(motif, placements, padding = 1) {
  const source = motifPoints(motif);
  const regions = placements.map(([row, col, turns = 0]) =>
    rotatePoints(source, turns).map(([r, c]) => [r + row, c + col]),
  );
  const maxRow = Math.max(...regions.flat().map(([row]) => row));
  const maxCol = Math.max(...regions.flat().map(([, col]) => col));
  const canvas = Array.from({ length: maxRow + padding * 2 + 1 }, () =>
    new Array(maxCol + padding * 2 + 1).fill("."),
  );
  regions.forEach((points, index) => {
    const letter = String.fromCharCode(65 + index);
    for (const [row, col] of points) {
      const r = row + padding;
      const c = col + padding;
      if (canvas[r][c] !== ".") {
        throw new Error(`handcrafted motif overlap at ${r},${c}`);
      }
      canvas[r][c] = letter;
    }
  });
  return canvas.map((row) => row.join(""));
}

const motifs30 = {
  orb: ["..####..", ".######.", "########", "########", "..####.."],
  gem: ["...##...", "..####..", ".######.", "########", ".######.", "..####.."],
  rocket: ["..##..", ".####.", "######", "######", "######", ".####.", "..##.."],
  tile: ["######", "######", "######", "######", "######"],
};

const motifs36 = {
  orb: ["..####..", ".######.", "########", "########", ".######.", "..####.."],
  gem: ["...##...", "..####..", ".######.", "########", "########", ".######.", "...##..."],
  rocket: ["...##...", "..####..", ".######.", "########", "########", "..####..", "...##...", "...##..."],
  tile: ["######", "######", "######", "######", "######", "######"],
};

function motifBounds(motif) {
  const points = motifPoints(motif);
  return {
    height: Math.max(...points.map(([row]) => row)) + 1,
    width: Math.max(...points.map(([, col]) => col)) + 1,
  };
}

// 后半程统一采用“纵向场景”语言：顶部聚焦、双列承接、错峰下落。
// 不是简单旋转旧棋盘，而是用不同重心组织五块/六块图案，让手机竖屏上
// 每颗豆保持足够大，同时还能从整体轮廓判断下一步。
function portraitFive(motif, variant = 0) {
  const { height: h, width: w } = motifBounds(motif);
  const center = Math.floor(w * 0.5);
  const styles = [
    [[0, center], [h + 1, 0], [h + 1, w], [h * 2 + 2, 0], [h * 2 + 2, w]],
    [[0, 0], [0, w], [h + 1, center], [h * 2 + 2, 0], [h * 2 + 2, w]],
    [[0, 0], [2, w], [h + 2, center], [h * 2 + 3, 0], [h * 2 + 5, w]],
    [[0, center], [h + 1, 0], [h + 3, w], [h * 2 + 4, 0], [h * 2 + 6, w]],
  ];
  return motifScene(motif, styles[variant % styles.length]);
}

function portraitSix(motif, variant = 0) {
  const { height: h, width: w } = motifBounds(motif);
  const styles = [
    [[0, 0], [0, w], [h + 1, 0], [h + 1, w], [h * 2 + 2, 0], [h * 2 + 2, w]],
    [[0, 0], [2, w], [h + 1, 0], [h + 3, w], [h * 2 + 2, 0], [h * 2 + 4, w]],
    [[2, 0], [0, w], [h + 3, 0], [h + 1, w], [h * 2 + 4, 0], [h * 2 + 2, w]],
  ];
  return motifScene(motif, styles[variant % styles.length]);
}

const chapterThreeLayouts = [
  portraitFive(motifs30.gem, 0),
  portraitFive(motifs30.orb, 1),
  portraitFive(motifs30.rocket, 2),
  portraitFive(motifs30.gem, 3),
  portraitFive(motifs30.orb, 2),
  portraitFive(motifs30.tile, 0),
  portraitFive(motifs30.gem, 1),
  portraitFive(motifs30.rocket, 3),
  portraitFive(motifs30.tile, 2),
  portraitFive(motifs30.orb, 3),
];

const chapterFourLayouts = [
  portraitFive(motifs36.gem, 0),
  portraitFive(motifs36.rocket, 1),
  portraitFive(motifs36.tile, 2),
  portraitFive(motifs36.gem, 3),
  portraitFive(motifs36.orb, 1),
  portraitFive(motifs36.tile, 0),
  portraitFive(motifs36.rocket, 2),
  portraitFive(motifs36.gem, 1),
  portraitFive(motifs36.orb, 3),
  portraitFive(motifs36.gem, 2),
];

const chapterFiveLayouts = [
  portraitSix(motifs36.rocket, 0),
  portraitSix(motifs36.gem, 1),
  portraitSix(motifs36.orb, 2),
  portraitSix(motifs36.tile, 0),
  portraitSix(motifs36.gem, 2),
  portraitSix(motifs36.rocket, 1),
  portraitSix(motifs36.orb, 0),
  portraitSix(motifs36.tile, 1),
  portraitSix(motifs36.gem, 0),
  portraitSix(motifs36.rocket, 2),
];

// 竖屏构图：四节糖果车厢沿 S 形轨道向上行进。
// 每节仍是 24 颗，车轮与下一节车厢首尾相接；从 6x29 改成 18x14，
// 让豆豆在手机上明显变大，同时形成一列连续向上的糖果列车。
const candyTrain = motifScene(
  [".######.", "########", ".######.", "..##.##."],
  [[0, 4], [4, 0], [8, 4], [12, 0]],
);

const singingWhale = motifScene(
  ["..#.....", ".#####..", "#######.", "######..", ".####...", "..#....."],
  [[0, 0], [5, 7], [10, 0], [15, 7]],
);

const sailingBoat = motifScene(
  ["...#...", "..###..", ".#####.", "#######", "..###..", ".#####."],
  [[0, 0], [6, 7], [12, 0], [18, 7]],
);

const nightSkyline = motifScene(
  ["..##..", ".####.", "######", "##..##", "######", "..##.."],
  [[0, 0], [4, 6], [10, 0], [14, 6]],
);

const joyfulNotes = motifScene(
  ["....##", "....##", ".#####", ".#####", ".##.##", "####..", ".##..."],
  [[0, 0], [6, 6], [13, 0], [19, 6]],
);

const toweringTree = composeVertical([
  ["...A...", "..AAA..", ".AAAAA.", "AAAAAAA", ".AAAAA.", "..AAA.."],
  [".BBBBB.", "BBBBBBB", "BBBBBBB", ".BBBBB."],
  [".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC."],
  [".DDDDD.", "DDDDDDD", "DDDDDDD", ".DDDDD."],
]);

const watchingLighthouse = composeVertical([
  ["..AAA..", ".AAAAA.", "AAAAAAA", ".A...A.", ".AAAAA.", "..A.A.."],
  [".BBBB.", ".BBBB.", ".BBBB.", ".BBBB.", ".BBBB.", ".BBBB."],
  [".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC."],
  [".DDDDD.", "DDDDDDD", "DDDDDDD", ".DDDDD."],
]);

const balloonJourney = composeVertical([
  ["...A...", "..AAA..", ".AAAAA.", "AAAAAAA", ".AAAAA.", "..AAA.."],
  ["..BBB..", ".BBBBB.", "BBBBBBB", "..BBB..", "..BBB..", "..BBB.."],
  [".CC.CC.", ".CC.CC.", ".CCCCC.", ".CCCCC.", "..CCC..", "..CCC.."],
  [".DDDD.", ".DDDD.", ".DDDD.", ".DDDD.", ".DDDD.", ".DDDD."],
]);

const rocketLaunch = composeVertical([
  ["...A...", "..AAA..", ".AAAAA.", "AAAAAAA", ".AAAAA.", "..AAA.."],
  [".BBBB.", ".BBBB.", ".BB.BB.", ".BB.BB.", ".BBBB.", ".BBBB."],
  [".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC."],
  ["..D.D..", ".DD.DD.", ".DDDDD.", ".DDDDD.", "..DDD..", "..DDD..", "..DD..."],
]);

const fallingWater = composeVertical([
  ["..AAA..", ".AAAAA.", "AAAAAAA", "AAAAAAA", ".AA...."],
  [".BBBB.", ".BBBB.", ".BBBB.", ".BBBB.", ".BBBB.", ".BBBB."],
  [".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC.", ".CCCC."],
  ["...D...", "..DDD..", ".DDDDD.", "DDDDDDD", ".DDDDD.", "..DDD.."],
]);

const creativeLayouts = createCreativeLayouts();

// 50关全部由明确的像素图或场景构图组成。每个字母是一整片可移动区域；同一关中
// 每个字母数量相等，才能让玩家完整地“拿起一片、倒下一片”。
const handcraftedLayouts = [
  ["..AA..BB..", ".AAAABBBB.", ".AAAABBBB.", ".AAACCBBB.", ".AACCCBBB.", "..ACCCCC..", "...CCCC...", "....CC...."],
  ["....ABB....", "...AAABB...", ".AA.AAB.BB.", "AAAAABBBBBB", ".AAACCCBBB.", "...ACCCB...", "....CCC....", "....CCC....", "...CCCCC..."],
  ["......BB....", ".AA..BBBBB..", ".AAAAABBBBB.", ".AAAABBCCBB.", ".AAACCCCCCC.", ".AA..CCCCC..", "......CC...."],
  [".....AB.....", "....AABB....", "....AABB....", "AAAAAABBBBBB", ".CCAAABBBDD.", "..CCCCDDDD..", "...CCCDDD...", "..CCC..DDD..", ".CC......DD."],
  [".....AA.....", "....AAAA....", "..AAAAAAAA..", "...BBBBBBB..", "...BBBBBBB..", "...CCCCCCC..", "...CCCCCCC..", ".DDD.DD.DDD.", "...DDDDDD..."],
  [".AAAA....BBBB.", "AAAAAA..BBBBBB", "AAAAAACCBBBBBB", "...CCCCDDDD...", "..CCCCDDDD....", "...CCCDDD.....", "...CCCDDD.....", "......DD......"],
  ["...A.A.A.A....", "...A.A.A.A....", "..AAAAAAAAAA..", "..BBBBBBBBB...", "..BBBBBBBBB...", "..CCCCCCCCC...", "..CCCCCCCCC...", "....DDDDDD....", ".DDDDDDDDDDDD."],
  [".AAA....BBB.", "AAAAA..BBBBB", ".AAAAABBBBB.", "..AAAABBBB..", "....ACBD....", "..CCCCDDDD..", ".CCCCCDDDDD.", "CCCCC..DDDDD", ".CCC....DDD."],
  ["A....AB....B", "AA..AABB..BB", "AAAAAABBBBBB", ".AAACCDDBBB.", ".CCCCCDDDDD.", "..CCCCDDDD..", "..CCCCDDDD.."],
  ["AAAAAAAAAAAA", "BBBBBBBBBBBA", "BCCCCCCCCCBA", "BCDDDDDDDDBA", "BCDDDDDDDDCA", "BCDDDDDDDDCA", "BCCCCCCCCCCA", "BBBBBBAAAAAA"],
  candyTrain,
  ...creativeLayouts,
];

function horizontalSnake(rows, cols) {
  const result = [];
  for (let row = 0; row < rows; row++) {
    if (row % 2 === 0) {
      for (let col = 0; col < cols; col++) result.push([row, col]);
    } else {
      for (let col = cols - 1; col >= 0; col--) result.push([row, col]);
    }
  }
  return result;
}

function verticalSnake(rows, cols) {
  const result = [];
  for (let col = 0; col < cols; col++) {
    if (col % 2 === 0) {
      for (let row = 0; row < rows; row++) result.push([row, col]);
    } else {
      for (let row = rows - 1; row >= 0; row--) result.push([row, col]);
    }
  }
  return result;
}

function spiral(rows, cols) {
  const result = [];
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  while (top <= bottom && left <= right) {
    for (let col = left; col <= right; col++) result.push([top, col]);
    top++;
    for (let row = top; row <= bottom; row++) result.push([row, right]);
    right--;
    if (top <= bottom) {
      for (let col = right; col >= left; col--) result.push([bottom, col]);
      bottom--;
    }
    if (left <= right) {
      for (let row = bottom; row >= top; row--) result.push([row, left]);
      left++;
    }
  }
  return result;
}

function traversal(rows, cols, style) {
  const mode = style % 6;
  let path;
  if (mode < 2) path = horizontalSnake(rows, cols);
  else if (mode < 4) path = verticalSnake(rows, cols);
  else path = spiral(rows, cols);
  return mode % 2 === 0 ? path : path.reverse();
}

function chapterConfig(number) {
  if (number <= 15) return { activeRows: 8, activeCols: 14, regionCount: 4 };
  if (number <= 20) return { activeRows: 14, activeCols: 8, regionCount: 4 };
  if (number <= 25) return { activeRows: 10, activeCols: 15, regionCount: 5 };
  if (number <= 30) return { activeRows: 15, activeCols: 10, regionCount: 5 };
  if (number <= 35) return { activeRows: 12, activeCols: 15, regionCount: 5 };
  if (number <= 40) return { activeRows: 15, activeCols: 12, regionCount: 5 };
  if (number <= 45) return { activeRows: 12, activeCols: 18, regionCount: 6 };
  return { activeRows: 18, activeCols: 12, regionCount: 6 };
}

function beanPermutation(regionCount, number) {
  // 五色关交替使用一步/两步循环；六色关交替使用完整六色循环、
  // 两组三色循环和三组双色循环。难度来自识别关系，不来自碎豆。
  let shift = 1;
  if (regionCount === 5 && number % 2 === 0) shift = 2;
  if (regionCount === 6) shift = [1, 2, 3][number % 3];
  return Array.from(
    { length: regionCount },
    (_, index) => ((index + shift) % regionCount) + 1,
  );
}

function buildHandcraftedLevel(number) {
  const layout = handcraftedLayouts[number - 1];
  const art = Array.isArray(layout) ? layout : layout.art;
  const rows = art.length;
  const cols = art[0].length;
  if (art.some((row) => row.length !== cols)) {
    throw new Error(`level ${number}: handcrafted row width mismatch`);
  }

  const letters = [...new Set(art.join(""))]
    .filter((key) => key !== ".")
    .sort();
  const permutation = Array.isArray(layout)
    ? beanPermutation(letters.length, number)
    : layout.beanMapping;
  const themeIndex = (number - 1) % colorThemes.length;
  const theme = number >= 26
    ? [...colorThemes[themeIndex], ...lateColorExtensions[themeIndex]]
    : colorThemes[themeIndex];
  const colors = [{ id: 0, hex: "#E8F7F5" }];
  for (let id = 1; id <= letters.length; id++) colors.push({ id, hex: theme[id - 1] });

  const cells = [];
  for (const row of art) {
    for (const key of row) {
      if (key === ".") {
        cells.push({ targetColorId: 0, beanColorId: 0 });
        continue;
      }
      const regionIndex = letters.indexOf(key);
      cells.push({
        targetColorId: regionIndex + 1,
        beanColorId: permutation[regionIndex],
      });
    }
  }

  return {
    id: `level_${String(number).padStart(3, "0")}`,
    name: levelNames[number - 1],
    guide: levelGuides[number - 1],
    rows,
    cols,
    colors,
    cells,
    trayCapacity: TRAY_CAPACITY,
    trayBeans: [],
  };
}

function buildLevel(number) {
  if (number <= handcraftedLayouts.length) return buildHandcraftedLevel(number);
  const { activeRows, activeCols, regionCount } = chapterConfig(number);
  const rows = activeRows + 2;
  const cols = activeCols + 2;
  const activeCount = activeRows * activeCols;
  const groupSize = activeCount / regionCount;
  if (!Number.isInteger(groupSize)) {
    throw new Error(`level ${number}: active cells cannot be split equally`);
  }

  const target = new Array(rows * cols).fill(0);
  const beans = new Array(rows * cols).fill(0);
  const path = traversal(activeRows, activeCols, number - 1);
  const permutation = beanPermutation(regionCount, number);

  path.forEach(([innerRow, innerCol], order) => {
    const regionIndex = Math.floor(order / groupSize);
    const index = (innerRow + 1) * cols + innerCol + 1;
    target[index] = regionIndex + 1;
    beans[index] = permutation[regionIndex];
  });

  const theme = colorThemes[(number - 1) % colorThemes.length];
  const colors = [{ id: 0, hex: "#E8F7F5" }];
  for (let id = 1; id <= regionCount; id++) colors.push({ id, hex: theme[id - 1] });

  return {
    id: `level_${String(number).padStart(3, "0")}`,
    name: levelNames[number - 1],
    guide: levelGuides[number - 1],
    rows,
    cols,
    colors,
    cells: target.map((targetColorId, index) => ({
      targetColorId,
      beanColorId: beans[index],
    })),
    trayCapacity: TRAY_CAPACITY,
    trayBeans: [],
  };
}

function connectedComponentSizes(level) {
  const seen = new Set();
  const sizes = [];
  const { rows, cols, cells } = level;
  for (let start = 0; start < cells.length; start++) {
    const startCell = cells[start];
    if (seen.has(start) || startCell.beanColorId === startCell.targetColorId) continue;
    const colorId = startCell.beanColorId;
    const queue = [start];
    seen.add(start);
    let size = 0;
    while (queue.length > 0) {
      const index = queue.shift();
      size++;
      const row = Math.floor(index / cols);
      const col = index % cols;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = row + dr;
        const nc = col + dc;
        const next = nr * cols + nc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen.has(next)) continue;
        const cell = cells[next];
        if (cell.beanColorId !== colorId || cell.beanColorId === cell.targetColorId) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes;
}

function isConnectedIndexSet(indexes, cols) {
  if (indexes.length === 0) return true;
  const allowed = new Set(indexes);
  const seen = new Set([indexes[0]]);
  const queue = [indexes[0]];
  while (queue.length > 0) {
    const index = queue.shift();
    const row = Math.floor(index / cols);
    const col = index % cols;
    for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
      const next = (row + dr) * cols + col + dc;
      if (allowed.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === allowed.size;
}

function validateOverflowSplits(level) {
  const problems = [];
  const { cols } = level;
  for (const color of level.colors.filter(({ id }) => id > 0)) {
    const indexes = level.cells
      .map((cell, index) => cell.targetColorId === color.id ? index : -1)
      .filter((index) => index >= 0);
    const remainderCount = indexes.length - TRAY_CAPACITY;
    if (remainderCount <= 0) continue;

    const allowed = new Set(indexes);
    const candidates = [...indexes].sort((a, b) => {
      const ar = Math.floor(a / cols);
      const br = Math.floor(b / cols);
      return br - ar || (b % cols) - (a % cols);
    });
    let found = false;
    for (const seed of candidates) {
      const queue = [seed];
      const reserved = [];
      const seen = new Set();
      while (queue.length > 0 && reserved.length < remainderCount) {
        const index = queue.shift();
        if (seen.has(index)) continue;
        seen.add(index);
        reserved.push(index);
        const row = Math.floor(index / cols);
        const col = index % cols;
        for (const [dr, dc] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
          const next = (row + dr) * cols + col + dc;
          if (allowed.has(next) && !seen.has(next)) queue.push(next);
        }
      }
      const reservedSet = new Set(reserved);
      const firstBatch = indexes.filter((index) => !reservedSet.has(index));
      if (isConnectedIndexSet(reserved, cols) && isConnectedIndexSet(firstBatch, cols)) {
        found = true;
        break;
      }
    }
    if (!found) {
      problems.push(`颜色 ${color.id} 不能自然拆成20+${remainderCount}两个连通大组`);
    }
  }
  return problems;
}

function validateDesignedLevel(level) {
  const problems = [];
  if (level.rows > 32 || level.cols > 32) problems.push("棋盘长宽不能超过 32");
  if (level.trayBeans.length !== 0) problems.push("托盘开局必须为空");
  if (level.cells.some((cell) => cell.beanColorId < 0)) problems.push("棋盘开局不能有空洞");

  const targetCounts = new Map();
  const beanCounts = new Map();
  for (const cell of level.cells) {
    targetCounts.set(cell.targetColorId, (targetCounts.get(cell.targetColorId) || 0) + 1);
    beanCounts.set(cell.beanColorId, (beanCounts.get(cell.beanColorId) || 0) + 1);
  }
  for (const color of level.colors) {
    if ((targetCounts.get(color.id) || 0) !== (beanCounts.get(color.id) || 0)) {
      problems.push(`颜色 ${color.id} 数量不守恒`);
    }
  }

  const groups = connectedComponentSizes(level);
  if (groups.length < 3) problems.push(`可移动大块太少：${groups.length}`);
  if (groups.some((size) => size < MIN_GROUP_SIZE)) {
    problems.push(`出现小于 ${MIN_GROUP_SIZE} 颗的碎片组：${groups.join(",")}`);
  }
  if (groups.some((size) => size > MAX_GROUP_SIZE)) {
    problems.push(`出现大于 ${MAX_GROUP_SIZE} 颗的拖沓豆群：${groups.join(",")}`);
  }
  problems.push(...validateOverflowSplits(level));
  if (problems.length > 0) throw new Error(`${level.id}: ${problems.join("；")}`);
  return groups;
}

const levels = Array.from({ length: 50 }, (_, index) => buildLevel(index + 1));
const summaries = [];
for (const level of levels) {
  const groups = validateDesignedLevel(level);
  const overflow = groups.some((size) => size > level.trayCapacity) ? "·需分批" : "";
  const sizes = [...new Set(groups)].sort((a, b) => a - b).join("/");
  summaries.push(`${level.id}:${groups.length}组·${sizes}颗${overflow}`);
  writeFileSync(
    resolve(outputDir, `${level.id}.json`),
    `${JSON.stringify(level, null, 2)}\n`,
  );
}

console.log(`Generated ${levels.length} large-group levels in ${outputDir}`);
console.log(summaries.join(" | "));
