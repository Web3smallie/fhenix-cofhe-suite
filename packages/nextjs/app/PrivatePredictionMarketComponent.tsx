"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FheTypes } from "cofhejs/web";
import { useEncryptInput } from "~~/hooks/useEncryptInput";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useCofheConnected } from "~~/hooks/useCofhe";
import { notification } from "~~/utils/scaffold-eth";

// ─── Owner wallet — only this address sees "Create Market" ───────────────────


// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0b0e", panel: "#111318", border: "#1e2028", border2: "#2a2d3a",
  text: "#e2e4ea", dim: "#6b7280", dim2: "#9ca3af",
  green: "#00d4a4", red: "#ff4d6d", blue: "#3b82f6",
  purple: "#8b5cf6", yellow: "#f59e0b",
  yes: "#0090ff", no: "#ff4d6d",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysLeft(deadline: number) {
  const d = Math.ceil((deadline - Date.now() / 1000) / 86400);
  if (d <= 0) return "Expired";
  return d === 1 ? "1d left" : `${d}d left`;
}
function fmtPool(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}

// ─── Terminal ─────────────────────────────────────────────────────────────────
type LogEntry = { msg: string; type: "sys" | "ok" | "err" | "info" };

function Terminal({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{ background: "#000", borderRadius: 8, padding: "10px 14px", height: 130, overflowY: "auto", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
      {!logs.length
        ? <span style={{ color: "#374151" }}>// CoFHE encryption log…</span>
        : logs.map((l, i) => (
            <span key={i} style={{ color: l.type === "ok" ? C.green : l.type === "err" ? C.red : l.type === "sys" ? "#67e8f9" : C.dim2 }}>{l.msg}</span>
          ))
      }
    </div>
  );
}

// ─── Prob bar ─────────────────────────────────────────────────────────────────
function ProbBar({ yes, compact = false }: { yes: number; compact?: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: compact ? 6 : 8, marginBottom: compact ? 4 : 6 }}>
        <div style={{ width: `${yes}%`, background: C.yes }} />
        <div style={{ width: `${100 - yes}%`, background: C.no }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: compact ? 10 : 12 }}>
        <span style={{ color: C.yes, fontWeight: 700 }}>Yes {yes}%</span>
        <span style={{ color: C.no,  fontWeight: 700 }}>No {100 - yes}%</span>
      </div>
    </div>
  );
}

