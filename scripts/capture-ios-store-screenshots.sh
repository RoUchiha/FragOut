#!/usr/bin/env bash
set -euo pipefail

evidence="$RUNNER_TEMP/fragout-evidence"
output="$evidence/store-screenshots"
export FRAGOUT_DB="$RUNNER_TEMP/fragout-store-fixture/state.sqlite"

node tests/fixtures/qwen-server.mjs 11447 > "$evidence/qwen-store-fixture.log" 2>&1 &
model_pid=$!
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3215 > "$evidence/store-api.log" 2>&1 &
api_pid=$!
trap 'kill "$model_pid" "$api_pid" 2>/dev/null || true' EXIT

for ((attempt=1; attempt<=45; attempt++)); do
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' http://127.0.0.1:3215/api/state || true)"
  if [[ "$status" == 401 ]] && curl --silent --fail http://127.0.0.1:11447/api/tags >/dev/null; then
    break
  fi
  if [[ "$attempt" == 45 ]]; then
    cat "$evidence/store-api.log"
    exit 1
  fi
  sleep 1
done

capture() {
  local device="$1" directory="$2" width="$3" height="$4"
  local results="$evidence/maestro-$directory" dest="$output/$directory"
  mkdir -p "$results" "$dest"
  xcrun simctl status_bar "$device" override --time '9:41' --dataNetwork wifi --wifiMode active \
    --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState unplugged --batteryLevel 100
  maestro --no-ansi --device "$device" test --test-output-dir "$results" mobile/acceptance/store/screenshots.yaml

  node --input-type=module - "$results" "$dest" "$width" "$height" <<'JS'
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import sharp from 'sharp';

const [source,destination,width,height] = process.argv.slice(2);
const files = await readdir(source,{recursive:true});
for (const name of ['01-collection.png','02-find-a-scent.png','03-outfit.png']) {
  const paths = files.filter(path => basename(path) === name && basename(dirname(path)) === 'takeScreenshot');
  assert.equal(paths.length,1,`Expected one native screenshot named ${name}`);
  const image = sharp(join(source,paths[0]));
  const original = await image.metadata();
  assert.deepEqual([original.width,original.height],[Number(width),Number(height)]);
  await image.removeAlpha().png().toFile(join(destination,name));
  console.log(`Verified ${basename(destination)}/${name} at ${width} × ${height}`);
}
JS
}

capture "$FRAGOUT_SIMULATOR" iphone-6.3-inch 1206 2622
xcrun simctl shutdown "$FRAGOUT_SIMULATOR"

ipad_type="$(xcrun simctl list devicetypes --json | jq -er \
  '[.devicetypes[] | select(.name | test("^iPad Pro.*13[ -]inch";"i"))] | first | .identifier')"
ipad="$(xcrun simctl create 'FragOut App Store iPad' "$ipad_type" 'com.apple.CoreSimulator.SimRuntime.iOS-26-5')"
xcrun simctl bootstatus "$ipad" -b
xcrun simctl install "$ipad" "$RUNNER_TEMP/fragout-release/FragOut.app"
capture "$ipad" ipad-13-inch 2064 2752
