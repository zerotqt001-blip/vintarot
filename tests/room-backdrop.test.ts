import assert from "node:assert/strict";
import {existsSync,readFileSync,statSync} from "node:fs";
import {resolve} from "node:path";
import test from "node:test";

const root=process.cwd();
const backdrop=resolve(root,"public/room/vintarot-cosmic-table.png");
const styles=readFileSync(resolve(root,"app/globals.css"),"utf8");

test("room cosmic backdrop is present as a rich visual asset",()=>{
  assert.equal(existsSync(backdrop),true);
  assert.ok(statSync(backdrop).size>100_000);
});

test("room surface exposes the layered 3D backdrop motion",()=>{
  assert.match(styles,/vintarot-cosmic-table\.png/);
  assert.match(styles,/room-cosmic-drift/);
  assert.match(styles,/perspective:1400px/);
});