// ─── Market Card ──────────────────────────────────────────────────────────────
function MarketCard({ market, onSelect, selected, compact = false }: {
  market: any; onSelect: (m: any) => void; selected: boolean; compact?: boolean;
}) {
  const isActive = market.deadline > Date.now() / 1000 && !market.resolved;
  const urgency  = !market.resolved && (market.deadline - Date.now() / 1000) < 86400 * 3;
  return (
    <div onClick={() => onSelect(market)} style={{ background: selected ? "#16191f" : C.panel, border: `1px solid ${selected ? C.blue : C.border}`, borderRadius: 12, padding: compact ? "12px 14px" : "16px 18px", cursor: "pointer", marginBottom: compact ? 6 : 10, transition: "all 0.15s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: compact ? 8 : 10 }}>
        <div style={{ fontWeight: 600, fontSize: compact ? 12 : 14, color: C.text, lineHeight: 1.4, flex: 1 }}>{market.question}</div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          {market.resolved
            ? <span style={{ background: "rgba(0,212,164,0.15)", color: C.green, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>✅ {market.yesWon ? "YES won" : "NO won"}</span>
            : <span style={{ background: urgency ? "rgba(255,77,109,0.15)" : "rgba(59,130,246,0.12)", color: urgency ? C.red : C.blue, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{daysLeft(market.deadline)}</span>
          }
          {!market.resolved && <span style={{ background: isActive ? "rgba(0,212,164,0.12)" : "rgba(107,114,128,0.12)", color: isActive ? C.green : C.dim, padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 600 }}>{isActive ? "● LIVE" : "● CLOSED"}</span>}
        </div>
      </div>
      <ProbBar yes={market.yesChance} compact={compact} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: compact ? 8 : 10, fontSize: compact ? 10 : 11, color: C.dim }}>
        <span>💰 {fmtPool(market.totalPool)}</span>
        <span>👥 {market.totalBets.toLocaleString()} bets</span>
        <span style={{ color: C.purple, fontSize: 9, fontWeight: 600 }}>🔐 FHE</span>
      </div>
    </div>
  );
}

// ─── Bet Panel ────────────────────────────────────────────────────────────────
function BetPanel({ market, logs, onBet, loading }: {
  market: any; logs: LogEntry[]; onBet: (side: boolean, amount: string) => void; loading: boolean;
}) {
  const [side, setSide]     = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const isActive  = market.deadline > Date.now() / 1000 && !market.resolved;
  const potReturn = amount ? (parseFloat(amount) / (side === "YES" ? market.yesChance / 100 : (100 - market.yesChance) / 100)).toFixed(4) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Title */}
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Selected Market</div>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.text, lineHeight: 1.4 }}>{market.question}</div>
      </div>
      {/* Prob + stats */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <ProbBar yes={market.yesChance} />
        <div style={{ marginTop: 8, fontSize: 11, color: C.dim, display: "flex", gap: 12 }}>
          <span>💰 {fmtPool(market.totalPool)}</span>
          <span>👥 {market.totalBets.toLocaleString()}</span>
          <span>{daysLeft(market.deadline)}</span>
        </div>
      </div>
      {/* Bet form or resolved state */}
      {isActive ? (
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, flex: 1 }}>
          {/* YES/NO toggle */}
          <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, marginBottom: 14 }}>
            {(["YES", "NO"] as const).map(s => (
              <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: "9px", borderRadius: 6, border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer", background: side === s ? (s === "YES" ? C.yes : C.no) : "transparent", color: side === s ? "#fff" : C.dim, transition: "all 0.15s" }}>
                {s === "YES" ? "✅ YES" : "❌ NO"}
              </button>
            ))}
          </div>
          {/* Privacy notice */}
          <div style={{ background: "#0f1a2e", border: `1px solid #1d4ed8`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#93c5fd" }}>
            🔐 Your bet side & amount are CoFHE-encrypted on-chain.
          </div>
          {/* Amount */}
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Bet Amount (ETH)</div>
          <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
          {/* Quick presets */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {["0.001", "0.005", "0.01"].map(v => (
              <button key={v} onClick={() => setAmount(v)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim2, fontSize: 11, padding: "5px 0", cursor: "pointer" }}>{v} ETH</button>
            ))}
          </div>
          {/* Potential return */}
          {potReturn && (
            <div style={{ background: C.bg, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 11 }}>
              {[["Bet", `${amount} ETH on ${side}`], ["Potential return", `${potReturn} ETH`], ["Chance", `${side === "YES" ? market.yesChance : 100 - market.yesChance}%`]].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                  <span style={{ color: C.dim }}>{k}</span>
                  <span style={{ color: i === 1 ? C.green : i === 2 ? (side === "YES" ? C.yes : C.no) : C.dim2, fontWeight: i === 1 ? 700 : 400 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {/* Bet button */}
          <button onClick={() => onBet(side === "YES", amount)} disabled={!amount || loading}
            style={{ width: "100%", padding: "12px", borderRadius: 8, border: "none", cursor: !amount || loading ? "not-allowed" : "pointer", background: !amount || loading ? C.border : side === "YES" ? C.yes : C.no, color: !amount || loading ? C.dim : "#fff", fontWeight: 800, fontSize: 15 }}>
            {loading ? "🔐 Encrypting bet…" : `🔒 Bet ${side}`}
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{market.resolved ? (market.yesWon ? "✅" : "❌") : "🔒"}</div>
            <div style={{ fontWeight: 700, color: market.resolved ? (market.yesWon ? C.green : C.red) : C.dim2, fontSize: 15 }}>
              {market.resolved ? (market.yesWon ? "YES Won" : "NO Won") : "Market Closed"}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{market.resolved ? "This market has been resolved" : "Deadline has passed"}</div>
          </div>
        </div>
      )}
      {/* Terminal */}
      <div style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, marginBottom: 6, letterSpacing: "0.5px" }}>⚡ CoFHE LOG</div>
        <Terminal logs={logs} />
      </div>
    </div>
  );
}

// ─── Create Market Panel (owner only) ─────────────────────────────────────────
function CreateMarketPanel({ onCreate, loading }: { onCreate: (q: string, days: number) => void; loading: boolean }) {
  const [question, setQuestion] = useState("");
  const [days, setDays]         = useState(30);
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Prediction Question</div>
      <textarea placeholder="e.g. Will ETH reach $5,000 before July 2026?" value={question} onChange={e => setQuestion(e.target.value)} rows={3}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", marginBottom: 12, fontFamily: "inherit", lineHeight: 1.5 }} />
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Duration: <span style={{ color: C.yellow, fontWeight: 700 }}>{days} days</span></div>
      <input type="range" min={1} max={90} value={days} onChange={e => setDays(+e.target.value)} style={{ width: "100%", accentColor: C.yellow, marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[7, 30, 60].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{ flex: 1, background: days === d ? C.border2 : C.bg, border: `1px solid ${days === d ? C.purple : C.border}`, borderRadius: 6, color: days === d ? C.text : C.dim2, fontSize: 11, padding: "5px 0", cursor: "pointer" }}>{d}d</button>
        ))}
      </div>
      <button onClick={() => { if (question) onCreate(question, days); }} disabled={!question || loading}
        style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", cursor: !question || loading ? "not-allowed" : "pointer", background: !question || loading ? C.border : C.purple, color: !question || loading ? C.dim : "#fff", fontWeight: 800, fontSize: 14 }}>
        {loading ? "⏳ Creating…" : "➕ Create Market"}
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PrivatePredictionMarketComponent() {
  const { address } = useAccount();
  const cofheConnected  = useCofheConnected();
  const { onEncryptInput, isEncryptingInput } = useEncryptInput();
  

  const [selectedMarket, setSelectedMarket]   = useState<any>(null);
  const [markets, setMarkets]                 = useState<any[]>([]);
  const [logs, setLogs]                       = useState<LogEntry[]>([]);
  const [bettingLoading, setBettingLoading]   = useState(false);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [view, setView]                       = useState<"markets" | "create">("markets");
  const [filter, setFilter]                   = useState<"all" | "live" | "resolved">("all");
  const [isMobile, setIsMobile]               = useState(false);
  const [mobileTab, setMobileTab]             = useState<"markets" | "bet" | "create">("markets");
  const [leftExpanded, setLeftExpanded]       = useState(false);
  const [rightExpanded, setRightExpanded]     = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") =>
    setLogs(prev => [...prev.slice(-49), { msg, type }]), []);

  // ── On-chain reads ──────────────────────────────────────────────────────────
  const { data: marketCount } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "marketCount", watch: true });
  const { data: market0 } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "getMarket", args: [0n], watch: true });
  const { data: market1 } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "getMarket", args: [1n], watch: true });
  const { data: market2 } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "getMarket", args: [2n], watch: true });
  const { data: market3 } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "getMarket", args: [3n], watch: true });
  const { data: market4 } = useScaffoldReadContract({ contractName: "PrivatePredictionMarket", functionName: "getMarket", args: [4n], watch: true });

  // Build markets list from on-chain data only
  useEffect(() => {
    const count = marketCount ? Number(marketCount) : 0;
    const raw = [market0, market1, market2, market3, market4].slice(0, count).filter(Boolean);
    const parsed = raw.map((m: any, i: number) => ({
      id:         i,
      question:   m[0] as string,
      deadline:   Number(m[1]),
      totalBets:  Number(m[2]),
      totalPool:  Number(m[3]),
      resolved:   m[4] as boolean,
      yesWon:     m[5] as boolean,
      // Bets are private — show 50/50 until resolved
      yesChance:  m[4] ? (m[5] ? 100 : 0) : 50,
    }));
    setMarkets(parsed);
    if (parsed.length > 0 && !selectedMarket) setSelectedMarket(parsed[0]);
  }, [marketCount, market0, market1, market2, market3, market4]);

  // ── Write contracts ─────────────────────────────────────────────────────────
  const { writeContractAsync: betAsync }    = useScaffoldWriteContract("PrivatePredictionMarket");
  const { writeContractAsync: createAsync } = useScaffoldWriteContract("PrivatePredictionMarket");

  // ── Place Bet ───────────────────────────────────────────────────────────────
  const handleBet = async (side: boolean, amount: string) => {
    if (!amount || !cofheConnected) {
      if (!cofheConnected) notification.error("Connect CoFHE wallet first");
      return;
    }
    setBettingLoading(true); setLogs([]);
    try {
      addLog(`▶ Placing ${side ? "YES" : "NO"} bet on market #${selectedMarket.id}…`, "sys");
      const amountVal = BigInt(Math.floor(parseFloat(amount) * 100));
      addLog("  Encrypting bet side (bool) via CoFHE…", "info");
      const encSide = await onEncryptInput(FheTypes.Bool, side);
      if (!encSide) throw new Error("Side encryption failed");
      addLog("✓ Side encrypted 🔐", "ok");
      addLog("  Encrypting bet amount (uint32) via CoFHE…", "info");
      const encAmount = await onEncryptInput(FheTypes.Uint32, amountVal);
      if (!encAmount) throw new Error("Amount encryption failed");
      addLog("✓ Amount encrypted 🔐", "ok");
      addLog("▶ Broadcasting tx → PrivatePredictionMarket…", "sys");
      await betAsync({
        functionName: "placeBet",
        args: [BigInt(selectedMarket.id), encSide, encAmount],
        value: parseEther(amount),
      });
      addLog(`✓ Bet placed — side & amount hidden on-chain 🔐`, "ok");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setBettingLoading(false); }
  };

  // ── Create Market (owner only) ──────────────────────────────────────────────
  const handleCreate = async (question: string, days: number) => {
    
    setCreatingLoading(true); setLogs([]);
    try {
      addLog("▶ Creating prediction market…", "sys");
      await createAsync({
        functionName: "createMarket",
        args: [question, BigInt(days * 24 * 60 * 60)],
      });
      addLog(`✓ Market created — "${question.slice(0, 50)}…"`, "ok");
      setView("markets");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setCreatingLoading(false); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const filtered   = markets.filter(m => filter === "live" ? (!m.resolved && m.deadline > Date.now()/1000) : filter === "resolved" ? m.resolved : true);
  const totalPool  = markets.reduce((a, m) => a + m.totalPool, 0);
  const liveCount  = markets.filter(m => !m.resolved && m.deadline > Date.now()/1000).length;
  const totalBets  = markets.reduce((a, m) => a + m.totalBets, 0);

  const leftW  = leftExpanded  ? "63%" : rightExpanded ? "37%" : "50%";
  const rightW = rightExpanded ? "63%" : leftExpanded  ? "37%" : "50%";

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE
  // ─────────────────────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: C.text }}>
      {/* Nav */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 12px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#0090ff,#8b5cf6)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🎯</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>FHE Predict</span>
          <span style={{ fontSize: 9, color: C.dim, background: C.border, borderRadius: 3, padding: "1px 5px" }}>Arb Sepolia</span>
        </div>
        <div style={{ fontSize: 9, color: C.dim2, display: "flex", alignItems: "center", gap: 4 }}>
          {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[
          { label: "Total Pool",   val: fmtPool(totalPool),          color: C.purple  },
          { label: "Live Markets", val: `${liveCount}`,              color: C.green   },
          { label: "Total Bets",   val: totalBets.toLocaleString(),  color: "#67e8f9" },
          { label: "Privacy",      val: "🔐 FHE",                   color: C.blue    },
        ].map((s, i) => (
          <div key={i} style={{ flexShrink: 0, paddingRight: i < 3 ? 16 : 0, paddingLeft: i > 0 ? 16 : 0, borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ fontSize: 8, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs — owner gets Create tab */}
      <div style={{ display: "flex", background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        {([
          { key: "markets", label: "📊 Markets" },
          { key: "bet",     label: "🎲 Bet"     },
          ...([{ key: "create", label: "➕ Create" }]),
        ] as { key: "markets" | "bet" | "create"; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setMobileTab(t.key)} style={{ flex: 1, background: "none", border: "none", borderBottom: mobileTab === t.key ? `2px solid ${C.blue}` : "2px solid transparent", color: mobileTab === t.key ? C.text : C.dim, padding: "9px 4px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Markets */}
      {mobileTab === "markets" && (
        <div style={{ padding: "10px 10px 0" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {(["all", "live", "resolved"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ flex: 1, background: filter === f ? C.border2 : "transparent", border: `1px solid ${filter === f ? C.purple : C.border}`, borderRadius: 6, color: filter === f ? C.text : C.dim, fontSize: 10, padding: "5px 0", cursor: "pointer", fontWeight: filter === f ? 700 : 400, textTransform: "capitalize" }}>{f}</button>
            ))}
          </div>
          {filtered.length === 0
            ? <div style={{ textAlign: "center", color: C.dim, padding: 32, fontSize: 13 }}>No markets yet.</div>
            : filtered.map(m => <MarketCard key={m.id} market={m} onSelect={m2 => { setSelectedMarket(m2); setMobileTab("bet"); }} selected={selectedMarket?.id === m.id} compact />)
          }
        </div>
      )}

      {/* Bet */}
      {mobileTab === "bet" && (
        selectedMarket
          ? <div style={{ background: C.panel }}><BetPanel market={selectedMarket} logs={logs} onBet={handleBet} loading={bettingLoading || isEncryptingInput} /></div>
          : <div style={{ padding: 32, textAlign: "center", color: C.dim, fontSize: 13 }}>← Go to Markets and select one</div>
      )}

      {/* Create (owner only) */}
      {mobileTab === "create" && (
        <div style={{ background: C.panel }}>
          <div style={{ padding: "14px 14px 4px", fontSize: 13, fontWeight: 700, color: C.text }}>➕ Create Prediction Market</div>
          <CreateMarketPanel onCreate={handleCreate} loading={creatingLoading} />
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", height: 50, gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#0090ff,#8b5cf6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🎯</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>FHE Predict</span>
          <span style={{ fontSize: 11, color: C.dim, background: C.border, borderRadius: 4, padding: "2px 6px" }}>Arbitrum Sepolia</span>
        </div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 3 }}>
          {(["all", "live", "resolved"] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setView("markets"); }} style={{ background: filter === f && view === "markets" ? C.border : "transparent", border: "none", borderRadius: 6, color: filter === f && view === "markets" ? C.text : C.dim, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
              {f === "all" ? "All Markets" : f === "live" ? "🟢 Live" : "✅ Resolved"}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Only owner sees Create Market */}
          {true && (
            <button onClick={() => setView(view === "create" ? "markets" : "create")}
              style={{ background: view === "create" ? C.border2 : C.purple, border: "none", borderRadius: 8, color: "#fff", padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {view === "create" ? "← Back" : "➕ Create Market"}
            </button>
          )}
          <span style={{ fontSize: 11, color: C.dim2 }}>{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>

      {/* Stats banner */}
      <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 40 }}>
        {[
          { label: "Total Pool",   val: fmtPool(totalPool),         sub: "across all markets",  color: C.purple  },
          { label: "Live Markets", val: `${liveCount}`,             sub: "currently active",    color: C.green   },
          { label: "Total Bets",   val: totalBets.toLocaleString(), sub: "placed on-chain",     color: "#67e8f9" },
          { label: "Privacy",      val: "🔐 CoFHE",                sub: "bets encrypted",      color: C.blue    },
        ].map((s, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: i < 3 ? 40 : 0, borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: s.color, opacity: 0.7 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT — Markets list or Create form */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, borderRight: `1px solid ${C.border}` }}>
          {view === "create" ? (
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 16 }}>➕ Create Prediction Market</div>
              <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <CreateMarketPanel onCreate={handleCreate} loading={creatingLoading} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{filtered.length} market{filtered.length !== 1 ? "s" : ""}</div>
              {filtered.length === 0
                ? <div style={{ textAlign: "center", color: C.dim, padding: 60, fontSize: 14 }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                    <div style={{ fontWeight: 600, color: C.dim2 }}>No markets yet.</div>
                    {<div style={{ fontSize: 12, marginTop: 6, color: C.dim }}>Use ➕ Create Market to add the first one.</div>}
                  </div>
                : filtered.map(m => <MarketCard key={m.id} market={m} onSelect={setSelectedMarket} selected={selectedMarket?.id === m.id} />)
              }
            </>
          )}
        </div>

        {/* RIGHT — Bet panel */}
        <div style={{ width: 360, flexShrink: 0, background: C.panel, display: "flex", flexDirection: "column" }}>
          {selectedMarket
            ? <BetPanel market={selectedMarket} logs={logs} onBet={handleBet} loading={bettingLoading || isEncryptingInput} />
            : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: C.dim, fontSize: 13, textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                  <div>Select a market to place your bet</div>
                </div>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
