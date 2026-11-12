const {test}=require('node:test');
const assert=require('node:assert/strict');

test('sweep mode starts in a worker, holds the count, and resets for a new group',
  {skip:!process.env.COUNTER_BASE_URL,timeout:55000},async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request));
    await page.addInitScript(()=>{
      window.sweepShift=0;
      window.sweepPieces=3;
      navigator.mediaDevices.getUserMedia=async()=>{
        const source=document.createElement('canvas');
        source.width=640;
        source.height=480;
        const ctx=source.getContext('2d');
        const circle=(x,y,r,value)=>{
          ctx.fillStyle=`rgb(${value},${value},${value})`;
          ctx.beginPath();
          ctx.arc(x+window.sweepShift,y,r,0,2*Math.PI);
          ctx.fill();
        };
        const draw=()=>{
          ctx.fillStyle='#bcbcbc';
          ctx.fillRect(0,0,640,480);
          for(const [x,y] of [[161,190],[276,229],[392,173]].slice(0,window.sweepPieces)){
            circle(x,y,22,104);
            circle(x,y,19,226);
            circle(x,y,14,158);
            circle(x,y,1.6,65);
          }
          circle(472,230,21,255);
        };
        draw();
        const stream=source.captureStream(24);
        const timer=setInterval(draw,42);
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(timer);stop();};
        window.sweepTestStream=stream;
        return stream;
      };
    });
    await page.goto(process.env.COUNTER_BASE_URL);
    await page.locator('#openPieceCounter').click();
    assert.equal(await page.locator('#counterSweep').isChecked(),false);
    assert.ok(!requests.some(request=>request.url().includes('opencv-')));
    await page.locator('#counterSweep').check();
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('3 možných spodků, potvrzeno 0'),null,{timeout:35000});
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Přejezd');
    assert.equal(await page.locator('#counterSeparate').isDisabled(),true);
    for(const shift of [4,8,12,16]){
      await page.evaluate(offset=>{window.sweepShift=offset;},shift);
      await page.waitForTimeout(250);
    }
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='3');
    await page.evaluate(()=>{window.sweepPieces=2;window.sweepShift=20;});
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#counterCount').textContent(),'3');
    await page.locator('#counterSweepReset').click();
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='0');
    await page.locator('#counterClose').click();
    assert.equal(await page.evaluate(()=>window.sweepTestStream.getVideoTracks()[0].readyState),'ended');
    assert.deepEqual(errors,[]);
    assert.ok(requests.some(request=>request.url().includes('vendor/opencv-4.13.0.js')));
    assert.ok(requests.every(request=>request.method()==='GET' && new URL(request.url()).origin===new URL(process.env.COUNTER_BASE_URL).origin));
  } finally { await browser.close(); }
});

