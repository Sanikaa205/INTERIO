// Floor-plan generation harness.
//   npx tsx scripts/floorplan-harness.ts <mode> [N=20] [plots=12x12,12x15,15x20] [concurrency=4]
// Modes:
//   baseline  current Gemini path: Gemini returns coordinates, validateGeminiFloorPlan accepts/rejects
//   solver    deterministic grow-by-attachment solver alone (no network)
//   topology  Gemini topology hint -> solver (the new path), via the injectable model caller
// Writes scripts/harness-results/<mode>-<timestamp>.json and prints a summary.
process.env.INTERIO_NO_LISTEN = '1';
import fs from 'node:fs';

const UI_DEFAULT_PROGRAM = [
  { name: 'Living Room', type: 'living', minSize: 24 }, { name: 'Master Bedroom', type: 'bedroom', minSize: 18 },
  { name: 'Guest Bedroom', type: 'bedroom', minSize: 14 }, { name: 'Kitchen & Dining', type: 'kitchen', minSize: 16 },
  { name: 'Master Bathroom', type: 'bathroom', minSize: 6 }, { name: 'Powder Room', type: 'bathroom', minSize: 4 },
];

const [mode = 'baseline', nArg = '20', plotsArg = '12x12,12x15,15x20', concArg = '4'] = process.argv.slice(2);
const N = Number(nArg);
const plots = plotsArg.split(',').map((p) => p.split('x').map(Number) as [number, number]);
const concurrency = Number(concArg);

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

function categorize(reason: string): string {
  if (/area .* outside/.test(reason)) return 'room-area-out-of-band';
  if (/unreachable/.test(reason)) return 'unreachable-rooms';
  if (/hallway/.test(reason)) return 'hallway-invalid';
  if (/overlap/.test(reason)) return 'overlap';
  if (/coverage/.test(reason)) return 'coverage';
  if (/stacked/.test(reason)) return 'column-stack';
  if (/min side|aspect/.test(reason)) return 'min-side-or-aspect';
  if (/room count|missing|duplicate|invalid room|non-numeric/.test(reason)) return 'schema-or-names';
  if (/^http|503|429|timed out|timeout|fetch|UNAVAILABLE/i.test(reason)) return 'api-error-or-timeout';
  if (/JSON|Unexpected token/.test(reason)) return 'unparseable-json';
  return 'other:' + reason.slice(0, 50);
}

