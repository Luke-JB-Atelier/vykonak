const {test}=require('node:test');
const assert=require('node:assert/strict');

test('counter starts the sweep directly and displays live video independently of the worker',
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
      window.sweepCameraRequests=[];
      window.sweepWorkerDelay=0;
      window.sweepInFlight=0;
      window.sweepMaxInFlight=0;
      const NativeWorker=window.Worker;
      window.Worker=class {
        constructor(url){
          this.native=new NativeWorker(url);
          this.native.onmessage=event=>setTimeout(()=>{
            if(this.ended)return;
            window.sweepInFlight--;
            this.onmessage?.(event);
          },window.sweepWorkerDelay);
          this.native.onerror=event=>this.onerror?.(event);
        }
        postMessage(...args){
          window.sweepInFlight++;
          window.sweepMaxInFlight=Math.max(window.sweepMaxInFlight,window.sweepInFlight);
          this.native.postMessage(...args);
        }
        terminate(){this.ended=true;window.sweepInFlight=0;this.native.terminate();}
      };
      navigator.mediaDevices.getUserMedia=async constraints=>{
        window.sweepCameraRequests.push(constraints.video);
        const source=document.createElement('canvas');
        const detail=constraints.video.width.ideal===1920;
        source.width=detail?1600:640;
        source.height=detail?1200:480;
        const ctx=source.getContext('2d');
        if(detail)ctx.scale(2.5,2.5);
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
        if(window.deferSweepCamera)await new Promise(resolve=>{window.allowSweepCamera=resolve;});
        return stream;
      };
    });
    await page.goto(process.env.COUNTER_BASE_URL);
    await page.locator('#openPieceCounter').click();
    await page.waitForFunction(()=>document.querySelector('#counterResolutionActual').textContent.includes('640 × 480'));
    assert.deepEqual(await page.evaluate(()=>window.sweepCameraRequests[0]),{
      facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3},frameRate:{ideal:30}
    });
    assert.equal(await page.locator('#counterSweep, #counterSeparate').count(),0);
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('3 možných spodků, potvrzeno 0'),null,{timeout:35000});
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Přejezd');
    assert.equal(await page.locator('#counterCanvas').isVisible(),false);
    assert.equal(await page.locator('#counterVideo').evaluate(video=>getComputedStyle(video).opacity),'1');
    await page.evaluate(()=>{window.sweepWorkerDelay=750;});
    await page.waitForFunction(()=>window.sweepInFlight===1);
    assert.equal(await page.evaluate(async()=>{
      const video=document.querySelector('#counterVideo');
      const start=video.currentTime;
      await new Promise(resolve=>setTimeout(resolve,180));
      return video.currentTime>start && window.sweepInFlight===1;
    }),true);
    await page.evaluate(()=>{window.sweepWorkerDelay=0;});
    await page.waitForFunction(()=>window.sweepInFlight===0);
    for(const shift of [4,8,12,16]){
      await page.evaluate(offset=>{window.sweepShift=offset;},shift);
      await page.waitForTimeout(250);
    }
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='3',null,{timeout:6000});
    await page.locator('#counterReview').click();
    assert.equal(await page.locator('#counterCanvas').isVisible(),true);
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Kontrola');
    const snapshot=await page.locator('#counterCanvas').evaluate(canvas=>canvas.toDataURL());
    await page.evaluate(()=>{window.sweepShift=0;});
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#counterCanvas').evaluate(canvas=>canvas.toDataURL()),snapshot);
    await page.locator('#counterReview').click();
    assert.equal(await page.locator('#counterCanvas').isVisible(),false);
    await page.evaluate(()=>{window.sweepPieces=2;window.sweepShift=20;});
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#counterCount').textContent(),'3');
    await page.locator('#counterCalibrate').click();
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Kalibrace');
    const coords=await page.locator('#counterCanvas').evaluate(canvas=>{
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
      return {x:rect.x+(rect.width-canvas.width*scale)/2,y:rect.y+(rect.height-canvas.height*scale)/2,scale};
    });
    await page.touchscreen.tap(coords.x+181*coords.scale,coords.y+190*coords.scale);
    await page.touchscreen.tap(coords.x+203*coords.scale,coords.y+190*coords.scale);
    await page.waitForFunction(()=>document.querySelector('#counterCalibrate').textContent.includes('Velikost spodku nastavena'));
    assert.equal(await page.locator('#counterCanvas').isVisible(),false);
    await page.locator('#counterSweepReset').click();
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='0');
    await page.evaluate(()=>{window.previousSweepStream=window.sweepTestStream;});
    await page.locator('#counterResolution').selectOption('light');
    await page.waitForFunction(()=>window.sweepCameraRequests.length===2);
    await page.waitForFunction(()=>document.querySelector('#counterResolutionActual').textContent.includes('640 × 480'));
    assert.deepEqual(await page.evaluate(()=>window.sweepCameraRequests[1]),{
      facingMode:{ideal:'environment'},width:{ideal:800},height:{ideal:600},aspectRatio:{ideal:4/3},frameRate:{ideal:24}
    });
    assert.equal(await page.evaluate(()=>window.previousSweepStream.getVideoTracks()[0].readyState),'ended');
    assert.equal(await page.locator('#counterCount').textContent(),'0');
    await page.locator('#counterResolution').selectOption('detail');
    await page.waitForFunction(()=>document.querySelector('#counterResolutionActual').textContent.includes('1600 × 1200'));
    await page.waitForFunction(()=>!document.querySelector('#counterReview').disabled);
    await page.locator('#counterReview').click();
    assert.equal(await page.locator('#counterCanvas').evaluate(canvas=>canvas.width),1280);
    await page.locator('#counterClose').click();
    assert.equal(await page.evaluate(()=>window.sweepTestStream.getVideoTracks()[0].readyState),'ended');
    assert.equal(await page.evaluate(()=>window.sweepMaxInFlight),1);
    assert.deepEqual(errors,[]);
    assert.ok(requests.some(request=>request.url().includes('vendor/opencv-4.13.0.js')));
    assert.ok(requests.every(request=>request.method()==='GET' && new URL(request.url()).origin===new URL(process.env.COUNTER_BASE_URL).origin));
    await page.evaluate(()=>{window.deferSweepCamera=true;});
    await page.locator('#openPieceCounter').click();
    await page.waitForFunction(()=>typeof window.allowSweepCamera==='function');
    await page.locator('#counterClose').click();
    await page.evaluate(()=>{window.allowSweepCamera();});
    await page.waitForFunction(()=>window.sweepTestStream.getVideoTracks()[0].readyState==='ended');
    await page.reload();
    assert.equal(await page.locator('#counterResolution').inputValue(),'detail');
  } finally { await browser.close(); }
});
