"use strict";
importScripts("counter-engine.js?v=923");
self.onmessage = function (event) {
  const { pixels, width, height, sensitivity, size, calibration } = event.data;
  try {
    const components = self.CounterDetector.detect(pixels, width, height, sensitivity, size, calibration);
    self.postMessage({ components, width, height });
  } catch (error) {
    self.postMessage({ error: "detection-failed" });
  }
};
