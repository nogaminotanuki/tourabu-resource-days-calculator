import assert from "node:assert/strict";
import { calculateProjection, requiredDays, MAX_RESOURCE } from "./calculation-core.js";
import { cloneTeams, createStoragePayload, expeditionClass, parseStoredPayload } from "./ui-core.js";

assert.equal(requiredDays(200_000, 700_000, 30_000), 17);
assert.equal(requiredDays(700_000, 700_000, 0), 0);
assert.equal(requiredDays(0, 1, 0), Infinity);
assert.equal(requiredDays(0, null, 0), null);

const multiple = calculateProjection({ stock: [0, 0, 0, 0], targets: [100, 250, 90, null], successGain: [50, 50, 30, 999], greatGain: [75, 75, 45, 999] });
assert.equal(multiple.successTotalDays, 5);
assert.equal(multiple.greatTotalDays, 4);
assert.deepEqual(multiple.successArrival, [250, 250, 150, 4_995]);
assert.deepEqual(multiple.greatArrival, [300, 300, 180, 3_996]);
assert.ok(multiple.greatTotalDays <= multiple.successTotalDays);

const one = calculateProjection({ stock: [999_999, 200_000, 0, 0], targets: [null, 700_000, null, null], successGain: [0, 21_000, 0, 0], greatGain: [0, 31_500, 0, 0] });
assert.equal(one.successTotalDays, 24);
assert.equal(one.greatTotalDays, 16);

const unreachable = calculateProjection({ stock: [0, 0, 0, 0], targets: [1, null, null, null], successGain: [0, 100, 100, 100], greatGain: [0, 150, 150, 150] });
assert.equal(unreachable.successTotalDays, Infinity);
assert.equal(unreachable.greatTotalDays, Infinity);
assert.equal(unreachable.successArrival, null);

const capped = calculateProjection({ stock: [MAX_RESOURCE - 1, 0, 0, 0], targets: [MAX_RESOURCE, null, null, null], successGain: [50, 0, 0, 0], greatGain: [75, 0, 0, 0] });
assert.equal(capped.successArrival[0], MAX_RESOURCE);

const plans = [{ A1: 2 }, { B3: 1 }, { C4: 3 }, {}, {}];
const snapshot = cloneTeams(plans);
plans[0] = {};
assert.deepEqual(plans[1], { B3: 1 });
assert.deepEqual(snapshot[0], { A1: 2 });
assert.notEqual(snapshot[1], plans[1]);

assert.deepEqual(["A1", "B2", "C3", "D4", "E1"].map(expeditionClass), [
  "expedition-a", "expedition-b", "expedition-c", "expedition-d", "expedition-e",
]);
assert.equal(expeditionClass("Z9"), "");

const saved = createStoragePayload({
  stock: ["0", "200000", "0", "0"], targets: ["", "700000", "", ""],
  dailyQuest: true, teamCount: 3, teams: snapshot,
});
const restored = parseStoredPayload(JSON.stringify(saved), null);
assert.deepEqual(restored, saved);
assert.equal(parseStoredPayload("{broken", JSON.stringify(saved)).teamCount, 3);

console.log("計算・UI状態テスト: 22項目すべて成功");
