import { DAILY_REWARD, EXPEDITIONS, MAX_RESOURCE, RESOURCE_NAMES, calculateProjection, formatDuration } from "/calculation-core.js";
import { clearStockValues, cloneTeams, createArrivalComparison, createStoragePayload, expeditionClass, parseStoredPayload } from "/ui-core.js";

const STORAGE_KEY = "tourabuResourceDaysV1";
const LEGACY_KEY = "tourabuResourceDaysPrototypeV3";
const expeditionById = new Map(EXPEDITIONS.map((item) => [item.id, item]));
const EXPEDITION_GROUPS = [
  { key: "A", label: "A1〜A4", className: "expedition-a" },
  { key: "B", label: "B1〜B4", className: "expedition-b" },
  { key: "C", label: "C1〜C4", className: "expedition-c" },
  { key: "D", label: "D1〜D4", className: "expedition-d" },
  { key: "E", label: "E1〜E4", className: "expedition-e" },
];
const formatNumber = new Intl.NumberFormat("ja-JP");
const $ = (selector) => document.querySelector(selector);
const emptyTeams = () => Array.from({ length: 5 }, () => ({}));
const stockInputs = Array.from({ length: 4 }, (_, index) => $(`#stock${index}`));
const targetInputs = Array.from({ length: 4 }, (_, index) => $(`#target${index}`));
const state = { dailyQuest: true, teamCount: 4, teams: emptyTeams(), filter: "all" };
let toastTimer = null;
let undoAction = null;

function parseResource(input, nullable = false) {
  const text = input.value.trim();
  if (nullable && text === "") return { value: null, valid: true };
  if (text === "") return { value: 0, valid: true };
  const value = Number(text.replaceAll(",", ""));
  return { value, valid: Number.isInteger(value) && value >= 0 && value <= MAX_RESOURCE };
}

function readResources() {
  let valid = true;
  const stock = stockInputs.map((input) => {
    const parsed = parseResource(input);
    input.toggleAttribute("aria-invalid", !parsed.valid);
    valid &&= parsed.valid;
    return parsed.value;
  });
  const targets = targetInputs.map((input) => {
    const parsed = parseResource(input, true);
    input.toggleAttribute("aria-invalid", !parsed.valid);
    valid &&= parsed.valid;
    return parsed.value;
  });
  return { stock, targets, valid };
}

function cleanTeams(value) {
  const result = emptyTeams();
  if (!Array.isArray(value)) return result;
  value.slice(0, 5).forEach((team, teamIndex) => {
    if (!team || typeof team !== "object") return;
    const entries = Array.isArray(team) ? team.map((row) => [row?.id, row?.count]) : Object.entries(team);
    entries.forEach(([id, count]) => {
      const safeCount = Math.max(0, Math.floor(Number(count) || 0));
      if (expeditionById.has(id) && safeCount) result[teamIndex][id] = safeCount;
    });
  });
  return result;
}

function restore() {
  const stored = parseStoredPayload(localStorage.getItem(STORAGE_KEY), localStorage.getItem(LEGACY_KEY));
  if (!stored) return;
  const legacyInputs = stored.inputs || {};
  const stocks = stored.stock || stored.current || Array.from({ length: 4 }, (_, index) => legacyInputs[`stock${index}`]);
  if (Array.isArray(stocks)) stocks.slice(0, 4).forEach((value, index) => { stockInputs[index].value = value ?? 0; });
  const targets = stored.targets || Array.from({ length: 4 }, (_, index) => legacyInputs[`target${index}`]);
  if (Array.isArray(targets)) targets.slice(0, 4).forEach((value, index) => { targetInputs[index].value = value ?? ""; });
  state.dailyQuest = stored.dailyQuest !== undefined ? stored.dailyQuest !== false : legacyInputs.dailyQuest !== false;
  state.teamCount = Math.min(5, Math.max(1, Math.floor(Number(stored.teamCount ?? legacyInputs.teamCount) || 4)));
  state.teams = cleanTeams(stored.teams);
  for (let index = state.teamCount; index < 5; index += 1) state.teams[index] = {};
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createStoragePayload({
    stock: stockInputs.map((input) => input.value), targets: targetInputs.map((input) => input.value),
    dailyQuest: state.dailyQuest, teamCount: state.teamCount, teams: state.teams,
  })));
}

function activeEntries() {
  return state.teams.slice(0, state.teamCount).flatMap((team, teamIndex) => Object.entries(team).flatMap(([id, count]) =>
    count > 0 && expeditionById.has(id) ? [{ teamIndex, expedition: expeditionById.get(id), count }] : []));
}

