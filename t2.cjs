const fs=require("fs");
const dir="src/content/posts";
const items=fs.readdirSync(dir,{withFileTypes:true});
console.log("items:",items.length);
let n=0;
for(const e of items){
  try{ fs.rmSync("src/content/posts/"+e.name,{recursive:true,force:true}); n++; }
  catch(err){ console.log("ERR on",e.name,err.code); }
}
console.log("removed:",n);
