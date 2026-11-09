import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const base = new URL("../",import.meta.url);
const read = path => readFile(new URL(path,base),"utf8");
const [manifestSource,loot,container]=await Promise.all([
  read("module.json"),read("scripts/h0d-loot.js"),read("scripts/h0d-container.js")
]);
const manifest=JSON.parse(manifestSource);
assert.equal(manifest.id,"h0d-loot","Le canal doit correspondre à l'ID du manifeste.");
assert.equal(manifest.version,"0.6.20");
assert.equal(manifest.socket,true,
  "Foundry doit autoriser le namespace module.h0d-loot ; game.socket.on seul ne suffit pas.");
const socketName="module."+manifest.id;
assert.match(loot,/const SOCKET = `module\.\$\{MODULE_ID\}`;/);
assert.match(container,/const SOCKET = "module\.h0d-loot";/);
assert.match(loot,/game\.socket\.on\(SOCKET,onSocketMessage\)/);
assert.match(loot,/game\.socket\.emit\(SOCKET,\{type:"carcass-open"/);
assert.match(loot,/type:"carcass-open-result"/);
assert.match(container,/game\.socket\.on\(SOCKET,data =>/);
assert.match(container,/type:"container-trade"/);
assert.equal(socketName,"module.h0d-loot");
console.log("OK : socket:true et émission/réception sur le même namespace Foundry.");
