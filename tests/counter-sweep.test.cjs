const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../counter-sweep.js');

function loadOpenCv() {
  const module = require('../vendor/opencv-4.13.0.js');
  return new Promise((resolve, reject) => module.then(cv => resolve({ cv }), reject));
}

test('counts a confirmed position once across intermittent detections', () => {
  const counter = new CounterSweep();
  const centers = Array.from({ length: 11 }, (_, index) => ({
    x: 125 + 68 * (index % 4), y: 270 + 69 * Math.floor(index / 4), radius: 30
  }));
  const counts = [];
  for (const [frame, shift] of [0, 5, 12, 20, 28].entries()) {
    const hits = centers.filter((_, index) => index || (frame !== 1 && frame !== 3));
    hits.push({ ...centers[1], x: centers[1].x + 3 });
    if (frame >= 3) hits.push({ ...centers[1], x: centers[1].x + 30 });
    counter.observe(hits, [1, 0, shift, 0, 1, 0, 0, 0, 1], 540, 960);
    counts.push(counter.count);
  }
  assert.deepEqual(counts, [0, 0, 11, 11, 11]);
  assert.equal(counter.tracks.length, 11);
});

test('stays at 11 in a generated sweep with a circular glare and an unalignable frame', { timeout: 20000 }, async () => {
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
    const counts = [];
    for (let index = 0; index < 5; index++) {
      const moved = new cv.Mat();
      const transform = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, 4 * index, 0, 1, 3 * index]);
      try {
        cv.warpAffine(scene, moved, transform, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REFLECT101);
        const result = counter.process(moved.data, width, height, options);
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