function usedTeamMinutes(teamIndex) {
  return Object.entries(state.teams[teamIndex]).reduce((sum, [id, count]) => sum + (expeditionById.get(id)?.minutes || 0) * count, 0);
}

function usedDestinationMinutes(id) {
  const minutes = expeditionById.get(id)?.minutes || 0;
  return state.teams.slice(0, state.teamCount).reduce((sum, team) => sum + (team[id] || 0) * minutes, 0);
}

function canAdd(teamIndex, id) {
  const expedition = expeditionById.get(id);
  return Boolean(expedition && usedTeamMinutes(teamIndex) + expedition.minutes <= 1440 && usedDestinationMinutes(id) + expedition.minutes <= 1440);
}

function normalizeLimits() {
  const destinationMinutes = new Map();
  state.teams.slice(0, state.teamCount).forEach((team, teamIndex) => {
    let teamMinutes = 0;
    Object.keys(team).forEach((id) => {
      const expedition = expeditionById.get(id);
      const destinationUsed = destinationMinutes.get(id) || 0;
      const allowed = Math.min(Math.floor((1440 - teamMinutes) / expedition.minutes), Math.floor((1440 - destinationUsed) / expedition.minutes));
      const count = Math.min(team[id], allowed);
      if (count > 0) {
        team[id] = count;
        teamMinutes += count * expedition.minutes;
        destinationMinutes.set(id, destinationUsed + count * expedition.minutes);
      } else delete team[id];
    });
  });
}

function renderTeamCount() {
  $("#teamCount").innerHTML = Array.from({ length: 5 }, (_, index) => `<option value="${index + 1}">${index + 1}部隊</option>`).join("");
  $("#teamCount").value = String(state.teamCount);
}

function expeditionOptions() {
  const groups = EXPEDITION_GROUPS.map((group) => {
    const options = EXPEDITIONS.filter((item) => item.id.startsWith(group.key))
      .map((item) => `<option class="${group.className}" value="${item.id}">${item.id} ${item.name}（${formatDuration(item.minutes)}）</option>`)
      .join("");
    return `<optgroup class="${group.className}" label="${group.label}">${options}</optgroup>`;
  });
  return ['<option value="">遠征先を選択</option>', ...groups].join("");
}

function expeditionId(id) {
  return `<span class="expedition-id ${expeditionClass(id)}">${id}</span>`;
}

function renderTeams() {
  const root = $("#teams");
  root.innerHTML = "";
  for (let teamIndex = 0; teamIndex < state.teamCount; teamIndex += 1) {
    const card = document.createElement("section");
    const used = usedTeamMinutes(teamIndex);
    card.className = "team";
    const hasExpeditions = Object.keys(state.teams[teamIndex]).length > 0;
    card.innerHTML = `<div class="team-head"><strong class="team-title">遠征部隊${teamIndex + 1}</strong><div class="team-head-actions"><div class="team-time">${formatDuration(used)} / 24時間<div class="time-bar"><span style="width:${used / 14.4}%"></span></div></div><button class="team-clear" type="button" data-clear-team="${teamIndex}" aria-label="遠征部隊${teamIndex + 1}の設定をすべて削除" title="この部隊の遠征を削除" ${hasExpeditions ? "" : "disabled"}>×</button></div></div><div class="add-expedition"><select aria-label="遠征部隊${teamIndex + 1}の遠征先">${expeditionOptions()}</select><button class="button" type="button" data-add="${teamIndex}">追加</button></div><div class="team-runs"></div>`;
    const runs = card.querySelector(".team-runs");
    const entries = Object.entries(state.teams[teamIndex]);
    entries.forEach(([id, count]) => {
      const expedition = expeditionById.get(id);
      const row = document.createElement("div");
      row.className = `plan-row ${expeditionClass(id)}`;
      row.innerHTML = `<div class="plan-copy"><div class="plan-name">${expeditionId(id)}<span>${expedition.name}</span></div><div class="plan-meta">${formatDuration(expedition.minutes)} × ${count}回</div></div><div class="stepper"><button type="button" data-minus="${teamIndex}:${id}" aria-label="${expedition.name}を1回減らす">−</button><strong>${count}</strong><button type="button" data-plus="${teamIndex}:${id}" aria-label="${expedition.name}を1回増やす" ${canAdd(teamIndex, id) ? "" : "disabled"}>＋</button></div>`;
      runs.append(row);
    });
    root.append(card);
  }
}

function dailyGains() {
  const base = state.dailyQuest ? DAILY_REWARD : 0;
  const success = Array(4).fill(base);
  const great = Array(4).fill(base);
  activeEntries().forEach(({ expedition, count }) => {
    for (let index = 0; index < 4; index += 1) {
      success[index] += expedition.success[index] * count;
      great[index] += expedition.great[index] * count;
    }
  });
  return { success, great };
}

