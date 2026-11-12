"use strict";
let sweepReady;
function loadSweep() {
  if (!sweepReady) {
    importScripts("counter-sweep.js?v=928", "vendor/opencv-4.13.0.js");
    sweepReady = new Promise((resolve, reject) => {
      const initialize = cv => resolve(new self.CounterSweep(cv));
      if (self.cv.Mat) initialize(self.cv);
      else self.cv.then(initialize, reject);
    });
  }
  return sweepReady;
}

self.onmessage = async function (event) {
  const { pixels, width, height, sensitivity, radiusRatio, time } = event.data;
  try {
    const counter = await loadSweep();
    self.postMessage({ ...counter.process(pixels, width, height, { radiusRatio, sensitivity, time }), width, height });
  } catch (error) {
    self.postMessage({ error: "detection-failed" });
  }
};
