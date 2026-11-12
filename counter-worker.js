"use strict";
importScripts("counter-engine.js?v=927");

let sweepReady;
function loadSweep() {
  if (!sweepReady) {
    importScripts("counter-sweep.js?v=927", "vendor/opencv-4.13.0.js");
    sweepReady = new Promise((resolve, reject) => {
      const initialize = cv => resolve(new self.CounterSweep(cv));
      if (self.cv.Mat) initialize(self.cv);
      else self.cv.then(initialize, reject);
    });
  }
  return sweepReady;
}

self.onmessage = async function (event) {
  const { pixels, width, height, sensitivity, size, calibration, sweep } = event.data;
  try {
    if (sweep) {
      const counter = await loadSweep();
      self.postMessage({ ...counter.process(pixels, width, height, { ...sweep, sensitivity }), width, height });
      return;
    }
    const components = self.CounterDetector.detect(pixels, width, height, sensitivity, size, calibration);
    self.postMessage({ components, width, height });
  } catch (error) {
    self.postMessage({ error: "detection-failed" });
  }
};
