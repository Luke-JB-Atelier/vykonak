const {test}=require('node:test');
const assert=require('node:assert/strict');

test('chooses the exact camera when two webcams have the same name and remembers it',
  {skip:!process.env.COUNTER_BASE_URL,timeout:35000},async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
  try {
    const context=await browser.newContext({serviceWorkers:'block'});
    const page=await context.newPage();
    await page.addInitScript(()=>{
      window.cameraCalls=[];
      window.availableCameras=['face','table'];
      window.cameraStreams=[];
      navigator.mediaDevices.enumerateDevices=async()=>window.availableCameras.map(deviceId=>({
        deviceId,kind:'videoinput',label:'Logitech C922'
      }));
      navigator.mediaDevices.getUserMedia=async({video})=>{
        window.cameraCalls.push(video);
        const deviceId=video.deviceId?.exact||'face';
        if(!window.availableCameras.includes(deviceId))throw new DOMException('Camera unavailable','NotFoundError');
        const canvas=document.createElement('canvas');
        canvas.width=320;canvas.height=240;
        const ctx=canvas.getContext('2d');
        const draw=()=>{ctx.fillStyle=deviceId==='table'?'green':'red';ctx.fillRect(0,0,320,240);};
        draw();
        const stream=canvas.captureStream(10);
        const timer=setInterval(draw,100);
        const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
        track.getSettings=()=>({deviceId});
        track.stop=()=>{clearInterval(timer);stop();};
        window.cameraStreams.push(stream);
        return stream;
      };
    });
    const open=()=>page.locator('#openPieceCounter').click();
    const close=()=>page.locator('#counterClose').click();
    const waitForCamera=id=>page.waitForFunction(deviceId=>{
      const video=document.querySelector('#counterVideo');
      return video.srcObject?.getVideoTracks()[0].getSettings().deviceId===deviceId && video.readyState>=2;
    },id);
    await page.goto(process.env.COUNTER_BASE_URL);
    await open();
    await waitForCamera('face');
    assert.deepEqual(await page.locator('#counterCamera option').allTextContents(),[
      'Automaticky – Logitech C922 (1)','Logitech C922 (1)','Logitech C922 (2)'
    ]);
    await page.locator('#counterCamera').selectOption('table');
    await waitForCamera('table');
    assert.equal(await page.evaluate(()=>window.cameraStreams[0].getVideoTracks()[0].readyState),'ended');
    assert.deepEqual(await page.evaluate(()=>window.cameraCalls.at(-1).deviceId),{exact:'table'});
    const cameraCallsBeforeRename=await page.evaluate(()=>window.cameraCalls.length);
    await page.locator('#counterRenameCamera').click();
    await page.locator('#counterCameraName').fill('Díly');
    await page.getByRole('button',{name:'Uložit název'}).click();
    await page.waitForFunction(()=>document.querySelector('#counterCamera option:checked').textContent==='Díly');
    assert.equal(await page.evaluate(()=>window.cameraCalls.length),cameraCallsBeforeRename);
    await close();
    await page.reload();
    await open();
    await waitForCamera('table');
    assert.equal(await page.locator('#counterCamera').inputValue(),'table');
    assert.equal(await page.locator('#counterCamera option:checked').textContent(),'Díly');
    await page.locator('#counterResolution').selectOption('light');
    await page.waitForFunction(()=>window.cameraCalls.at(-1)?.width.ideal===800);
    await waitForCamera('table');
    await close();
    await page.evaluate(()=>{window.availableCameras=['face'];});
    const before=await page.evaluate(()=>window.cameraCalls.length);
    await open();
    await page.waitForFunction(()=>document.querySelector('#counterEmptyTitle').textContent==='Vybranou kameru nelze otevřít');
    assert.equal(await page.evaluate(()=>window.cameraCalls.length),before+1);
    assert.equal(await page.locator('#counterCamera').inputValue(),'table');
    assert.equal(await page.locator('#counterCamera option:checked').textContent(),'Díly');
    await page.locator('#counterCamera').selectOption('face');
    await waitForCamera('face');
    await page.evaluate(()=>{
      window.availableCameras=['face','table'];
      navigator.mediaDevices.dispatchEvent(new Event('devicechange'));
    });
    await page.locator('#counterCamera').selectOption('table');
    await waitForCamera('table');
    await page.locator('#counterRenameCamera').click();
    await page.locator('#counterCameraName').fill('');
    await page.getByRole('button',{name:'Uložit název'}).click();
    await page.waitForFunction(()=>document.querySelector('#counterCamera option:checked').textContent==='Logitech C922 (2)');
    await close();
  } finally { await browser.close(); }
});

