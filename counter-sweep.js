"use strict";

(() => {
  const patchSize = 89;
  const patchCenter = (patchSize - 1) / 2;
  const minimumConfirmationTime = 350;
  const observationWindow = 7;
  const viewHistoryMs = 1200;
  const sampleX = new Float32Array(patchSize ** 2);
  const sampleY = new Float32Array(sampleX.length);
  const interior = [], rim = [], glare = [];
  for (let i = 0; i < sampleX.length; i++) {
    sampleX[i] = (i % patchSize - patchCenter) / 32;
    sampleY[i] = (Math.floor(i / patchSize) - patchCenter) / 32;
    const radius = Math.hypot(sampleX[i], sampleY[i]);
    if (radius > .11 && radius < .33) interior.push(i);
    if (radius > .73 && radius < 1.07) rim.push(i);
    if (radius < .55) glare.push(i);
  }
  const rays = Array.from({ length: 32 }, (_, ray) => {
    const angle = ray * Math.PI / 16;
    return Array.from({ length: 21 }, (_, step) => {
      const radius = 32 * (.35 + step * .05);
      const x = Math.round(patchCenter + Math.cos(angle) * radius);
      const y = Math.round(patchCenter + Math.sin(angle) * radius);
      return y * patchSize + x;
    });
  });

  function rimEvidence(pixels) {
    let supportedRays = 0, supportedSectors = 0;
    for (let sector = 0; sector < 4; sector++) {
      let supported = 0;
      for (let index = sector * 8; index < (sector + 1) * 8; index++) {
        const ray = rays[index];
        // A bright rim rises above both sides of the radial profile. A single
        // transition from a dark shadow to the table cannot provide that peak.
        for (let step = 5; step < 17; step++) {
          if (pixels[ray[step]] - Math.max(pixels[ray[step - 4]], pixels[ray[step + 4]]) < 5) continue;
          supported++;
          break;
        }
      }
      supportedRays += supported;
      supportedSectors += Number(supported >= 2);
    }
    if (supportedRays < 6 || supportedSectors < 2) return null;
    return { strong: supportedRays >= 10 && supportedSectors >= 3, rimSupport: supportedSectors * 8 + supportedRays };
  }

  function percentile(values, fraction) {
    values.sort((a, b) => a - b);
    return sortedPercentile(values, fraction);
  }

  function sortedPercentile(values, fraction) {
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

  function sweepRegion(width, height, inverse, workArea = null) {
    const corners = [[.07, .12], [.93, .12], [.93, .88], [.07, .88]];
    const points = workArea ?? corners.map(([x, y]) => ({ x: x * width, y: y * height }));
    const projected = points.map(point => project(point, inverse));
    if (projected.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;

    // Check the local scale across the work area. A homography fitted to
    // features on one side can fold or shrink the rest of the frame.
    const areas = points.map(point => areaScale(point, inverse));
    const smallest = Math.min(...areas), largest = Math.max(...areas);
    if (!(smallest > .12 && largest < 7 && largest <= 4 * smallest)) return null;
    return projected;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function closeTo(a, b, fraction = .82) {
    return distance(a, b) < fraction * Math.max(a.radius, b.radius);
  }

  function bottomsOverlap(a, b) {
    // In the reference view the circular fits can still overlap under tilt.
    // Require substantial overlap before treating two positions as one part.
    return distance(a, b) < .65 * (a.radius + b.radius);
  }

  function compareRims(a, b) {
    return Number(b.strong) - Number(a.strong) || b.rimSupport - a.rimSupport;
  }

  function distinctBottoms(hits, reference = null) {
    const distinct = [];
    const rank = hit => hit.rimSupport - (reference === null ? 0 : 32 * Math.abs(Math.log(hit.radius / reference)));
    for (const hit of hits.slice().sort((a, b) => Number(b.strong) - Number(a.strong) || rank(b) - rank(a))) {
      if (!distinct.some(other => bottomsOverlap(hit, other))) distinct.push(hit);
    }
    return distinct;
  }

  function typicalRadius(hits) {
    const strong = hits.filter(hit => hit.strong);
    const positions = distinctBottoms(strong);
    if (positions.length < 3) return null;
    const middle = percentile(positions.map(hit => hit.radius), .5);
    const matching = distinctBottoms(strong.filter(hit => hit.radius >= .8 * middle && hit.radius <= 1.2 * middle));
    return matching.length >= 3 && matching.length >= positions.length / 2
      ? percentile(matching.map(hit => hit.radius), .5) : null;
  }

  function fitsGroup(radius, typical) {
    // The rim of a tilted bottom looks smaller, especially near the image edge.
    return typical === null || (radius >= .69 * typical && radius <= 1.35 * typical);
  }

  function trackFrame(cv, previous, current, region = null) {
    const points = new cv.Mat(), forward = new cv.Mat(), back = new cv.Mat();
    const found = new cv.Mat(), returned = new cv.Mat(), error = new cv.Mat();
    let areaMask, polygon;
    try {
      if (region) {
        areaMask = cv.Mat.zeros(previous.rows, previous.cols, cv.CV_8UC1);
        polygon = cv.matFromArray(region.length, 1, cv.CV_32SC2,
          region.flatMap(point => [Math.round(point.x), Math.round(point.y)]));
        cv.fillConvexPoly(areaMask, polygon, new cv.Scalar(255));
        cv.goodFeaturesToTrack(previous, points, 500, .012, 5, areaMask);
      } else {
        cv.goodFeaturesToTrack(previous, points, 500, .012, 5);
      }
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
      areaMask?.delete(); polygon?.delete();
      points.delete(); forward.delete(); back.delete(); found.delete(); returned.delete(); error.delete();
    }
  }

  function cavityEvidence(cv, gray, hit, scratch) {
    const { mapX, mapY, patch, smooth, gx, gy, innerGradient, rimGradient } = scratch;
    const horizontal = mapX.data32F, vertical = mapY.data32F;
    for (let i = 0; i < sampleX.length; i++) {
      horizontal[i] = hit.x + hit.radius * sampleX[i];
      vertical[i] = hit.y + hit.radius * sampleY[i];
    }
    cv.remap(gray, patch, mapX, mapY, cv.INTER_LINEAR, cv.BORDER_REFLECT101);
    const pixels = patch.data;
    // A broad clipped center has no usable detail about the interior.
    let clipped = 0;
    for (const index of glare) if (pixels[index] >= 249 && ++clipped > .6 * glare.length) return null;
    const evidence = rimEvidence(pixels);
    if (!evidence) return null;
    patch.convertTo(smooth, cv.CV_32F);
    cv.GaussianBlur(smooth, smooth, new cv.Size(5, 5), .9);
    cv.Sobel(smooth, gx, cv.CV_32F, 1, 0, 3, .125);
    cv.Sobel(smooth, gy, cv.CV_32F, 0, 1, 3, .125);
    const dx = gx.data32F, dy = gy.data32F;
    for (let i = 0; i < interior.length; i++) innerGradient[i] = Math.hypot(dx[interior[i]], dy[interior[i]]);
    for (let i = 0; i < rim.length; i++) rimGradient[i] = Math.hypot(dx[rim[i]], dy[rim[i]]);
    innerGradient.sort();
    rimGradient.sort();
    return sortedPercentile(innerGradient, .85) < 1.15 * Math.max(.8, sortedPercentile(rimGradient, .8))
      ? evidence : null;
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
    const cavityScratch = {
      mapX: new cv.Mat(patchSize, patchSize, cv.CV_32FC1),
      mapY: new cv.Mat(patchSize, patchSize, cv.CV_32FC1),
      patch: new cv.Mat(), smooth: new cv.Mat(), gx: new cv.Mat(), gy: new cv.Mat(),
      innerGradient: new Float64Array(interior.length), rimGradient: new Float64Array(rim.length)
    };
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
          // Keep inner and outer fits of different sizes until the group scale
          // can help decide which boundary best represents the whole bottom.
          const existing = hits.findIndex(other => closeTo(hit, other) &&
            Math.min(hit.radius, other.radius) >= .8 * Math.max(hit.radius, other.radius));
          if (existing !== -1 && hits[existing].rimSupport === 64) continue;
          const evidence = cavityEvidence(cv, gray, hit, cavityScratch);
          if (!evidence) continue;
          const candidate = { ...hit, ...evidence };
          if (existing === -1) hits.push(candidate);
          else if (compareRims(candidate, hits[existing]) < 0) hits[existing] = candidate;
        }
      }
      return hits;
    } finally {
      crop.delete(); contrast.delete(); smooth.delete(); circles.delete(); polygon.delete(); clahe.delete();
      cavityScratch.mapX.delete(); cavityScratch.mapY.delete(); cavityScratch.patch.delete();
      cavityScratch.smooth.delete(); cavityScratch.gx.delete(); cavityScratch.gy.delete();
    }
  }

  class CounterSweep {
    constructor(cv) {
      this.cv = cv;
      this.transform = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      this.tracks = [];
      this.count = 0;
    }

    selectBottoms(hits, groupRadius = null) {
      const reference = groupRadius ?? typicalRadius(hits);
      return distinctBottoms(hits.filter(hit => fitsGroup(hit.radius, reference)), reference);
    }

    observe(hits, inverse, width, height, time, groupRadius = null) {
      const visible = ({ x, y }) => x >= 0 && y >= 0 && x < width && y < height;
      const pairs = [];
      this.tracks.forEach((track, trackIndex) => {
        track.visible = visible(project(track.center, inverse));
        if (track.visible && !track.confirmed) {
          const observations = track.observations;
          observations.push({ time, strong: false });
          // A faster worker must not shorten the time available to see the same part move.
          while (observations.length > observationWindow && time - observations[0].time > viewHistoryMs) {
            observations.shift();
          }
        }
        if (track.visible) hits.forEach((hit, hitIndex) => {
          if (closeTo(track.center, hit)) pairs.push({ trackIndex, hitIndex, gap: distance(track.center, hit) });
        });
      });
      const usedTracks = new Set(), usedHits = new Set();
      const ready = [];
      pairs.sort((a, b) => Number(hits[b.hitIndex].strong) - Number(hits[a.hitIndex].strong) || a.gap - b.gap);
      for (const { trackIndex, hitIndex } of pairs) {
        if (usedTracks.has(trackIndex) || usedHits.has(hitIndex)) continue;
        const track = this.tracks[trackIndex], hit = hits[hitIndex];
        usedTracks.add(trackIndex);
        usedHits.add(hitIndex);
        if (!hit.strong) continue;
        track.recent.push(hit);
        if (track.recent.length > 32) track.recent.shift();
        track.center = {
          x: percentile(track.recent.map(point => point.x), .5),
          y: percentile(track.recent.map(point => point.y), .5),
          radius: percentile(track.recent.map(point => point.radius), .5)
        };
        if (track.confirmed) continue;
        const view = project(track.initialCenter, inverse);
        Object.assign(track.observations.at(-1), { strong: true, view, rimSupport: hit.rimSupport });
        const recentObservations = track.observations.slice(-observationWindow);
        const strongViews = recentObservations.filter(observation => observation.strong);
        const first = strongViews[0];
        const variedView = track.observations.some(observation => observation.strong &&
          distance(observation.view, view) >= Math.max(4, .20 * hit.radius));
        const matchesConfirmedSize = groupRadius !== null && track.center.radius >= .8 * groupRadius &&
          track.center.radius <= 1.2 * groupRadius;
        const minimumShare = matchesConfirmedSize ? .42 : .5;
        if (strongViews.length >= 3 && time - first.time >= minimumConfirmationTime && variedView &&
            strongViews.length / recentObservations.length >= minimumShare) {
          ready.push({ track, quality: percentile(strongViews.map(observation => observation.rimSupport), .5) });
        }
      }
      for (const { track } of ready.sort((a, b) => b.quality - a.quality)) {
        if (this.tracks.some(other => other.confirmed && bottomsOverlap(other.center, track.center))) continue;
        track.confirmed = true;
        track.number = ++this.count;
        track.observations = [];
      }
      hits.forEach((hit, index) => {
        if (usedHits.has(index) || this.tracks.some(track => track.confirmed
          ? bottomsOverlap(track.center, hit) : closeTo(track.center, hit))) return;
        this.tracks.push({ center: hit, initialCenter: hit, recent: [hit], confirmed: false, visible: true,
          observations: [{ time, strong: hit.strong, view: project(hit, inverse), rimSupport: hit.rimSupport }] });
      });
    }

    process(pixels, width, height, { radiusRatio, sensitivity, calibratedSize = false, workArea = null, time = performance.now() }) {
      const cv = this.cv;
      const paused = { components: [], count: this.count, aligned: false };
      if (this.previous && (this.previous.cols !== width || this.previous.rows !== height)) return paused;
      const rgba = cv.matFromArray(height, width, cv.CV_8UC4, pixels);
      let gray = new cv.Mat();
      try {
        cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
        let transform = this.transform;
        if (this.previous) {
          const relative = trackFrame(cv, this.previous, gray, workArea ? this.previousRegion : null);
          transform = relative && multiply(transform, relative);
        }
        let inverse = transform && invert(transform);
        let region = inverse && sweepRegion(width, height, inverse, workArea);
        if (!region && this.reference) {
          transform = trackFrame(cv, this.reference, gray, workArea);
          inverse = transform && invert(transform);
          region = inverse && sweepRegion(width, height, inverse, workArea);
        }
        if (!region) return paused;
        const scale = Math.sqrt(areaScale({ x: width / 2, y: height / 2 }, inverse));
        if (!(scale >= .4 && scale <= 2.5)) return paused;
        const radius = Math.max(width, height) * radiusRatio * scale;
        const low = Math.max(5, Math.round(.65 * radius));
        const high = Math.max(low + 1, Math.round(1.33 * radius));
        const hits = findBottoms(cv, gray, region, low, high, sensitivity).map(hit => {
          const localScale = Math.sqrt(areaScale(hit, transform));
          return { ...hit, ...project(hit, transform), radius: hit.radius * localScale };
        }).filter(hit => Number.isFinite(hit.x) && Number.isFinite(hit.y) && Number.isFinite(hit.radius));
        const confirmed = this.tracks.filter(track => track.confirmed).map(track => ({ ...track.center, strong: true }));
        const groupRadius = typicalRadius(confirmed);
        const distinct = this.selectBottoms(hits, groupRadius);
        this.observe(distinct, inverse, width, height, time, calibratedSize ? groupRadius : null);
        this.transform = transform;
        // Do not anchor the sweep to an empty view: featureless paper cannot
        // support alignment when the camera later reaches the first pieces.
        // A manually selected work area still uses the original frame coordinates.
        if (this.reference || workArea || distinct.length) {
          if (!this.reference) this.reference = gray.clone();
          this.previous?.delete();
          this.previous = gray;
          this.previousRegion = region;
          gray = null;
        }
        const components = this.tracks.filter(track => track.confirmed && track.visible).map(track => {
          const { x, y } = project(track.center, inverse);
          const localScale = Math.sqrt(areaScale(track.center, inverse));
          const radius = track.center.radius * (Number.isFinite(localScale) && localScale > 0 ? localScale : scale);
          return { centerX: x, centerY: y, width: 2 * radius, height: 2 * radius, label: track.number };
        });
        return { components, count: this.count, aligned: true, region, detected: distinct.length };
      } finally {
        gray?.delete();
        rgba.delete();
      }
    }
  }

  globalThis.CounterSweep = CounterSweep;
  if (typeof module === "object" && module.exports) module.exports = { sweepRegion };
})();
