// step4-verify.mjs
import https from "https";

const url = "https://hedera-mcp-platform-production.up.railway.app/health";

https.get(url, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    const json = JSON.parse(data);
    console.log("Status:", json.status);
    console.log("Watcher running:", json.watcher_running);
    console.log("Uptime:", json.uptime_seconds, "seconds");
    console.log(json.status === "ok" ? "✅ Platform is live" : "❌ Check Railway logs");
  });
}).on("error", (e) => console.error("Error:", e.message));