test('live video keeps moving while the counter spaces out measurements and reviews the measured frame',
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
      window.sweepWorkerResults=0;
      window.sweepWorkerFinishedAt=null;
      window.sweepWorkerGaps=[];
      window.sweepMaxInFlight=0;
      window.sweepCalibrationFlags=[];
      window.sweepAnalysisSizes=[];
      const NativeWorker=window.Worker;
      window.Worker=class {
        constructor(url){
          this.native=new NativeWorker(url);
          this.native.onmessage=event=>setTimeout(()=>{
            if(this.ended)return;
            window.sweepInFlight--;
            window.sweepWorkerResults++;
            window.sweepWorkerFinishedAt=performance.now();
            this.onmessage?.(event);
          },window.sweepWorkerDelay);
          this.native.onerror=event=>this.onerror?.(event);
        }
        postMessage(...args){
          if(window.sweepWorkerFinishedAt!==null)window.sweepWorkerGaps.push(performance.now()-window.sweepWorkerFinishedAt);
          window.sweepInFlight++;
          window.sweepMaxInFlight=Math.max(window.sweepMaxInFlight,window.sweepInFlight);
          window.sweepCalibrationFlags.push(args[0].calibratedSize);
          window.sweepAnalysisSizes.push([args[0].width,args[0].height]);
          this.native.postMessage(...args);
        }
        terminate(){this.ended=true;window.sweepInFlight=0;window.sweepWorkerFinishedAt=null;this.native.terminate();}
      };
      navigator.mediaDevices.getUserMedia=async constraints=>{
        window.sweepCameraRequests.push(constraints.video);
        const source=document.createElement('canvas');
        const detail=constraints.video.width.ideal===1920;
        const portrait=constraints.video.width.ideal===1280;
        const scale=detail?2.5:1;
        source.width=detail?1600:portrait?360:640;
        source.height=detail?1200:portrait?640:480;
        const ctx=source.getContext('2d');
        window.sweepSource=source;
        const circle=(x,y,r,value)=>{
          ctx.fillStyle=`rgb(${value},${value},${value})`;
          ctx.beginPath();
          ctx.arc(x+window.sweepShift,y,r,0,2*Math.PI);
          ctx.fill();
        };
        const draw=()=>{
          ctx.setTransform(scale,0,0,scale,0,0);
          ctx.fillStyle='#bcbcbc';
          ctx.fillRect(0,0,source.width/scale,source.height/scale);
          for(const [x,y] of [[115,190],[220,229],[298,173]].slice(0,window.sweepPieces)){
            circle(x,y,22,104);
            circle(x,y,19,226);
            circle(x,y,14,158);
            circle(x,y,1.6,65);
          }
          circle(265,304,21,255);
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
    await page.waitForFunction(()=>document.querySelector('#counterResolutionActual').textContent.includes('360 × 640'));
    assert.ok(!(await page.locator('#counterCamera option').allTextContents()).includes('Díly'));
    assert.deepEqual(await page.evaluate(()=>window.sweepCameraRequests[0]),{
      facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960},aspectRatio:{ideal:4/3},frameRate:{ideal:30}
    });
    assert.equal(await page.locator('#counterSweep, #counterSeparate').count(),0);
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('3 možných spodků, potvrzeno 0'),null,{timeout:35000});
    assert.equal(await page.evaluate(()=>window.sweepCalibrationFlags[0]),false);
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Přejezd');
    assert.equal(await page.locator('#counterCanvas').isVisible(),false);
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
      const results=await page.evaluate(offset=>{window.sweepShift=offset;return window.sweepWorkerResults;},shift);
      await page.waitForFunction(results=>window.sweepWorkerResults>=results+2,results);
    }
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='3',null,{timeout:6000});
    await page.locator('#counterReview').click();
    assert.equal(await page.locator('#counterCanvas').evaluate(canvas=>{
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return pixels.some((red,index)=>index%4===0 && pixels[index+1]>red+60 && pixels[index+1]>pixels[index+2]+45);
    }),true);
    assert.equal(await page.locator('#counterCanvas').isVisible(),true);
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Kontrola');
    const snapshot=await page.locator('#counterCanvas').evaluate(canvas=>canvas.toDataURL());
    await page.evaluate(()=>{window.sweepShift=0;});
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#counterCanvas').evaluate(canvas=>canvas.toDataURL()),snapshot);
    await page.locator('#counterReview').click();
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Přejezd');
    assert.equal(await page.locator('#counterCanvas').isVisible(),false);
    await page.evaluate(()=>{window.sweepPieces=2;window.sweepShift=20;});
    await page.waitForTimeout(650);
    assert.equal(await page.locator('#counterCount').textContent(),'3');
    await page.evaluate(()=>{window.sweepPieces=3;});
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('3 možných spodků'));
    await page.locator('#counterArea').click();
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Plocha');
    assert.equal(await page.locator('#counterReview').isEnabled(),false);
    const areaCoords=await page.locator('#counterCanvas').evaluate(canvas=>{
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
      return {x:rect.x+(rect.width-canvas.width*scale)/2,y:rect.y+(rect.height-canvas.height*scale)/2,scale};
    });
    await page.touchscreen.tap(areaCoords.x+80*areaCoords.scale,areaCoords.y+150*areaCoords.scale);
    await page.touchscreen.tap(areaCoords.x+275*areaCoords.scale,areaCoords.y+275*areaCoords.scale);
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('2 možných spodků'));
    await page.locator('#counterSweepReset').click();
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('2 možných spodků'));
    for(const shift of [24,29,35,40]){
      const results=await page.evaluate(offset=>{window.sweepShift=offset;return window.sweepWorkerResults;},shift);
      await page.waitForFunction(results=>window.sweepWorkerResults>=results+2,results);
    }
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='2',null,{timeout:6000});
    await page.evaluate(()=>{window.sweepShift=20;});
    await page.locator('#counterClearArea').click();
    await page.waitForFunction(()=>document.querySelector('#counterSweepHint').textContent.includes('3 možných spodků'),null,{timeout:6000});
    await page.evaluate(()=>{window.sweepSource.height=600;});
    await page.waitForFunction(()=>window.sweepAnalysisSizes.at(-1)?.[1]===600);
    await page.waitForFunction(()=>document.querySelector('#counterCount').textContent==='0');
    await page.waitForFunction(()=>!document.querySelector('#counterCalibrate').disabled);
    await page.locator('#counterCalibrate').click();
    assert.equal(await page.locator('#counterLiveBadge').textContent(),'Kalibrace');
    const coords=await page.locator('#counterCanvas').evaluate(canvas=>{
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
      return {x:rect.x+(rect.width-canvas.width*scale)/2,y:rect.y+(rect.height-canvas.height*scale)/2,scale};
    });
    await page.touchscreen.tap(coords.x+135*coords.scale,coords.y+190*coords.scale);
    await page.touchscreen.tap(coords.x+157*coords.scale,coords.y+190*coords.scale);
    await page.waitForFunction(()=>document.querySelector('#counterCalibrate').textContent.includes('Velikost spodku nastavena'));
    await page.waitForFunction(()=>window.sweepCalibrationFlags.at(-1)===true);
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
    const gaps=await page.evaluate(()=>window.sweepWorkerGaps);
    assert.ok(gaps.length>5);
    assert.ok(gaps.every(gap=>gap>=445),JSON.stringify(gaps));
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
