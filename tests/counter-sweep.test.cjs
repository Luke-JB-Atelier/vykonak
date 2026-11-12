const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sweepRegion } = require('../counter-sweep.js');

function loadOpenCv() {
  const module = require('../vendor/opencv-4.13.0.js');
  return new Promise((resolve, reject) => module.then(cv => resolve({ cv }), reject));
}

test('rejects a warped work area while allowing ordinary camera movement', () => {
  assert.ok(sweepRegion(960, 720, [1, 0, 90, 0, 1, -20, 0, 0, 1]));
  assert.ok(sweepRegion(960, 720, [1.05, 0, 20, .05, 1, 12, .0002, 0, 1]));
  assert.equal(sweepRegion(960, 720, [1, 0, 0, 0, 1, 0, .002, 0, 1]), null);
  assert.equal(sweepRegion(960, 720, [-1, 0, 960, 0, 1, 0, 0, 0, 1]), null);
  const collapsed = [.56122, -.20216, 132.179, .02394, .09058, 231.291, .0000861, -.0007696, 1];
  assert.equal(sweepRegion(960, 718, collapsed), null);
});

test('counts a confirmed position once across intermittent detections', () => {
  const counter = new CounterSweep();
  const centers = Array.from({ length: 11 }, (_, index) => ({
    x: 125 + 68 * (index % 4), y: 270 + 69 * Math.floor(index / 4), radius: 30, strong: true, rimSupport: 60
  }));
  const counts = [];
  for (const [frame, shift] of [0, 5, 12, 20, 28, 35, 41].entries()) {
    const hits = centers.filter((_, index) => index || (frame >= 3 && frame !== 6));
    hits.push({ ...centers[1], x: centers[1].x + 3 });
    if (frame >= 3) hits.push({ ...centers[1], x: centers[1].x + 30, strong: false });
    counter.observe(hits, [1, 0, shift, 0, 1, 0, 0, 0, 1], 540, 960, frame * 200);
    counts.push(counter.count);
  }
  assert.deepEqual(counts, [0, 0, 10, 10, 10, 11, 11]);
  assert.equal(counter.tracks.length, 11);
});

test('a close candidate that started before its neighbor confirmed cannot be counted twice', () => {
  const counter = new CounterSweep();
  const bottom = { x: 180, y: 310, radius: 30, strong: true, rimSupport: 60 };
  const duplicate = { ...bottom, x: 209 };
  for (let frame = 0; frame < 5; frame++) {
    const hits = frame === 0 ? [bottom] : [bottom, duplicate];
    counter.observe(hits, [1, 0, frame * 5, 0, 1, 0, 0, 0, 1], 540, 960, frame * 200);
  }
  assert.equal(counter.tracks.length, 2);
  assert.equal(counter.count, 1);
});

test('deep overlap favors the stronger rim and still counts a touching neighbor', () => {
  const counter = new CounterSweep();
  const bottom = { x: 180, y: 310, radius: 30, strong: true, rimSupport: 58 };
  const overlapping = { ...bottom, x: 146, rimSupport: 37 };
  const neighbor = { ...bottom, x: 232 };
  for (let frame = 0; frame < 5; frame++) {
    counter.observe([overlapping, bottom, neighbor], [1, 0, frame * 5, 0, 1, 0, 0, 0, 1], 540, 960, frame * 200);
  }
  assert.deepEqual(counter.tracks.filter(track => track.confirmed).map(track => track.center.x), [180, 232]);
  assert.equal(counter.count, 2);
});

test('group size rejects an inner ring and an oversized gap while retaining a tilted bottom', () => {
  const counter = new CounterSweep();
  const bottom = { x: 140, y: 300, radius: 30, strong: true, rimSupport: 56 };
  const hits = [
    { ...bottom, x: 142, radius: 16, rimSupport: 64 },
    bottom,
    { ...bottom, x: 193, radius: 29 },
    { ...bottom, x: 246, radius: 31 },
    { ...bottom, x: 295, radius: 22 },
    { ...bottom, x: 360, radius: 45 },
    { ...bottom, x: 445, radius: 15 }
  ];
  assert.deepEqual(counter.selectBottoms(hits).map(hit => hit.x).sort((a, b) => a - b), [140, 193, 246, 295]);
  assert.deepEqual(counter.selectBottoms([hits.at(-1)]), [hits.at(-1)]);
});

test('intermittent rim evidence gets extra tolerance only at the confirmed group size', () => {
  const counter = new CounterSweep();
  const candidate = { x: 140, y: 300, radius: 30, strong: true, rimSupport: 52 };
  const undersized = { ...candidate, x: 260, radius: 22 };
  for (let frame = 0; frame < 7; frame++) {
    const strong = [0, 3, 6].includes(frame);
    const hits = [candidate, undersized].map(hit => ({ ...hit, strong }));
    counter.observe(hits, [1, 0, frame * 4, 0, 1, 0, 0, 0, 1], 540, 960, frame * 160, 30);
  }
  assert.deepEqual(counter.tracks.filter(track => track.confirmed).map(track => track.center.x), [140]);
});

test('stays at 11 in a generated sweep with glare, a cast shadow and an unalignable frame', { timeout: 20000 }, async () => {
  const { cv } = await loadOpenCv();
  const width = 540, height = 960;
  const gray = value => new cv.Scalar(value, value, value, 255);
  const scene = new cv.Mat(height, width, cv.CV_8UC4, gray(188));
  const counter = new CounterSweep(cv);
  const options = { radiusRatio: .035, sensitivity: 55 };
  try {
    for (let index = 0; index < 11; index++) {
      const x = 166 + 66 * (index % 4), y = 370 + 65 * Math.floor(index / 4);
      const center = new cv.Point(x, y);
      cv.circle(scene, center, 32, gray(104), -1);
      cv.circle(scene, center, 29, gray(226), -1);
      cv.circle(scene, center, 21, gray(158), -1);
      cv.circle(scene, center, 2, gray(65), -1);
    }
    cv.circle(scene, new cv.Point(85, 452), 30, gray(255), -1);
    cv.circle(scene, new cv.Point(104, 370), 32, gray(87), -1);
    cv.ellipse(scene, new cv.Point(232, 370), new cv.Size(21, 15), 14, 20, 190, gray(92), 3);
    const counts = [];
    for (let index = 0; index < 5; index++) {
      const moved = new cv.Mat();
      const transform = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, 4 * index, 0, 1, 3 * index]);
      try {
        cv.warpAffine(scene, moved, transform, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REFLECT101);
        const result = counter.process(moved.data, width, height, { ...options, time: index * 200 });
        assert.equal(result.aligned, true);
        assert.equal(result.detected, 11);
        counts.push(result.count);
        if (result.count === 11) {
          assert.equal(new Set(result.components.map(component => component.label)).size, 11);
        }
      } finally {
        moved.delete(); transform.delete();
      }
    }
    assert.deepEqual(counts, [0, 0, 11, 11, 11]);
    const blank = new cv.Mat(height, width, cv.CV_8UC4, gray(188));
    try {
      assert.deepEqual(counter.process(blank.data, width, height, options), { components: [], count: 11, aligned: false });
    } finally {
      blank.delete();
    }
  } finally {
    scene.delete(); counter.previous?.delete(); counter.reference?.delete();
  }
});