// Optional browser integration check: use a local HTTP server and Playwright.
// COUNTER_BASE_URL=http://127.0.0.1:8765/vykonak/; EDGE_PATH is optional.
test('camera publishes matching frame/count promptly, freezes calibration and releases late streams',
  {skip:!process.env.COUNTER_BASE_URL,timeout:45000},async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
    const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
    await page.addInitScript(()=>{
      window.sceneCount=2; window.sceneRadius=40; window.workerDelay=0;
      window.frameCountPairs=[]; window.maxInFlight=0;
      const NativeWorker=window.Worker;
      window.Worker=class {
        constructor(url){
          this.native=new NativeWorker(url);this.pending=0;
          this.native.onmessage=e=>setTimeout(()=>{this.pending--;this.onmessage?.(e);},window.workerDelay);
          this.native.onerror=e=>this.onerror?.(e);
        }
        postMessage(...args){this.pending++;window.maxInFlight=Math.max(window.maxInFlight,this.pending);this.native.postMessage(...args);}
        terminate(){this.native.terminate();}
      };
      navigator.mediaDevices.getUserMedia=async()=>{
        const source=document.createElement('canvas');source.width=640;source.height=480;
        const ctx=source.getContext('2d');
        const draw=()=>{
          ctx.fillStyle='rgb(135,90,55)';ctx.fillRect(0,0,640,480);
          ctx.fillStyle=`rgb(${30+window.sceneCount*30},10,5)`;ctx.fillRect(0,0,30,30);
          ctx.fillStyle='rgb(170,180,160)';
          for(const x of [140,320,500].slice(0,window.sceneCount)){
            ctx.beginPath();ctx.arc(x,240,window.sceneRadius,0,Math.PI*2);ctx.fill();
          }
        };
        draw();const stream=source.captureStream(30),timer=setInterval(draw,33);
        window.cameraStream=stream;
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(timer);stop();};
        if(window.deferCamera)await new Promise(resolve=>window.allowCamera=resolve);
        return stream;
      };
      window.addEventListener('DOMContentLoaded',()=>{
        new MutationObserver(()=>{
          const canvas=document.querySelector('#counterCanvas');
          if(canvas.width>30){
            const red=canvas.getContext('2d').getImageData(5,5,1,1).data[0];
            window.frameCountPairs.push([Number(document.querySelector('#counterCount').textContent),Math.round((red-30)/30)]);
          }
        }).observe(document.querySelector('#counterCount'),{childList:true});
      });
    });
    await page.goto(process.env.COUNTER_BASE_URL);
    await page.locator('#openPieceCounter').click();
    await page.locator('#counterSeparate').check();
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='2');
    assert.equal(await page.locator('#counterCalibrate').isEnabled(),true);
    assert.equal(await page.locator('#counterSensitivity').isVisible(),true);
    const times=[];
    for(const count of [3,1,3]){
      const start=Date.now();
      await page.evaluate(n=>window.sceneCount=n,count);
      await page.waitForFunction(n=>Number(document.querySelector('#counterCount').textContent)===n,count);
      times.push(Date.now()-start);
    }
    assert.ok(Math.max(...times)<900,`Unexpected display lag: ${times}`);
    // An intentionally slow worker must not queue old frames or detach labels
    // from their image while the source continues changing.
    await page.evaluate(()=>{window.workerDelay=350;window.sceneCount=1;});
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='1');
    await page.evaluate(()=>window.sceneCount=3);
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='3');
    assert.equal(await page.evaluate(()=>window.maxInFlight),1);
    assert.ok(await page.evaluate(()=>window.frameCountPairs.length>4 && window.frameCountPairs.every(([a,b])=>a===b)));

    await page.locator('#counterCalibrate').click();
    const frozen=await page.locator('#counterCanvas').evaluate(el=>Array.from(el.getContext('2d').getImageData(5,5,1,1).data));
    await page.evaluate(()=>{window.sceneCount=1;window.workerDelay=0;});
    await page.waitForTimeout(500);
    assert.deepEqual(await page.locator('#counterCanvas').evaluate(el=>Array.from(el.getContext('2d').getImageData(5,5,1,1).data)),frozen);
    await page.locator('#counterCanvas').scrollIntoViewIfNeeded();
    const coords=await page.locator('#counterCanvas').evaluate(el=>{
      const r=el.getBoundingClientRect(),s=Math.min(r.width/el.width,r.height/el.height);
      return {x:r.x+(r.width-el.width*s)/2,y:r.y+(r.height-el.height*s)/2,s};
    });
    await page.touchscreen.tap(coords.x+140*coords.s,coords.y+240*coords.s);
    await page.touchscreen.tap(coords.x+180*coords.s,coords.y+240*coords.s);
    await page.waitForFunction(()=>document.querySelector('#counterMode').textContent==='Podle vzoru');
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='1');
    await page.locator('#counterSensitivity').evaluate(el=>{el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}));});
    assert.equal(await page.locator('#counterMode').textContent(),'Podle vzoru');
    await page.evaluate(()=>{window.sceneCount=2;window.sceneRadius=20;});
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='2');

    await page.locator('#counterClose').click();
    assert.equal(await page.evaluate(()=>window.cameraStream.getVideoTracks()[0].readyState),'ended');
    assert.equal(await page.locator('#counterCanvas').evaluate(el=>el.width),1);
    // Permission/camera initialization may complete after the panel is closed.
    await page.evaluate(()=>{window.deferCamera=true;window.allowCamera=null;});
    await page.locator('#openPieceCounter').click();
    await page.waitForFunction(()=>window.allowCamera!==null);
    await page.locator('#counterClose').click();
    await page.evaluate(()=>window.allowCamera());
    await page.waitForFunction(()=>window.cameraStream.getVideoTracks()[0].readyState==='ended');
    assert.equal(await page.locator('#counterSheet').isHidden(),true);
    assert.deepEqual(errors,[]);
    assert.ok(requests.every(r=>r.method==='GET' && new URL(r.url).origin===new URL(process.env.COUNTER_BASE_URL).origin));
    console.log(`Measured count response on this computer: ${times.join(', ')} ms; maximum one frame in flight.`);
  } finally {await browser.close();}
});
