"use strict";

(() => {
  const patchSize = 81;
  const sampleX = new Float32Array(patchSize ** 2);
  const sampleY = new Float32Array(sampleX.length);
  const interior = [], rim = [], glare = [];
  for (let i = 0; i < sampleX.length; i++) {
    sampleX[i] = (i % patchSize - 40) / 32;
    sampleY[i] = (Math.floor(i / patchSize) - 40) / 32;
    const radius = Math.hypot(sampleX[i], sampleY[i]);
    if (radius > .11 && radius < .33) interior.push(i);
    if (radius > .73 && radius < 1.07) rim.push(i);
    if (radius < .55) glare.push(i);
  }

  function percentile(values, fraction) {
    values.sort((a, b) => a - b);
    const index = (values.length - 1) * fraction;
    const low = Math.floor(index);
    return values[low] + (values[Math.ceil(index)] - values[low]) * (index - low);
  }

  function project({ x, y }, matrix) {
    const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
    return {
      x: (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
      y: (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator
    };
  }

  function multiply(a, b) {
    return a.map((_, i) => {
      const row = 3 * Math.floor(i / 3), column = i % 3;
      return a[row] * b[column] + a[row + 1] * b[column + 3] + a[row + 2] * b[column + 6];
    });
  }

  function invert([a, b, c, d, e, f, g, h, i]) {
    const inverse = [e * i - f * h, c * h - b * i, b * f - c * e,
      f * g - d * i, a * i - c * g, c * d - a * f,
      d * h - e * g, b * g - a * h, a * e - b * d];
    const determinant = a * inverse[0] + b * inverse[3] + c * inverse[6];
    return Math.abs(determinant) > 1e-8 ? inverse.map(value => value / determinant) : null;
  }

  function areaScale(center, transform) {
    const origin = project(center, transform);
    const right = project({ x: center.x + 20, y: center.y }, transform);
    const down = project({ x: center.x, y: center.y + 20 }, transform);
    return ((right.x - origin.x) * (down.y - origin.y) - (right.y - origin.y) * (down.x - origin.x)) / 400;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function closeTo(a, b, fraction = .82) {
    return distance(a, b) < fraction * Math.max(a.radius, b.radius);
  }

  function trackFrame(cv, previous, current) {
    const points = new cv.Mat(), forward = new cv.Mat(), back = new cv.Mat();
    const found = new cv.Mat(), returned = new cv.Mat(), error = new cv.Mat();
    try {
      cv.goodFeaturesToTrack(previous, points, 500, .012, 5);
      if (points.rows < 12) return null;
      cv.calcOpticalFlowPyrLK(previous, current, points, forward, found, error);
      cv.calcOpticalFlowPyrLK(current, previous, forward, back, returned, error);
      const source = [], target = [];
      for (let i = 0; i < points.rows; i++) {
        if (!found.data[i] || !returned.data[i]) continue;
        const at = i * 2;
        const x = points.data32F[at], y = points.data32F[at + 1];
        if (Math.hypot(x - back.data32F[at], y - back.data32F[at + 1]) >= 1.4) continue;
        source.push(forward.data32F[at], forward.data32F[at + 1]);
        target.push(x, y);
      }
      if (source.length < 24) return null;
      const from = cv.matFromArray(source.length / 2, 1, cv.CV_32FC2, source);
      const to = cv.matFromArray(target.length / 2, 1, cv.CV_32FC2, target);
      const mask = new cv.Mat();
      let homography;
      try {
        homography = cv.findHomography(from, to, cv.RANSAC, 2.5, mask);
        if (homography.empty()) return null;
        let count = 0, xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
        for (let i = 0; i < mask.rows; i++) {
          if (!mask.data[i]) continue;
          const x = source[i * 2], y = source[i * 2 + 1];
          count++;
          xMin = Math.min(xMin, x); xMax = Math.max(xMax, x);
          yMin = Math.min(yMin, y); yMax = Math.max(yMax, y);
        }
        if (count < 12 || count / from.rows < .48 || Math.min(xMax - xMin, yMax - yMin) < 35) return null;
        const matrix = Array.from(homography.data64F);
        const scale = areaScale({ x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 }, matrix);
        return scale > .35 && scale < 2.8 ? matrix : null;
      } finally {
        homography?.delete(); from.delete(); to.delete(); mask.delete();
      }
    } finally {
      points.delete(); forward.delete(); back.delete(); found.delete(); returned.delete(); error.delete();
    }
  }

  function hasCavity(cv, gray, hit) {
    const mapX = new cv.Mat(patchSize, patchSize, cv.CV_32FC1);
    const mapY = new cv.Mat(patchSize, patchSize, cv.CV_32FC1);
    const patch = new cv.Mat(), smooth = new cv.Mat(), gx = new cv.Mat(), gy = new cv.Mat();
    try {
      const horizontal = mapX.data32F, vertical = mapY.data32F;
      for (let i = 0; i < sampleX.length; i++) {
        horizontal[i] = hit.x + hit.radius * sampleX[i];
        vertical[i] = hit.y + hit.radius * sampleY[i];
      }
      cv.remap(gray, patch, mapX, mapY, cv.INTER_LINEAR, cv.BORDER_REFLECT101);
      const pixels = patch.data;
      // A broad clipped center has no usable detail about the interior.
      if (glare.filter(index => pixels[index] >= 249).length > .6 * glare.length) return false;
      patch.convertTo(smooth, cv.CV_32F);
      cv.GaussianBlur(smooth, smooth, new cv.Size(5, 5), .9);
      cv.Sobel(smooth, gx, cv.CV_32F, 1, 0, 3, .125);
      cv.Sobel(smooth, gy, cv.CV_32F, 0, 1, 3, .125);
      const dx = gx.data32F, dy = gy.data32F;
      const magnitude = index => Math.hypot(dx[index], dy[index]);
      return percentile(interior.map(magnitude), .85) < 1.15 * Math.max(.8, percentile(rim.map(magnitude), .8));
    } finally {
      mapX.delete(); mapY.delete(); patch.delete(); smooth.delete(); gx.delete(); gy.delete();
    }
  }

  function findBottoms(cv, gray, region, low, high, sensitivity) {
    const x0 = Math.max(0, Math.floor(Math.min(...region.map(p => p.x)) - high));
    const y0 = Math.max(0, Math.floor(Math.min(...region.map(p => p.y)) - high));
    const x1 = Math.min(gray.cols, Math.ceil(Math.max(...region.map(p => p.x)) + high));
    const y1 = Math.min(gray.rows, Math.ceil(Math.max(...region.map(p => p.y)) + high));
    if (Math.min(x1 - x0, y1 - y0) < 2 * low) return [];
    const crop = gray.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
    const contrast = new cv.Mat(), smooth = new cv.Mat(), circles = new cv.Mat();
    const polygon = cv.matFromArray(region.length, 1, cv.CV_32FC2, region.flatMap(p => [p.x, p.y]));
    const clahe = new cv.CLAHE(2, new cv.Size(5, 5));
    try {
      const hits = [];
      clahe.apply(crop, contrast);
      for (const image of [crop, contrast]) {
        cv.GaussianBlur(image, smooth, new cv.Size(5, 5), 1);
        const threshold = Math.round(22 + (55 - sensitivity) * .15);
        cv.HoughCircles(smooth, circles, cv.HOUGH_GRADIENT, 1, 1.55 * low, 85, threshold, low, high);
        const data = Array.from(circles.data32F);
        for (let i = 0; i + 2 < data.length; i += 3) {
          const hit = { x: data[i] + x0, y: data[i + 1] + y0, radius: data[i + 2] };
          if (cv.pointPolygonTest(polygon, new cv.Point(hit.x, hit.y), false) < 0) continue;
          if (!hits.some(other => closeTo(hit, other)) && hasCavity(cv, gray, hit)) hits.push(hit);
        }
      }
      return hits;
    } finally {
      crop.delete(); contrast.delete(); smooth.delete(); circles.delete(); polygon.delete(); clahe.delete();
    }
  }

  class CounterSweep {
    constructor(cv) {
      this.cv = cv;
      this.transform = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      this.tracks = [];
      this.count = 0;
    }

    observe(hits, inverse, width, height) {
      const visible = ({ x, y }) => x >= 0 && y >= 0 && x < width && y < height;
      const pairs = [];
      this.tracks.forEach((track, trackIndex) => {
        track.visible = visible(project(track.center, inverse));
        track.samples += Number(track.visible);
        if (track.visible) hits.forEach((hit, hitIndex) => {
          if (closeTo(track.center, hit)) pairs.push({ trackIndex, hitIndex, gap: distance(track.center, hit) });
        });
      });
      const usedTracks = new Set(), usedHits = new Set();
      for (const { trackIndex, hitIndex } of pairs.sort((a, b) => a.gap - b.gap)) {
        if (usedTracks.has(trackIndex) || usedHits.has(hitIndex)) continue;
        const track = this.tracks[trackIndex], hit = hits[hitIndex];
        usedTracks.add(trackIndex);
        usedHits.add(hitIndex);
        track.seen++;
        track.recent.push(hit);
        if (track.recent.length > 32) track.recent.shift();
        track.center = {
          x: percentile(track.recent.map(point => point.x), .5),
          y: percentile(track.recent.map(point => point.y), .5),
          radius: percentile(track.recent.map(point => point.radius), .5)
        };
        const moved = distance(project(track.firstCenter, inverse), track.firstView) >= Math.max(4, .20 * hit.radius);
        track.variedView ||= moved;
        if (!track.confirmed && track.variedView && track.seen / track.samples >= .55) {
          track.confirmed = true;
          track.number = ++this.count;
        }
      }
      hits.forEach((hit, index) => {
        if (usedHits.has(index) || this.tracks.some(track => closeTo(track.center, hit, track.confirmed ? 1.05 : .82))) return;
        this.tracks.push({ center: hit, recent: [hit], firstCenter: hit, firstView: project(hit, inverse),
          seen: 1, samples: 1, confirmed: false, variedView: false, visible: true });
      });
    }

    process(pixels, width, height, { radiusRatio, sensitivity }) {
      const cv = this.cv;
      const paused = { components: [], count: this.count, aligned: false };
      if (this.previous && (this.previous.cols !== width || this.previous.rows !== height)) return paused;
      const rgba = cv.matFromArray(height, width, cv.CV_8UC4, pixels);
      let gray = new cv.Mat();
      try {
        cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
        let transform = this.transform;
        if (this.previous) {
          const relative = trackFrame(cv, this.previous, gray);
          transform = relative ? multiply(transform, relative) : trackFrame(cv, this.reference, gray);
          if (!transform) return paused;
        }
        const inverse = invert(transform);
        if (!inverse) return paused;
        const scale = Math.sqrt(areaScale({ x: width / 2, y: height / 2 }, inverse));
        if (!(scale >= .4 && scale <= 2.5)) return paused;
        const region = [[.07, .12], [.93, .12], [.93, .88], [.07, .88]]
          .map(([x, y]) => project({ x: x * width, y: y * height }, inverse));
        if (region.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return paused;
        const radius = Math.max(width, height) * radiusRatio * scale;
        const low = Math.max(5, Math.round(.65 * radius));
        const high = Math.max(low + 1, Math.round(1.33 * radius));
        const hits = findBottoms(cv, gray, region, low, high, sensitivity);
        this.observe(hits.map(hit => ({ ...project(hit, transform), radius: hit.radius / scale })), inverse, width, height);
        this.transform = transform;
        if (!this.reference) this.reference = gray.clone();
        this.previous?.delete();
        this.previous = gray;
        gray = null;
        const components = this.tracks.filter(track => track.confirmed && track.visible).map(track => {
          const { x, y } = project(track.center, inverse);
          const radius = track.center.radius * scale;
          return { centerX: x, centerY: y, width: 2 * radius, height: 2 * radius, label: track.number };
        });
        return { components, count: this.count, aligned: true, region, detected: hits.length };
      } finally {
        gray?.delete();
        rgba.delete();
      }
    }
  }

  globalThis.CounterSweep = CounterSweep;
})();