function renderDaily(gains) {
  $("#dailySummary").innerHTML = `<div class="daily-summary-title"><strong>1日の獲得</strong><span>成功 / 大成功</span></div>${RESOURCE_NAMES.map((name, index) => `<div class="summary-item"><span>${name}</span><strong>${formatNumber.format(gains.success[index])} <i>/</i> ${formatNumber.format(gains.great[index])}</strong></div>`).join("")}`;
}

function daysLabel(days) { return days === Infinity ? "到達不可" : `${days}日`; }
function dateLabel(days) {
  if (days === Infinity) return "予定日なし";
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return `${date.getMonth() + 1}月${date.getDate()}日ごろ`;
}

function bottleneck(days, total, activeIndexes, stock, targets) {
  if (total === Infinity) return `${activeIndexes.filter((index) => days[index] === Infinity).map((index) => RESOURCE_NAMES[index]).join("・")}（到達不可）`;
  if (total === 0) return "達成済み";
  return activeIndexes.filter((index) => targets[index] > stock[index] && days[index] === total).map((index) => RESOURCE_NAMES[index]).join("・") || "達成済み";
}

function clearResults(message) {
  $("#resultMessage").textContent = message;
  $("#resultMessage").hidden = false;
  $("#resultMessage").classList.add("is-visible", "is-error");
  ["#fastDays", "#slowDays", "#rangeDays", "#greatBottleneck", "#successBottleneck"].forEach((id) => { $(id).textContent = "—"; });
  ["#fastDate", "#slowDate", "#resultBody", "#mobileResultCards", "#greatFinalResources", "#successFinalResources"].forEach((id) => { $(id).innerHTML = ""; });
  $("#greatArrivalLabel").textContent = "—";
  $("#successArrivalLabel").textContent = "—";
  $("#greatArrivalDays").textContent = "—";
  $("#successArrivalDays").textContent = "—";
  $("#greatDurationText").textContent = "—";
  $("#successDurationText").textContent = "—";
  $("#greatDurationBar").style.width = "0";
  $("#successDurationBar").style.width = "0";
  $("#successArrivalBadge").textContent = "比較日数";
  $("#arrivalCompareNote").textContent = "到達日数が異なる場合、長く貯める側の所持数が多くなることがあります。";
}

function renderFinalResources(selector, values, targets) {
  $(selector).innerHTML = values ? RESOURCE_NAMES.map((name, index) => {
    const difference = targets[index] === null ? null : values[index] - targets[index];
    const targetNote = difference === null ? "" : `<small>${difference === 0 ? "目標どおり" : `目標＋${formatNumber.format(difference)}`}</small>`;
    return `<div class="final-resource"><span>${name}</span><span class="final-resource-value"><strong>${formatNumber.format(values[index])}</strong>${targetNote}</span></div>`;
  }).join("") : '<p class="unreachable">算出不可</p>';
}

