export const EMPTY_COLOR = -1;

export interface BeanColorData {
  id: number;
  hex: string;
}

export interface LevelData {
  id: string;
  name: string;

  rows: number;
  cols: number;

  colors: BeanColorData[];

  /**
   * 一维数组
   * index = row * cols + col
   *
   * -1 = 不需要放豆
   * 0+ = 对应颜色ID
   */
  cells: number[];

  /**
   * 设计者配置的豆子数量
   * 后面编辑器会拿这个和实际需求做校验。
   */
  beanCounts?: Record<number, number>;
}
