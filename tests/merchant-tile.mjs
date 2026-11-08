import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root = await readFile(new URL("../scripts/h0d-loot.js",import.meta.url),"utf8");
const tiles = await readFile(new URL("../scripts/h0d-merchant-tiles.js",import.meta.url),"utf8");
const merchant = await readFile(new URL("../scripts/h0d-merchant.js",import.meta.url),"utf8");

assert.match(root,/registerMerchantTileHooks\(\)/,"Tile hooks registered at module load");
assert.match(root,/\.\.\.merchantTileAPI/,"Tile API exposed by module");
assert.match(tiles,/canvasCoordinatesFromClient\(/,"v14 client coordinates conversion");
assert.match(tiles,/addEventListener\("dblclick",handleCanvasDoubleClick,true\)/,"Public tile double-click capture");
assert.match(tiles,/getSceneControlButtons/,"GM tile linking control");
assert.match(tiles,/tile\.setFlag\(NS,TILE_FLAG,snapshot\)/,"Tile flag persists public storefront");
assert.match(tiles,/merchantAPI\.getMerchant\(actor\)/,"Merchant Actor is source of truth");
assert.match(tiles,/if\s*\(!game\.user\?\.isGM/,"GM controls access");
assert.match(tiles,/tile\.hidden/,"Hidden tiles are not publicly accessible");
assert.match(tiles,/syncMerchantTiles/,"Merchant edits can refresh linked tile snapshots");
assert.match(tiles,/event\.stopImmediatePropagation/,"Interactive storefront doesn't trigger canvas doubles");
assert.match(tiles,/esc\(offer\.name\)/,"Public item names are escaped");
assert.match(merchant,/const NS="h0d-loot", FLAG="merchant"/,"Merchant stock kept on Actor flags");
assert.doesNotMatch(tiles,/createEmbeddedDocuments|deleteEmbeddedDocuments/,"Linking a tile does not mutate Actor Items");
console.log("OK: merchant tile linking, public snapshot, player interaction and safeguards");