function calculate() {
  const { stock, targets, valid } = readResources();
  const gains = dailyGains();
  renderDaily(gains);
  const noExpeditions = activeEntries().length === 0;
  $("#dailyPlanAlert").hidden = !(state.dailyQuest && noExpeditions);
  if (!valid) clearResults(`0～${formatNumber.format(MAX_RESOURCE)}の整数で入力してください。`);
  else if (targets.every((target) => target === null)) clearResults("目標資源を1つ以上入力してください。");
  else if (state.dailyQuest && noExpeditions) clearResults("日課をすべて達成するには遠征が必要です。遠征を1つ以上設定してください。");
  else {
    $("#resultMessage").hidden = true;
    $("#resultMessage").classList.remove("is-visible", "is-error");
    const result = calculateProjection({ stock, targets, successGain: gains.success, greatGain: gains.great });
    $("#fastDays").textContent = daysLabel(result.greatTotalDays);
    $("#fastDate").textContent = dateLabel(result.greatTotalDays);
    $("#slowDays").textContent = daysLabel(result.successTotalDays);
    $("#slowDate").textContent = dateLabel(result.successTotalDays);
    $("#rangeDays").textContent = result.greatTotalDays === Infinity || result.successTotalDays === Infinity ? "現在のプランでは到達できません" : `${result.greatTotalDays}～${result.successTotalDays}日`;
    const greatBottleneck = bottleneck(result.greatDays, result.greatTotalDays, result.activeIndexes, stock, targets);
    const successBottleneck = bottleneck(result.successDays, result.successTotalDays, result.activeIndexes, stock, targets);
    $("#greatBottleneck").textContent = greatBottleneck;
    $("#successBottleneck").textContent = successBottleneck;
    const sameBottleneck = greatBottleneck === successBottleneck;
    $("#greatBottleneckLabel").textContent = sameBottleneck ? "最後に貯まる資源" : "大成功時";
    $("#successBottleneckWrap").hidden = sameBottleneck;
    $("#resultBody").innerHTML = RESOURCE_NAMES.map((name, index) => {
      const target = targets[index];
      const deficit = target === null ? null : Math.max(0, target - stock[index]);
      return `<tr><th scope="row">${name}</th><td>${target === null ? "対象外" : formatNumber.format(target)}</td><td>${formatNumber.format(stock[index])}</td><td>${deficit === null ? "—" : formatNumber.format(deficit)}</td><td>${formatNumber.format(gains.success[index])}</td><td>${formatNumber.format(gains.great[index])}</td><td>${target === null ? "対象外" : daysLabel(result.successDays[index])}</td><td>${target === null ? "対象外" : daysLabel(result.greatDays[index])}</td></tr>`;
    }).join("");
    $("#mobileResultCards").innerHTML = RESOURCE_NAMES.map((name, index) => `<article class="mobile-resource-card"><h3>${name}</h3><dl><div><dt>目標</dt><dd>${targets[index] === null ? "対象外" : formatNumber.format(targets[index])}</dd></div><div><dt>現在</dt><dd>${formatNumber.format(stock[index])}</dd></div><div><dt>1日（成功）</dt><dd>${formatNumber.format(gains.success[index])}</dd></div><div><dt>1日（大成功）</dt><dd>${formatNumber.format(gains.great[index])}</dd></div><div><dt>日数（成功）</dt><dd>${targets[index] === null ? "対象外" : daysLabel(result.successDays[index])}</dd></div><div><dt>日数（大成功）</dt><dd>${targets[index] === null ? "対象外" : daysLabel(result.greatDays[index])}</dd></div></dl></article>`).join("");
    $("#greatArrivalLabel").textContent = dateLabel(result.greatTotalDays);
    $("#successArrivalLabel").textContent = dateLabel(result.successTotalDays);
    $("#greatArrivalDays").textContent = daysLabel(result.greatTotalDays);
    $("#successArrivalDays").textContent = daysLabel(result.successTotalDays);
    const comparison = createArrivalComparison(result.greatTotalDays, result.successTotalDays);
    $("#greatDurationText").textContent = daysLabel(result.greatTotalDays);
    $("#successDurationText").textContent = daysLabel(result.successTotalDays);
    $("#greatDurationBar").style.width = `${comparison.greatWidth}%`;
    $("#successDurationBar").style.width = `${comparison.successWidth}%`;
    if (comparison.extraDays === null) {
      $("#successArrivalBadge").textContent = "到達不可";
      $("#arrivalCompareNote").textContent = "現在のプランでは到達できない資源があります。";
    } else if (comparison.extraDays > 0) {
      $("#successArrivalBadge").textContent = `＋${comparison.extraDays}日分`;
      $("#arrivalCompareNote").textContent = `成功側は${comparison.extraDays}日長く貯めるため、到達時の所持数が多くなる場合があります。`;
    } else {
      $("#successArrivalBadge").textContent = "同じ日数";
      $("#arrivalCompareNote").textContent = "同じ日数で比較しています。";
    }
    renderFinalResources("#greatFinalResources", result.greatArrival, targets);
    renderFinalResources("#successFinalResources", result.successArrival, targets);
  }
  save();
}

function renderReference() {
  const query = $("#referenceSearch").value.trim().toLowerCase();
  const resourceFilter = { wood: 0, steel: 1, water: 2, stone: 3 };
  const rows = EXPEDITIONS.filter((item) => {
    const matchesText = !query || item.id.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    const matchesFilter = state.filter === "all" || (state.filter in resourceFilter && item.success[resourceFilter[state.filter]] > 0) || (state.filter === "koban" && item.koban > 0) || (state.filter === "request" && item.request > 0) || (state.filter === "help" && item.help > 0);
    return matchesText && matchesFilter;
  });
  $("#referenceCount").textContent = `${rows.length}件`;
  $("#referenceBody").innerHTML = rows.map((item) => {
    const resources = item.success.map((value, index) => `<td>${formatNumber.format(value)} / ${formatNumber.format(item.great[index])}</td>`).join("");
    return `<tr><td>${expeditionId(item.id)}</td><th scope="row">${item.name}</th><td>${formatDuration(item.minutes)}</td>${resources}<td>${item.koban || "—"}</td><td>${item.request || "—"}</td><td>${item.help || "—"}</td></tr>`;
  }).join("");
}

