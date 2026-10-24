const t0 = Date.now();
const log = (m: string) => console.log(`${Date.now() - t0}ms ${m}`);
setTimeout(() => {
  log("WATCHDOG: hung");
  process.exit(2);
}, 25000).unref();

log("start");
await import("react-dom/server");
log("react-dom/server loaded");
await import("../lib/format.ts");
log("lib/format loaded");
await import("../lib/candidate-profiles.ts");
log("lib/candidate-profiles loaded");
await import("../lib/candidates.ts");
log("lib/candidates loaded");
await import("../components/CitedText.tsx");
log("components/CitedText loaded");
await import("../components/CandidateResearch.tsx");
log("components/CandidateResearch loaded");
process.exit(0);
