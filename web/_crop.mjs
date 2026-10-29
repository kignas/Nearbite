import fs from "node:fs";
import { PNG } from "pngjs";
const [file, y0, y1, out] = process.argv.slice(2);
const img = PNG.sync.read(fs.readFileSync(file));
const Y0=+y0, Y1=Math.min(+y1,img.height);
const h=Y1-Y0, w=img.width;
const o=new PNG({width:w,height:h});
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const si=((Y0+y)*w+x)*4, di=(y*w+x)*4;
  o.data[di]=img.data[si];o.data[di+1]=img.data[si+1];o.data[di+2]=img.data[si+2];o.data[di+3]=img.data[si+3];
}
fs.writeFileSync(out, PNG.sync.write(o));
console.log("wrote",out,w,h);
