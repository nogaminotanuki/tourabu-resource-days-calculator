export const RESOURCE_NAMES = ["木炭", "玉鋼", "冷却材", "砥石"];
export const MAX_RESOURCE = 9_999_999;
export const DAILY_REWARD = 2_800;

export const EXPEDITIONS = [
  { id: "A1", name: "鳥羽・伏見の戦い", minutes: 10, success: [10, 15, 0, 0], great: [15, 22, 0, 0], koban: 0, request: 0, help: 0 },
  { id: "A2", name: "世直し一揆", minutes: 30, success: [0, 0, 30, 30], great: [0, 0, 45, 45], koban: 0, request: 0, help: 0 },
  { id: "A3", name: "甲州勝沼の戦い", minutes: 20, success: [20, 0, 20, 0], great: [30, 0, 30, 0], koban: 0, request: 0, help: 0 },
  { id: "A4", name: "白河戦線", minutes: 60, success: [0, 60, 0, 60], great: [0, 90, 0, 90], koban: 0, request: 0, help: 0 },
  { id: "B1", name: "公武合体運動", minutes: 90, success: [0, 0, 90, 90], great: [0, 0, 135, 135], koban: 200, request: 0, help: 0 },
  { id: "B2", name: "加役方人足寄場", minutes: 180, success: [0, 50, 0, 250], great: [0, 75, 0, 375], koban: 200, request: 0, help: 0 },
  { id: "B3", name: "享保の大飢饉", minutes: 120, success: [120, 0, 120, 0], great: [180, 0, 180, 0], koban: 0, request: 1, help: 0 },
  { id: "B4", name: "天下泰平", minutes: 150, success: [0, 180, 0, 120], great: [0, 270, 0, 180], koban: 0, request: 0, help: 1 },
  { id: "C1", name: "美濃国の決戦", minutes: 240, success: [130, 240, 0, 0], great: [195, 360, 0, 0], koban: 0, request: 1, help: 0 },
  { id: "C2", name: "反旗を翻した原因", minutes: 180, success: [0, 100, 60, 150], great: [0, 150, 90, 225], koban: 0, request: 0, help: 1 },
  { id: "C3", name: "安土城の警備", minutes: 600, success: [200, 0, 500, 0], great: [300, 0, 750, 0], koban: 400, request: 0, help: 0 },
  { id: "C4", name: "天下布武", minutes: 480, success: [0, 200, 0, 500], great: [0, 300, 0, 750], koban: 0, request: 0, help: 1 },
  { id: "D1", name: "長篠城攻城戦", minutes: 120, success: [0, 80, 100, 60], great: [0, 120, 150, 90], koban: 0, request: 1, help: 0 },
  { id: "D2", name: "西上作戦", minutes: 300, success: [100, 380, 0, 0], great: [150, 570, 0, 0], koban: 400, request: 0, help: 0 },
  { id: "D3", name: "甲相駿三国同盟", minutes: 720, success: [100, 200, 500, 0], great: [150, 300, 750, 0], koban: 0, request: 0, help: 2 },
  { id: "D4", name: "比叡山延暦寺", minutes: 360, success: [150, 0, 0, 400], great: [225, 0, 0, 600], koban: 700, request: 0, help: 0 },
  { id: "E1", name: "鎌倉防衛戦", minutes: 720, success: [250, 250, 250, 0], great: [375, 375, 375, 0], koban: 0, request: 0, help: 2 },
  { id: "E2", name: "元寇防塁", minutes: 1080, success: [200, 500, 300, 0], great: [300, 750, 450, 0], koban: 700, request: 0, help: 2 },
  { id: "E3", name: "流鏑馬揃え", minutes: 900, success: [350, 200, 100, 250], great: [525, 300, 150, 375], koban: 700, request: 0, help: 0 },
  { id: "E4", name: "奥州合戦", minutes: 1200, success: [300, 400, 500, 0], great: [450, 600, 750, 0], koban: 700, request: 3, help: 0 },
];

export function requiredDays(stock, target, dailyGain) {
  if (target === null) return null;
  const deficit = Math.max(0, target - stock);
  if (deficit === 0) return 0;
  if (dailyGain === 0) return Infinity;
  return Math.ceil(deficit / dailyGain);
}

export function calculateProjection({ stock, targets, successGain, greatGain }) {
  const successDays = stock.map((value, index) => requiredDays(value, targets[index], successGain[index]));
  const greatDays = stock.map((value, index) => requiredDays(value, targets[index], greatGain[index]));
  const activeIndexes = targets.flatMap((value, index) => value === null ? [] : [index]);
  const totalDays = (days) => {
    const values = activeIndexes.map((index) => days[index]);
    return values.some((value) => value === Infinity) ? Infinity : Math.max(...values, 0);
  };
  const successTotalDays = totalDays(successDays);
  const greatTotalDays = totalDays(greatDays);
  const arrival = (days, gains) => days === Infinity ? null : stock.map((value, index) => Math.min(MAX_RESOURCE, value + gains[index] * days));
  return {
    successDays, greatDays, successTotalDays, greatTotalDays,
    successArrival: arrival(successTotalDays, successGain),
    greatArrival: arrival(greatTotalDays, greatGain), activeIndexes,
  };
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}分`;
  if (!rest) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}
