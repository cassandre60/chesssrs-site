const assert = require('assert');
const {
  fsrsRetrievability,
  fsrsIntervalForTarget,
  fsrsInitialDifficulty,
  fsrsNextDifficulty,
  fsrsInitialStability,
  fsrsNextStabilitySuccess,
  fsrsNextStabilityLapse,
  ChessFsrsCard,
  DEFAULT_FSRS_PARAMS,
} = require('../engine.js');

console.log('Running FSRS Math and Scheduling unit tests...');

// 1. retrievability at t=0 and t=S
assert.strictEqual(fsrsRetrievability(0.0, 10.0), 1.0);
const rAtS = fsrsRetrievability(10.0, 10.0);
assert(Math.abs(rAtS - 0.9) < 0.001, `R(S, S) should be ~0.9, got ${rAtS}`);
assert(fsrsRetrievability(20.0, 10.0) < 0.9, 'R(2S, S) should be < 0.9');

// 2. interval for target
const ivl90 = fsrsIntervalForTarget(10.0, 0.90);
assert(Math.abs(ivl90 - 10.0) < 0.05, `Interval at 90% should equal S (10), got ${ivl90}`);
const ivl95 = fsrsIntervalForTarget(10.0, 0.95);
assert(ivl95 < ivl90, 'Higher target retention requires shorter intervals');
const ivl80 = fsrsIntervalForTarget(10.0, 0.80);
assert(ivl80 > ivl90, 'Lower target retention allows longer intervals');

// 3. initial difficulty
const dGood = fsrsInitialDifficulty('good');
assert(Math.abs(dGood - 4.93) < 0.01, `Initial D for good should be 4.93, got ${dGood}`);
const dAgain = fsrsInitialDifficulty('again');
assert(dAgain > dGood, 'Initial D for again should be higher than good');

// 4. card cold start
const card = new ChessFsrsCard('test-card');
const now = new Date('2026-09-18T12:00:00Z');
const res = card.schedule('good', now, 0.88);
assert.strictEqual(card.repetitionCount, 1);
assert.strictEqual(card.lapseCount, 0);
assert(Math.abs(card.stability - 2.20) < 0.01, `Initial stability should be 2.20, got ${card.stability}`);
assert(Math.abs(card.difficulty - 4.93) < 0.01, `Initial difficulty should be 4.93, got ${card.difficulty}`);
assert(res.intervalDays > 2.0 && res.intervalDays < 4.0, `Interval at 88% should be 2.0-4.0 days, got ${res.intervalDays}`);

// 5. same-day re-review
const tenMinLater = new Date(now.getTime() + 10 * 60 * 1000);
card.schedule('good', tenMinLater, 0.88);
assert(Math.abs(card.stability - (2.20 * 1.02)) < 0.01, `Same day stability should be multiplied by 1.02, got ${card.stability}`);

console.log('All FSRS math & scheduling tests PASSED!');
