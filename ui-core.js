export const STORAGE_SCHEMA_VERSION = 1;

export function cloneTeams(teams) {
  return Array.from({ length: 5 }, (_, index) => ({ ...(teams[index] || {}) }));
}

export function expeditionClass(id) {
  const group = String(id || "").charAt(0).toLowerCase();
  return /^[a-e]$/.test(group) ? `expedition-${group}` : "";
}

export function clearStockValues(stock) {
  return {
    previous: [...stock],
    next: Array.from({ length: 4 }, () => "0"),
  };
}

export function createStoragePayload({ stock, targets, dailyQuest, teamCount, teams }) {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    stock: [...stock],
    targets: [...targets],
    dailyQuest: Boolean(dailyQuest),
    teamCount,
    teams: cloneTeams(teams),
  };
}

export function parseStoredPayload(primary, legacy) {
  for (const raw of [primary, legacy]) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // 壊れた保存データは読み飛ばし、次の候補を確認する。
    }
  }
  return null;
}
