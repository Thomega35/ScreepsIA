// Usage: node scripts/upload.mjs [branch]
// Uploads the files built in BUILD_PATH straight to the server, for when the Screeps client isn't running to sync them.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";

config();
const TOKEN = process.env.SCREEPS_TOKEN;
const BUILD_PATH = process.env.BUILD_PATH || "dist";
const branch = process.argv[2] || "default";

if (!TOKEN) {
  console.error("SCREEPS_TOKEN missing in .env");
  process.exit(1);
}

// Screeps module names are file names without the .js extension
const modules = Object.fromEntries(
  readdirSync(BUILD_PATH)
    .filter(f => f.endsWith(".js"))
    .map(f => [f.slice(0, -3), readFileSync(join(BUILD_PATH, f), "utf8")])
);
const res = await fetch("https://screeps.com/api/user/code", {
  method: "POST",
  headers: { "X-Token": TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ branch, modules })
});
const body = await res.text();
console.log(`upload ${Object.keys(modules).join(", ")} to ${branch}: HTTP ${res.status} ${body.slice(0, 200)}`);
process.exit(res.ok && !body.includes("error") ? 0 : 1);
