const {test} = require('node:test');
const assert = require('node:assert/strict');
const {detect,calibrate} = require('../counter-engine.js');

function scene(disks=[], background=[90,90,90]) {
  const width=200,height=150,pixels=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    let color=background;
    for(const d of disks)if((x-d.x)**2+(y-d.y)**2<=d.r*d.r)color=d.color||[240,240,235];
    pixels.set([...color,255],(y*width+x)*4);
  }
  return {pixels,width,height};
}
const run=(s,sensitivity=55,size=35)=>detect(s.pixels,s.width,s.height,sensitivity,size);
test('empty dark and uniform bright frames yield no pieces',()=>{
  for(const bg of [[0,0,0],[90,90,90],[250,250,250]])assert.equal(run(scene([],bg)).length,0);
});
test('neutral dark background does not swallow a pale disk',()=>{
  const result=run(scene([{x:100,y:75,r:18}]));
  assert.equal(result.length,1);
  assert.ok(Math.hypot(result[0].centerX-100,result[0].centerY-75)<2);
});
test('two touching bodies receive distinct centres',()=>{
  const result=run(scene([{x:80,y:75,r:18},{x:112,y:75,r:18}]));
  assert.equal(result.length,2);
  for(const x of [80,112])assert.ok(result.some(p=>Math.hypot(p.centerX-x,p.centerY-75)<3));
});
test('axle holes in one body do not multiply into pieces',()=>{
  const result=run(scene([{x:100,y:75,r:23},{x:100,y:75,r:5,color:[90,90,90]},{x:110,y:65,r:3,color:[90,90,90]}]));
  assert.equal(result.length,1);
});
test('separated pieces preserve their centres',()=>{
  const disks=[{x:40,y:35,r:12},{x:140,y:35,r:12},{x:40,y:115,r:12},{x:140,y:115,r:12}];
  const result=run(scene(disks));
  assert.equal(result.length,4);
  for(const d of disks)assert.ok(result.some(p=>Math.hypot(p.centerX-d.x,p.centerY-d.y)<3));
});
test('size slider filters small components without removing the large piece',()=>{
  const input=scene([{x:50,y:75,r:2.5},{x:140,y:75,r:15}]);
  assert.equal(run(input,55,10).length,2);
  assert.equal(run(input,55,100).length,1);
});
test('same-colour foreign objects remain a documented limitation',()=>{
  // A colour/shape detector cannot prove that a disk is a rotor rather than a tablet.
  assert.equal(run(scene([{x:50,y:75,r:15},{x:140,y:75,r:15}])).length,2);
});

const plastic=[170,180,160], wood=[135,90,55];
function reference() {
  const image=scene([{x:100,y:75,r:18,color:plastic}],wood);
  return calibrate(image.pixels,image.width,image.height,100,75,18);
}
function calibratedRun(image,reference,exposure=1) {
  const pixels=Uint8ClampedArray.from(image.pixels,(value,i)=>i%4===3?value:Math.round(value*exposure));
  return detect(pixels,image.width,image.height,55,35,reference);
}
test('reference samples plastic and background separately; rejects invalid selections',()=>{
  const image=scene([{x:100,y:75,r:18,color:plastic}],wood);
  const ref=reference();
  assert.ok(ref.backgroundColor);
  assert.ok(ref.color.green>ref.color.red);
  for(const [x,y,r] of [[100,75,1],[100,75,NaN],[100,75,80],[1,1,18]]) {
    assert.equal(calibrate(image.pixels,image.width,image.height,x,y,r),null);
  }
});
test('calibration keeps plastic bodies when illumination falls, without counting the wood',()=>{
  const image=scene([{x:50,y:75,r:16,color:plastic},{x:140,y:75,r:16,color:plastic}],wood);
  for(const exposure of [1,.55,.3]) {
    assert.equal(calibratedRun(image,reference(),exposure).length,2);
    assert.equal(calibratedRun(scene([],wood),reference(),exposure).length,0);
  }
});
test('a much smaller neutral metal fragment is not another plastic body',()=>{
  const image=scene([{x:70,y:75,r:18,color:plastic},{x:145,y:75,r:5,color:[190,190,190]}],wood);
  const result=calibratedRun(image,reference());
  assert.equal(result.length,1);
  assert.ok(Math.abs(result[0].centerX-70)<3);
});
test('relative size adapts to camera distance, including one isolated body',()=>{
  for(const radius of [24,18,12,7]) {
    for(const centres of [[100],[50,140]]) {
      const image=scene(centres.map(x=>({x,y:75,r:radius,color:plastic})),wood);
      assert.equal(calibratedRun(image,reference()).length,centres.length);
    }
  }
});
test('two touching calibrated bodies still count separately',()=>{
  const image=scene([{x:80,y:75,r:18,color:plastic},{x:112,y:75,r:18,color:plastic}],wood);
  assert.equal(calibratedRun(image,reference()).length,2);
});
test('large bright patch is rejected relative to the common body size',()=>{
  const image=scene([{x:30,y:30,r:9,color:plastic},{x:65,y:30,r:9,color:plastic},{x:100,y:30,r:9,color:plastic},{x:145,y:105,r:27,color:[245,245,245]}],wood);
  assert.equal(calibratedRun(image,reference()).length,3);
});
test('darker plastic on a neutral bright surface works across exposure changes',()=>{
  const image=scene([{x:100,y:75,r:18,color:[150,150,150]}],[210,210,210]);
  const ref=calibrate(image.pixels,image.width,image.height,100,75,18);
  for(const exposure of [1,.5,.3]) assert.equal(calibratedRun(image,ref,exposure).length,1);
});
