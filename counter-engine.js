/* Local image processing only. No image leaves the device. */
(function (root) {
  "use strict";

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function brightnessThreshold(histogram, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let count = 0, partial = 0, best = 0, threshold = 0;
    for (let i = 0; i < 255; i++) {
      count += histogram[i];
      partial += i * histogram[i];
      if (!count || count === total) continue;
      const difference = partial / count - (sum - partial) / (total - count);
      const variance = count * (total - count) * difference * difference;
      if (variance > best) { best = variance; threshold = i; }
    }
    return threshold;
  }

  function detect(pixels, width, height, sensitivity = 55, size = 35, calibration = null) {
    const total = width * height;
    if (!total || pixels.length !== total * 4) return [];
    const mask = new Uint8Array(total);
    const lights = new Uint8Array(total);
    const histogram = new Uint32Array(256);
    const minimumLight = 120 - sensitivity * 0.9;
    let occupied = 0;
    for (let i = 0; i < total; i++) {
      const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
      const light = r * .299 + g * .587 + b * .114;
      lights[i] = light;
      histogram[lights[i]]++;
      let matches;
      if (calibration) {
        const sum = r + g + b;
        const dr = r / sum - calibration.color.red;
        const dg = g / sum - calibration.color.green;
        const db = b / sum - calibration.color.blue;
        matches = sum >= 50 && light >= calibration.minimumLight &&
          dr * dr + dg * dg + db * db <= calibration.tolerance ** 2;
      } else {
        matches = light >= minimumLight && r - g <= -2 + sensitivity * .16 && g - b <= 16 + sensitivity * .32;
      }
      if (matches) { mask[i] = 1; occupied++; }
    }

    // Neutral dark upholstery can satisfy the plastic colour test over nearly
    // the whole image. Separate brightness classes only in that situation.
    if (occupied > total * .25) {
      const threshold = brightnessThreshold(histogram, total);
      if (threshold > minimumLight + 15) {
        for (let i = 0; i < total; i++) if (lights[i] <= threshold) mask[i] = 0;
      }
    }

    // Fill enclosed holes (axles, grooves) but never bridge exterior gaps.
    const queue = new Int32Array(total);
    const exterior = new Uint8Array(total);
    let head = 0, tail = 0;
    function visitExterior(i) {
      if (!mask[i] && !exterior[i]) { exterior[i] = 1; queue[tail++] = i; }
    }
    for (let x = 0; x < width; x++) { visitExterior(x); visitExterior((height - 1) * width + x); }
    for (let y = 0; y < height; y++) { visitExterior(y * width); visitExterior(y * width + width - 1); }
    while (head < tail) {
      const i = queue[head++], x = i % width;
      if (x) visitExterior(i - 1);
      if (x + 1 < width) visitExterior(i + 1);
      if (i >= width) visitExterior(i - width);
      if (i + width < total) visitExterior(i + width);
    }
    for (let i = 0; i < total; i++) if (!exterior[i]) mask[i] = 1;

    const distance = distanceMap(mask, width, height);
    const labels = new Int32Array(total);
    const components = [];
    const minimumArea = Math.max(8, Math.round(total * (.00005 + size * .0000082)));
    let label = 0;
    for (let start = 0; start < total; start++) {
      if (!mask[start] || labels[start]) continue;
      label++;
      head = 0; tail = 1; queue[0] = start; labels[start] = label;
      let left = width, right = 0, top = height, bottom = 0, radius = 0, peak = start;
      function visit(i) {
        if (mask[i] && !labels[i]) { labels[i] = label; queue[tail++] = i; }
      }
      while (head < tail) {
        const i = queue[head++], x = i % width, y = (i / width) | 0;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        if (distance[i] > radius) { radius = distance[i]; peak = i; }
        if (x) visit(i - 1);
        if (x + 1 < width) visit(i + 1);
        if (y) visit(i - width);
        if (y + 1 < height) visit(i + width);
      }
      const w = right - left + 1, h = bottom - top + 1;
      if (tail < minimumArea || tail > total * .16 || Math.min(w,h) < 5 || Math.max(w,h) / Math.min(w,h) > 3.1) continue;
      if ((left === 0 || right === width - 1) && (top === 0 || bottom === height - 1)) continue;
      components.push({x:left,y:top,width:w,height:h,area:tail,radius,peak,label});
    }
    const typicalRadius = calibration
      ? Math.max(3, Math.min(calibration.expectedWidth, calibration.expectedHeight) * .4)
      : median(components.map(c => c.radius));
    const result = [];
    for (const component of components) {
      const peaks = [];
      const threshold = Math.max(2, component.radius * .4);
      for (let y = component.y; y < component.y + component.height; y++) {
        for (let x = component.x; x < component.x + component.width; x++) {
          const i = y * width + x, score = distance[i];
          if (labels[i] !== component.label || score < threshold) continue;
          let maximum = true;
          for (let yy = Math.max(0,y-2); yy <= Math.min(height-1,y+2) && maximum; yy++) {
            for (let xx = Math.max(0,x-2); xx <= Math.min(width-1,x+2); xx++) {
              if (distance[yy * width + xx] > score + .01) { maximum = false; break; }
            }
          }
          if (maximum) peaks.push({x,y,score});
        }
      }
      peaks.sort((a,b) => b.score - a.score || a.y - b.y || a.x - b.x);
      // A small object must not multiply into ten centres. The area and the
      // strongest interior radius bound the number of plausible lobes.
      const cap = Math.max(1, Math.floor(component.area / (Math.PI * component.radius ** 2 * .8)));
      const selected = [];
      for (const peak of peaks) {
        if (selected.length >= cap) break;
        if (selected.length && peak.score < Math.max(2.5, typicalRadius * .4)) continue;
        const conflict = selected.some(other => {
          const spacing = Math.max(typicalRadius * 1.05, (peak.score + other.score) * .85);
          if ((peak.x-other.x)**2 + (peak.y-other.y)**2 < spacing**2) return true;
          // A genuine pair has a narrow neck between its two broad interiors.
          const steps = Math.max(Math.abs(peak.x-other.x),Math.abs(peak.y-other.y));
          let neck = Infinity;
          for (let n = 0; n <= steps; n++) {
            const x = Math.round(peak.x+(other.x-peak.x)*n/steps);
            const y = Math.round(peak.y+(other.y-peak.y)*n/steps);
            neck = Math.min(neck, distance[y*width+x]);
          }
          return neck > Math.min(peak.score,other.score)*.65;
        });
        if (!conflict) selected.push(peak);
      }
      if (!selected.length) selected.push({x:component.peak%width,y:(component.peak/width)|0,score:component.radius});
      for (const peak of selected) {
        const diameter = Math.max(8, peak.score * 2);
        result.push({x:peak.x-diameter/2,y:peak.y-diameter/2,width:diameter,height:diameter,centerX:peak.x,centerY:peak.y,area:component.area/selected.length,weight:1});
      }
    }
    return result;
  }

  function distanceMap(mask,width,height) {
    const d = new Float32Array(mask.length), diagonal = Math.SQRT2;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const i=y*width+x;
      if(!mask[i]) continue;
      let value=Math.min(x+1,y+1,width-x,height-y);
      if(x) value=Math.min(value,d[i-1]+1);
      if(y) value=Math.min(value,d[i-width]+1);
      if(x&&y) value=Math.min(value,d[i-width-1]+diagonal);
      if(x+1<width&&y) value=Math.min(value,d[i-width+1]+diagonal);
      d[i]=value;
    }
    for(let y=height-1;y>=0;y--) for(let x=width-1;x>=0;x--) {
      const i=y*width+x;
      if(!mask[i]) continue;
      let value=d[i];
      if(x+1<width)value=Math.min(value,d[i+1]+1);
      if(y+1<height)value=Math.min(value,d[i+width]+1);
      if(x+1<width&&y+1<height)value=Math.min(value,d[i+width+1]+diagonal);
      if(x&&y+1<height)value=Math.min(value,d[i+width-1]+diagonal);
      d[i]=value;
    }
    return d;
  }

  const api={detect};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.CounterDetector=api;
})(typeof self !== 'undefined' ? self : globalThis);