async function main() {
  const server: any = await import('../server.ts');
  const realError = console.error;
  const jobs: { plot: [number, number]; i: number }[] = [];
  for (const plot of plots) for (let i = 0; i < N; i++) jobs.push({ plot, i });
  const results: any[] = [];

  // Checkpointing: every finished job is appended to a JSONL file, so a run can
  // be stopped at any time (Ctrl+C / kill) and resumed later by re-running the
  // same command. HARNESS_FRESH=1 ignores and replaces an existing checkpoint.
  const checkpoint = `scripts/harness-results/${mode}-checkpoint.jsonl`;
  if (process.env.HARNESS_FRESH === '1' && fs.existsSync(checkpoint)) fs.unlinkSync(checkpoint);
  if (fs.existsSync(checkpoint)) {
    for (const line of fs.readFileSync(checkpoint, 'utf8').split('\n').filter(Boolean)) results.push(JSON.parse(line));
    realError(`resuming: ${results.length} of ${jobs.length} jobs already done`);
  }
  const doneKeys = new Set(results.map((r) => `${r.plot}#${r.i}`));

  async function runJob({ plot: [w, l], i }: { plot: [number, number]; i: number }) {
    const t0 = Date.now();
    const rec: any = { plot: `${w}x${l}`, i, accepted: false, reason: null as string | null };
    const captured: string[] = [];
    try {
      if (mode === 'baseline') {
        const ai = server.getGeminiClient();
        if (!ai) throw new Error('no GEMINI_API_KEY');
        const prompt = server.createFloorPlanPrompt(w, l, UI_DEFAULT_PROGRAM, '');
        let text: string;
        try {
          text = await server.generateGeminiContentWithFallback(ai, prompt, {
            temperature: 0.15, responseMimeType: 'application/json',
            attempts: [{ model: 'gemini-3.5-flash', timeoutMs: 100000 }, { model: 'gemini-3.5-flash-lite', timeoutMs: 25000 }],
          });
        } catch (e: any) { rec.reason = 'http: ' + String(e?.message || e).slice(0, 120); throw e; }
        let parsed: any;
        try { parsed = server.parseJsonResponse(text); } catch (e: any) { rec.reason = 'JSON ' + e.message; throw e; }
        const prevDebug = process.env.DEBUG_LAYOUT;
        process.env.DEBUG_LAYOUT = '1';
        console.error = (...a: any[]) => { const s = a.join(' '); if (s.startsWith('[gemini-reject]')) captured.push(s.slice(16)); };
        const ok = server.validateGeminiFloorPlan(parsed, w, l, UI_DEFAULT_PROGRAM, '');
        console.error = realError; process.env.DEBUG_LAYOUT = prevDebug;
        rec.accepted = !!ok;
        if (!ok) rec.reason = captured[0] || 'rejected';
      } else if (mode === 'solver') {
        const plan = server.generateAlgorithmicFloorPlan(w, l, UI_DEFAULT_PROGRAM, '', `h${i}`);
        rec.accepted = !plan.constraintError;
        if (!rec.accepted) rec.reason = plan.constraintError;
      } else if (mode === 'topology') {
        const plan = await server.generateFloorPlanWithTopology({ plotW: w, plotL: l, rooms: UI_DEFAULT_PROGRAM, userRequirements: '', variationSeed: `h${i}` });
        rec.accepted = !plan.constraintError;
        rec.hintUsed = plan.topologyHintUsed ?? null;
        rec.topologyAttempts = plan.topologyAttempts ?? null;
        rec.topologyErrors = plan.topologyErrors ?? null;
        if (!rec.accepted) rec.reason = plan.constraintError;
      }
    } catch (e: any) {
      console.error = realError;
      rec.reason = rec.reason || String(e?.message || e).slice(0, 160);
    }
    rec.latencyMs = Date.now() - t0;
    results.push(rec);
    fs.appendFileSync(checkpoint, JSON.stringify(rec) + '\n');
    realError(`${rec.plot} #${rec.i} ${rec.accepted ? 'OK' : 'REJECT'} ${rec.latencyMs}ms ${rec.reason ? '- ' + String(rec.reason).slice(0, 90) : ''}`);
  }

  // Solver-only modes are CPU-bound and synchronous: run strictly sequentially.
  const conc = mode === 'solver' ? 1 : concurrency;
  // The free Gemini tier is rate-limited per minute, so pace network modes (the sleep is outside the timed region).
  const minIntervalMs = Number(process.env.HARNESS_MIN_INTERVAL_MS ?? (mode === 'solver' ? 0 : 6000));
  let lastStart = 0;
  const queue = jobs.filter((j) => !doneKeys.has(`${j.plot[0]}x${j.plot[1]}#${j.i}`));
  await Promise.all(Array.from({ length: conc }, async () => {
    while (queue.length) {
      const job = queue.shift()!;
      const wait = lastStart + minIntervalMs - Date.now();
      lastStart = Math.max(Date.now(), lastStart + minIntervalMs);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      await runJob(job);
    }
  }));

  const summary: any = {};
  for (const [w, l] of plots) {
    const rs = results.filter((r) => r.plot === `${w}x${l}`);
    const reasons: Record<string, number> = {};
    for (const r of rs.filter((x) => !x.accepted)) { const c = categorize(String(r.reason)); reasons[c] = (reasons[c] || 0) + 1; }
    summary[`${w}x${l}`] = {
      n: rs.length, acceptRate: +(rs.filter((r) => r.accepted).length / Math.max(1, rs.length)).toFixed(2),
      medianLatencyMs: median(rs.map((r) => r.latencyMs)), p90LatencyMs: [...rs.map((r) => r.latencyMs)].sort((a, b) => a - b)[Math.floor(rs.length * 0.9)] ?? null,
      hintUsedRate: mode === 'topology' ? +(rs.filter((r) => r.hintUsed).length / Math.max(1, rs.length)).toFixed(2) : undefined,
      rejectReasons: reasons,
    };
  }
  const out = { mode, N, concurrency: conc, program: 'UI default (FloorPlanWorkflow.tsx)', at: new Date().toISOString(), summary, results };
  const file = `scripts/harness-results/${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  if (fs.existsSync(checkpoint)) fs.unlinkSync(checkpoint);
  console.log(JSON.stringify(summary, null, 2));
  console.log('saved', file);
  process.exit(0);
}
main();
