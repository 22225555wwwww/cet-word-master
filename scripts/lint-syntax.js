// 语法检查脚本：递归对 server.js / src / scripts / test / public 下所有 .js 跑 node --check
// 跨平台（Windows 也适用），供 npm run lint 与 CI 使用
var fs = require("fs");
var path = require("path");
var { spawnSync } = require("child_process");

var ROOT = path.join(__dirname, "..");
var SCAN_DIRS = ["src", "scripts", "test", "public"];
var SCAN_FILES = ["server.js"];

function collect(dir, acc) {
  for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collect(full, acc);
    } else if (entry.name.endsWith(".js")) {
      acc.push(full);
    }
  }
  return acc;
}

var files = [];
for (var f of SCAN_FILES) files.push(path.join(ROOT, f));
for (var d of SCAN_DIRS) collect(path.join(ROOT, d), files);

var failed = 0;
for (var file of files) {
  var result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed++;
    console.error("FAIL " + path.relative(ROOT, file));
    console.error(result.stderr || result.stdout);
  }
}

console.log(failed === 0
  ? "syntax OK (" + files.length + " files)"
  : failed + " file(s) failed syntax check");
process.exit(failed === 0 ? 0 : 1);