function refresh() { renderTeams(); calculate(); }
function closeToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  undoAction = null;
  const node = $("#toast");
  node.classList.remove("is-visible");
  node.replaceChildren();
}

function toast(message, undo = null) {
  clearTimeout(toastTimer);
  undoAction = undo;
  const node = $("#toast");
  node.replaceChildren();
  const text = document.createElement("span");
  text.textContent = message;
  node.append(text);
  if (undo) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "元に戻す";
    button.addEventListener("click", () => {
      const action = undoAction;
      closeToast();
      action?.();
    });
    node.append(button);
  }
  node.classList.add("is-visible");
  toastTimer = setTimeout(closeToast, undo ? 6000 : 2500);
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((tab) => { tab.classList.toggle("is-active", tab === button); tab.setAttribute("aria-selected", String(tab === button)); });
  document.querySelectorAll(".view").forEach((view) => { view.hidden = view.id !== button.dataset.view; });
  if (button.dataset.view === "referenceView") renderReference();
}));

$("#target700kBtn").addEventListener("click", () => { targetInputs.forEach((input) => { input.value = "700000"; }); calculate(); });
$("#clearTargetBtn").addEventListener("click", () => { targetInputs.forEach((input) => { input.value = ""; }); calculate(); });
$("#clearStockBtn").addEventListener("click", () => {
  const { previous, next } = clearStockValues(stockInputs.map((input) => input.value));
  stockInputs.forEach((input, index) => { input.value = next[index]; });
  calculate();
  toast("現在の資源を0にしました。", () => {
    stockInputs.forEach((input, index) => { input.value = previous[index]; });
    calculate();
  });
});
$("#dailyQuest").addEventListener("change", (event) => { state.dailyQuest = event.target.checked; calculate(); });
$("#teamCount").addEventListener("change", (event) => {
  const next = Number(event.target.value);
  const previousCount = state.teamCount;
  const previousTeams = cloneTeams(state.teams);
  if (next < state.teamCount) {
    for (let index = next; index < 5; index += 1) state.teams[index] = {};
  }
  state.teamCount = next; refresh();
  if (next < previousCount && previousTeams.slice(next, previousCount).some((team) => Object.keys(team).length)) {
    toast("外れた部隊の遠征を削除しました。", () => {
      state.teamCount = previousCount;
      state.teams = previousTeams;
      renderTeamCount();
      refresh();
    });
  }
});
[...stockInputs, ...targetInputs].forEach((input) => input.addEventListener("input", calculate));
$("#teams").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.clearTeam !== undefined) {
    const teamIndex = Number(button.dataset.clearTeam);
    const previousTeam = { ...state.teams[teamIndex] };
    state.teams[teamIndex] = {};
    refresh();
    toast("この部隊の遠征を削除しました。", () => {
      state.teams[teamIndex] = previousTeam;
      normalizeLimits();
      refresh();
    });
    return;
  }
  if (button.dataset.add !== undefined) {
    const teamIndex = Number(button.dataset.add); const id = button.previousElementSibling.value;
    if (id && canAdd(teamIndex, id)) state.teams[teamIndex][id] = (state.teams[teamIndex][id] || 0) + 1;
    else if (id) toast("部隊または同じ遠征先の24時間上限を超えます。");
  } else {
    const payload = button.dataset.plus || button.dataset.minus;
    if (!payload) return;
    const [teamIndexText, id] = payload.split(":"); const teamIndex = Number(teamIndexText);
    if (button.dataset.plus && canAdd(teamIndex, id)) state.teams[teamIndex][id] += 1;
    if (button.dataset.minus) { state.teams[teamIndex][id] -= 1; if (state.teams[teamIndex][id] <= 0) delete state.teams[teamIndex][id]; }
  }
  refresh();
});
$("#clearPlanBtn").addEventListener("click", () => {
  const previousTeams = cloneTeams(state.teams);
  state.teams = emptyTeams();
  refresh();
  toast("遠征プランを消去しました。", () => {
    state.teams = previousTeams;
    normalizeLimits();
    refresh();
  });
});
$("#referenceSearch").addEventListener("input", renderReference);
$("#referenceFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]"); if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-active", item === button)); renderReference();
});
$("#resetBtn").addEventListener("click", () => {
  if (!window.confirm("入力内容と保存データをすべてリセットしますか？")) return;
  localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(LEGACY_KEY); window.location.reload();
});

restore(); normalizeLimits(); renderTeamCount();
$("#dailyQuest").checked = state.dailyQuest;
refresh(); renderReference();
