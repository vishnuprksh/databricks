const fs = require("fs");
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
pool
  .query("SELECT count(*) FROM fpl.predictions")
  .then((r) => { console.log("OK", r.rows[0]); process.exit(0); })
  .catch((e) => { console.log("ERR", e.message); process.exit(1); });
