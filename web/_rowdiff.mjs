import fs from "node:fs";
import { PNG } from "pngjs";
const a = PNG.sync.read(fs.readFileSync("/workspace/project/Nearbite/compare-out/support-phone-legacy.png"));
const b = PNG.sync.read(fs.readFileSync("/workspace/project/Nearbite/compare-out/support-phone-new.png"));
console.log("legacy", a.width, a.height, "new", b.width, b.height);
const h = Math.min(a.height, b.height), w = Math.min(a.width,b.width);
let runs=[];
let cur=null;
for (let y=0;y<h;y++){
  let diff=0;
  for (let x=0;x<w;x++){
    const i=(y*w+x)*4;
    if (Math.abs(a.data[i]-b.data[i])>12||Math.abs(a.data[i+1]-b.data[i+1])>12||Math.abs(a.data[i+2]-b.data[i+2])>12) diff++;
  }
  if (diff>3){ if(!cur)cur={y0:y,y1:y,max:diff}; else {cur.y1=y;cur.max=Math.max(cur.max,diff);} }
  else { if(cur){runs.push(cur);cur=null;} }
}
if(cur)runs.push(cur);
console.log("diff row-runs (y0-y1 maxpx):", runs.map(r=>`${r.y0}-${r.y1}(${r.max})`).join(" "));
