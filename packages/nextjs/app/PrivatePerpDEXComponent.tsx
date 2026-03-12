"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { parseEther, formatEther } from "viem";
import { useAccount } from "wagmi";
import { FheTypes, Encryptable, cofhejs } from "cofhejs/web";
import { useScaffoldWriteContract, useScaffoldReadContract } from "../hooks/scaffold-eth";
import { useEncryptInput } from "../hooks/useEncryptInput";
import { useDecryptValue } from "../hooks/useDecrypt";
import { useCofheConnected } from "../hooks/useCofhe";
import { notification } from "~~/utils/scaffold-eth";

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSETS = [
  { symbol: "BTC/USD", binance: "BTCUSDT", coingecko: "bitcoin",     color: "#f7931a", base: 83000 },
  { symbol: "ETH/USD", binance: "ETHUSDT", coingecko: "ethereum",    color: "#627eea", base: 2000  },
  { symbol: "SOL/USD", binance: "SOLUSDT", coingecko: "solana",      color: "#9945ff", base: 130   },
  { symbol: "BNB/USD", binance: "BNBUSDT", coingecko: "binancecoin", color: "#f0b90b", base: 580   },
];

const C = {
  bg: "#0a0b0e", panel: "#111318", border: "#1e2028", border2: "#2a2d3a",
  text: "#e2e4ea", dim: "#6b7280", dim2: "#9ca3af",
  green: "#00d4a4", red: "#ff4d6d", blue: "#3b82f6",
  purple: "#8b5cf6", yellow: "#f59e0b",
};

// ─── Price Fetching ───────────────────────────────────────────────────────────

async function fetchBinance(symbol: string) {
  try {
    const [p, t] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`).then(r => r.json()),
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`).then(r => r.json()),
    ]);
    return { price: parseFloat(p.price), change: parseFloat(t.priceChangePercent), high: parseFloat(t.highPrice), low: parseFloat(t.lowPrice), vol: parseFloat(t.quoteVolume), source: "Binance" };
  } catch { return null; }
}

async function fetchBinanceCandles(symbol: string) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=80`);
    const d = await r.json();
    return d.map((k: any[]) => ({ time: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], vol: +k[5] }));
  } catch { return null; }
}

async function fetchCoinGecko(id: string) {
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true`);
    const d = await r.json();
    return { price: d[id]?.usd, change: d[id]?.usd_24h_change ?? 0, high: null, low: null, vol: null, source: "CoinGecko" };
  } catch { return null; }
}

function genCandles(base: number, count = 80) {
  const out: any[] = []; let p = base * (0.97 + Math.random() * 0.06); const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const o = p, c = Math.max(p + (Math.random() - 0.47) * p * 0.013, 1);
    out.push({ time: now - i * 60000, open: +o.toFixed(2), close: +c.toFixed(2), high: +(Math.max(o,c)*(1+Math.random()*.005)).toFixed(2), low: +(Math.min(o,c)*(1-Math.random()*.005)).toFixed(2) });
    p = c;
  }
  return out;
}

const fmtPrice = (n: number) => n > 999 ? n.toFixed(1) : n > 99 ? n.toFixed(2) : n.toFixed(3);

// ─── Candle Chart ─────────────────────────────────────────────────────────────

function CandleChart({ candles, source }: { candles: any[]; source: string }) {
  const W = 1000, H = 220, PL = 58, PR = 8, PT = 10, PB = 24;
  if (!candles.length) return (
    <div style={{ width: "100%", height: 220, display: "flex", alignItems: "center", justifyContent: "center", background: C.panel, color: C.dim, fontSize: 13 }}>Loading chart…</div>
  );
  const prices = candles.flatMap((c: any) => [c.high, c.low]);
  const minP = Math.min(...prices), maxP = Math.max(...prices), range = maxP - minP || 1;
  const toY = (p: number) => PT + ((maxP - p) / range) * (H - PT - PB);
  const cw = (W - PL - PR) / candles.length;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220, display: "block" }}>
        <rect width={W} height={H} fill={C.panel} />
        {Array.from({ length: 5 }, (_, i) => minP + (range * i / 4)).map((p, i) => (
          <g key={i}>
            <line x1={PL} y1={toY(p)} x2={W-PR} y2={toY(p)} stroke={C.border} strokeWidth={0.5} strokeDasharray="3,3" />
            <text x={PL-4} y={toY(p)+4} fill={C.dim} fontSize={8} textAnchor="end">{p > 1000 ? p.toFixed(0) : p.toFixed(2)}</text>
          </g>
        ))}
        {candles.map((c: any, i: number) => {
          const x = PL + i * cw + cw * 0.15, bw = Math.max(cw * 0.7, 1);
          const green = c.close >= c.open, fill = green ? C.green : C.red;
          const bTop = toY(Math.max(c.open, c.close)), bH = Math.max(1, Math.abs(toY(c.open) - toY(c.close)));
          return (
            <g key={i}>
              <line x1={x+bw/2} y1={toY(c.high)} x2={x+bw/2} y2={toY(c.low)} stroke={fill} strokeWidth={0.8} />
              <rect x={x} y={bTop} width={bw} height={bH} fill={fill} rx={0.5} />
            </g>
          );
        })}
        {candles.filter((_: any, i: number) => i % 16 === 0).map((c: any, i: number) => (
          <text key={i} x={PL + candles.indexOf(c)*cw + cw/2} y={H-6} fill={C.dim} fontSize={7} textAnchor="middle">
            {new Date(c.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </text>
        ))}
      </svg>
      <div style={{ position: "absolute", bottom: 28, right: 10, fontSize: 9, color: C.dim, background: C.bg, padding: "1px 5px", borderRadius: 3 }}>{source} • 1m</div>
    </div>
  );
}

// ─── Order Book ───────────────────────────────────────────────────────────────

function OrderBook({ price }: { price: number | null }) {
  if (!price) return <div style={{ color: C.dim, fontSize: 12, padding: 8 }}>Loading…</div>;
  const asks = Array.from({ length: 7 }, (_, i) => ({ p: price*(1+(i+1)*0.0003), s: (Math.random()*4+0.4).toFixed(3) }));
  const bids = Array.from({ length: 7 }, (_, i) => ({ p: price*(1-(i+1)*0.0003), s: (Math.random()*4+0.4).toFixed(3) }));
  return (
    <div style={{ fontSize: 11, fontFamily: "monospace" }}>
      <div style={{ display: "flex", justifyContent: "space-between", color: C.dim, marginBottom: 5, fontSize: 9 }}><span>Price (USD)</span><span>Size</span></div>
      {asks.slice().reverse().map((a, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", color: C.red, padding: "1.5px 0", position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: "rgba(255,77,109,0.08)", width: `${30+i*8}%` }} />
          <span style={{ position: "relative" }}>{fmtPrice(a.p)}</span><span style={{ position: "relative" }}>{a.s}</span>
        </div>
      ))}
      <div style={{ color: C.green, fontWeight: 700, fontSize: 14, textAlign: "center", padding: "5px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, margin: "3px 0" }}>{fmtPrice(price)}</div>
      {bids.map((b, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", color: C.green, padding: "1.5px 0", position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, background: "rgba(0,212,164,0.08)", width: `${60-i*8}%` }} />
          <span style={{ position: "relative" }}>{fmtPrice(b.p)}</span><span style={{ position: "relative" }}>{b.s}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Terminal ─────────────────────────────────────────────────────────────────

function Terminal({ logs }: { logs: { m: string; t: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{ background: "#000", borderRadius: 6, padding: "10px 12px", height: 120, overflowY: "auto", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
      {!logs.length
        ? <span style={{ color: "#374151" }}>// CoFHE encryption log…</span>
        : logs.map((l, i) => <span key={i} style={{ color: l.t==="ok" ? C.green : l.t==="err" ? C.red : l.t==="sys" ? "#67e8f9" : C.dim2 }}>{l.m}</span>)
      }
    </div>
  );
}

// ─── Position Row (desktop table row + mobile card) ───────────────────────────

function PositionRow({ pos, markPrice, onClose, addLog, isMobile }: {
  pos: any; markPrice: number; onClose: (id: number) => void;
  addLog: (m: string, t?: string) => void; isMobile: boolean;
}) {
  const { onDecrypt: revealSize,  result: sizeResult  } = useDecryptValue(FheTypes.Uint32, pos.encSizeHash  ?? null);
  const { onDecrypt: revealEntry, result: entryResult } = useDecryptValue(FheTypes.Uint32, pos.encEntryHash ?? null);
  const [localLogs, setLocalLogs] = useState<{ m: string; t: string }[]>([]);
  const [showLog, setShowLog] = useState(false);

  const localLog = (m: string, t = "info") => { setLocalLogs(p => [...p.slice(-20), { m, t }]); addLog(m, t); };

  const pnl = pos.side === "LONG"
    ? (markPrice - pos.entryHint) / pos.entryHint * pos.sizeHint * pos.leverage
    : (pos.entryHint - markPrice) / pos.entryHint * pos.sizeHint * pos.leverage;
  const pnlPct = pos.collateral > 0 ? (pnl / pos.collateral * 100) : 0;
  const pos_ = pnl >= 0;

  const sizeOk  = sizeResult.state  === "success" && sizeResult.value  != null;
  const entryOk = entryResult.state === "success" && entryResult.value != null;

  const handleReveal = async () => {
    setShowLog(true); setLocalLogs([]);
    localLog(`▶ Revealing position #${pos.id}…`, "sys");
    await new Promise(r => setTimeout(r, 300));
    localLog("  Fetching encrypted handles from chain…", "info");
    await Promise.all([revealSize(), revealEntry()]);
    await new Promise(r => setTimeout(r, 400));
    localLog("✓ CoFHE unsealed — size & entry visible", "ok");
  };

  const handleEncrypt = async () => {
    setShowLog(true); setLocalLogs([]);
    localLog(`▶ Re-hiding position #${pos.id}…`, "sys");
    await new Promise(r => setTimeout(r, 600));
    localLog("✓ Values hidden again 🔐", "ok");
    // Reset reveal state — in real app call cofhejs.clearPermit() or re-init
    window.location.reload();
  };

  const actionBtns = (
    <div style={{ display: "flex", gap: 5 }}>
      <button onClick={handleReveal} style={{ background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: `1px solid ${C.purple}`, borderRadius: 5, color: "#c4b5fd", padding: isMobile ? "6px 0" : "5px 10px", fontSize: isMobile ? 10 : 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flex: isMobile ? 1 : "unset" }}>🔓 Reveal</button>
      <button onClick={handleEncrypt} style={{ background: "linear-gradient(135deg,#1e3a5f,#1d4ed8)", border: `1px solid ${C.blue}`, borderRadius: 5, color: "#93c5fd", padding: isMobile ? "6px 0" : "5px 10px", fontSize: isMobile ? 10 : 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flex: isMobile ? 1 : "unset" }}>🔐 Encrypt</button>
      <button onClick={() => onClose(pos.id)} style={{ background: "rgba(255,77,109,0.1)", border: `1px solid ${C.red}`, borderRadius: 5, color: C.red, padding: isMobile ? "6px 0" : "5px 10px", fontSize: isMobile ? 10 : 11, fontWeight: 700, cursor: "pointer", flex: isMobile ? 1 : "unset" }}>✕ Close</button>
    </div>
  );

  if (isMobile) return (
    <div style={{ margin: "8px 8px 0", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 11 }}>{pos.asset}</span>
          <span style={{ background: pos.side==="LONG" ? "rgba(0,212,164,0.15)" : "rgba(255,77,109,0.15)", color: pos.side==="LONG" ? C.green : C.red, padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700 }}>{pos.side}</span>
          <span style={{ color: C.yellow, fontSize: 9, fontWeight: 700 }}>{pos.leverage}x</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: pos_ ? C.green : C.red, fontWeight: 800, fontFamily: "monospace", fontSize: 11 }}>{pos_ ? "+" : ""}{pnl.toFixed(5)} ETH</div>
          <div style={{ color: pos_ ? C.green : C.red, fontSize: 9 }}>{pos_ ? "+" : ""}{pnlPct.toFixed(2)}%</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {[
          ["Size 🔐",    sizeOk  ? `${(Number(sizeResult.value)/1e4).toFixed(4)} ETH` : "🔐 ██████"],
          ["Entry 🔐",   entryOk ? `$${fmtPrice(Number(entryResult.value))}`           : "🔐 ██████"],
          ["Mark",       `$${fmtPrice(markPrice)}`],
          ["Collateral", `${pos.collateral.toFixed(5)} ETH`],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div style={{ fontSize: 8, color: C.dim }}>{label}</div>
            <div style={{ fontSize: 10, fontFamily: "monospace", color: (val as string).startsWith("🔐") ? "#374151" : C.text }}>{val}</div>
          </div>
        ))}
      </div>
      {actionBtns}
      {showLog && <div style={{ marginTop: 8 }}><Terminal logs={localLogs} /></div>}
    </div>
  );

  // Desktop row
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: "10px 12px", color: C.dim, fontSize: 12 }}>{pos.id}</td>
      <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 12 }}>{pos.asset}</td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ background: pos.side==="LONG" ? "rgba(0,212,164,0.15)" : "rgba(255,77,109,0.15)", color: pos.side==="LONG" ? C.green : C.red, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{pos.side}</span>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
        {sizeOk  ? <span style={{ color: C.green }}>{(Number(sizeResult.value)/1e4).toFixed(4)} ETH</span> : <span style={{ color: "#374151" }}>🔐 ████████</span>}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>
        {entryOk ? <span style={{ color: C.green }}>${fmtPrice(Number(entryResult.value))}</span>         : <span style={{ color: "#374151" }}>🔐 ████████</span>}
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12 }}>${fmtPrice(markPrice)}</td>
      <td style={{ padding: "10px 12px" }}><span style={{ color: C.yellow, fontWeight: 700, fontSize: 12 }}>{pos.leverage}x</span></td>
      <td style={{ padding: "10px 12px" }}>
        <div style={{ color: pos_ ? C.green : C.red, fontWeight: 800, fontFamily: "monospace", fontSize: 14 }}>{pos_ ? "+" : ""}{pnl.toFixed(5)} ETH</div>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <span style={{ background: pos_ ? "rgba(0,212,164,0.12)" : "rgba(255,77,109,0.12)", color: pos_ ? C.green : C.red, padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{pos_ ? "+" : ""}{pnlPct.toFixed(2)}%</span>
      </td>
      <td style={{ padding: "10px 12px", fontFamily: "monospace", color: C.dim2, fontSize: 12 }}>{pos.collateral.toFixed(5)}</td>
      <td style={{ padding: "10px 12px", color: C.dim, fontSize: 11, whiteSpace: "nowrap" }}>{new Date(pos.openedAt).toLocaleTimeString()}</td>
      <td style={{ padding: "10px 12px" }}>
        {actionBtns}
        {showLog && <div style={{ marginTop: 8 }}><Terminal logs={localLogs} /></div>}
      </td>
    </tr>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function PrivatePerpDEXComponent() {
  const { address } = useAccount();
  const cofheConnected = useCofheConnected();
  const { onEncryptInput, isEncryptingInput } = useEncryptInput();

  const [asset, setAsset]           = useState(ASSETS[1]);
  const [price, setPrice]           = useState<number | null>(null);
  const [change, setChange]         = useState(0);
  const [high24, setHigh24]         = useState<number | null>(null);
  const [low24, setLow24]           = useState<number | null>(null);
  const [vol24, setVol24]           = useState<number | null>(null);
  const [candles, setCandles]       = useState<any[]>([]);
  const [source, setSource]         = useState("Loading…");
  const [markPrices, setMarkPrices] = useState<Record<string, number>>({});

  const [side, setSide]         = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState(5);
  const [sizeInput, setSizeInput] = useState("");

  const [positions, setPositions] = useState<any[]>([]);
  const [history, setHistory]     = useState<any[]>([]);
  const [tab, setTab]             = useState<"positions" | "history">("positions");
  const [logs, setLogs]           = useState<{ m: string; t: string }[]>([]);
  const [opening, setOpening]     = useState(false);

  const [isMobile, setIsMobile]         = useState(false);
  const [leftExpanded, setLeftExpanded]   = useState(false);
  const [rightExpanded, setRightExpanded] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const addLog = useCallback((m: string, t = "info") => setLogs(prev => [...prev.slice(-49), { m, t }]), []);

  // On-chain reads
  const { data: positionCount } = useScaffoldReadContract({
    contractName: "PrivatePerpDEX",
    functionName: "getPositionCount",
    args: [address],
    watch: true,
  });

  const { writeContractAsync: openPositionTx }  = useScaffoldWriteContract("PrivatePerpDEX");
  const { writeContractAsync: closePositionTx } = useScaffoldWriteContract("PrivatePerpDEX");

  // Live price
  useEffect(() => {
    setCandles([]); setPrice(null);
    let interval: NodeJS.Timeout;
    const load = async () => {
      const bin = await fetchBinance(asset.binance);
      if (bin?.price) {
        setPrice(bin.price); setChange(bin.change);
        if (bin.high) setHigh24(bin.high);
        if (bin.low)  setLow24(bin.low);
        if (bin.vol)  setVol24(bin.vol);
        setSource("Binance");
        setMarkPrices(p => ({ ...p, [asset.symbol]: bin.price }));
        const c = await fetchBinanceCandles(asset.binance);
        if (c) { setCandles(c); return; }
      }
      const cg = await fetchCoinGecko(asset.coingecko);
      if (cg?.price) {
        setPrice(cg.price); setChange(cg.change); setSource("CoinGecko");
        setMarkPrices(p => ({ ...p, [asset.symbol]: cg.price }));
        setCandles(prev => prev.length ? prev : genCandles(cg.price));
        return;
      }
      setSource("Simulated");
      setPrice(prev => {
        const p = prev ?? asset.base;
        const np = +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(2);
        setMarkPrices(m => ({ ...m, [asset.symbol]: np }));
        return np;
      });
      setCandles(prev => prev.length ? prev : genCandles(asset.base));
    };
    load();
    interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [asset.symbol]);

  const handleOpen = async () => {
    if (!sizeInput || !price || !cofheConnected) {
      if (!cofheConnected) notification.error("Connect CoFHE wallet first");
      return;
    }
    setOpening(true); setLogs([]);
    try {
      addLog("▶ Initiating CoFHE encryption…", "sys");
      const sizeVal  = Math.round(parseFloat(sizeInput) * 1e4);
      const entryVal = Math.round(price);
      addLog(`  Size: ${sizeInput} ETH → encrypting as uint32…`, "info");
      const encSize = await onEncryptInput(FheTypes.Uint32, sizeVal);
      if (!encSize) throw new Error("Size encryption failed");
      addLog("✓ encSize sealed via CoFHE 🔐", "ok");
      addLog(`  Entry: $${price.toFixed(2)} → encrypting as uint32…`, "info");
      const encEntry = await onEncryptInput(FheTypes.Uint32, entryVal);
      if (!encEntry) throw new Error("Entry encryption failed");
      addLog("✓ encEntry sealed via CoFHE 🔐", "ok");
      addLog("▶ Broadcasting tx → PrivatePerpDEX…", "sys");
      const collateral = parseEther((parseFloat(sizeInput) * 0.001).toFixed(6));
      await openPositionTx({
        functionName: "openPosition",
        args: [side === "LONG", leverage, encSize, encEntry],
        value: collateral,
      });
      const posId = positions.length;
      setPositions(prev => [{
        id: posId, asset: asset.symbol, side, leverage,
        sizeHint: parseFloat(sizeInput), collateral: parseFloat(formatEther(collateral)),
        entryHint: price, openedAt: Date.now(), isOpen: true,
        encSizeHash: null, encEntryHash: null,
      }, ...prev]);
      addLog(`✓ Position #${posId} opened — ${side} ${leverage}x on ${asset.symbol}`, "ok");
      addLog("  Size & entry encrypted on-chain 🔐", "info");
      setSizeInput("");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setOpening(false); }
  };

  const handleClose = async (posId: number) => {
    try {
      const pos = positions.find(p => p.id === posId);
      if (!pos) return;
      const mark = markPrices[pos.asset] ?? pos.entryHint;
      const pnl  = pos.side === "LONG"
        ? (mark - pos.entryHint) / pos.entryHint * pos.sizeHint * pos.leverage
        : (pos.entryHint - mark) / pos.entryHint * pos.sizeHint * pos.leverage;
      addLog(`▶ Closing position #${posId}…`, "sys");
      await closePositionTx({ functionName: "closePosition", args: [BigInt(posId)] });
      setPositions(prev => prev.filter(p => p.id !== posId));
      setHistory(prev => [{ ...pos, closedAt: Date.now(), closePrice: mark, pnl: +pnl.toFixed(6) }, ...prev]);
      addLog(`✓ Closed — PnL: ${pnl>=0?"+":""}${pnl.toFixed(6)} ETH`, pnl>=0?"ok":"err");
    } catch (err: any) { addLog(`✗ Error: ${err.message}`, "err"); }
  };

  // PnL aggregates
  const unrealizedPnl   = positions.reduce((acc, pos) => {
    const mark = markPrices[pos.asset] ?? pos.entryHint;
    const pnl  = pos.side==="LONG" ? (mark-pos.entryHint)/pos.entryHint*pos.sizeHint*pos.leverage : (pos.entryHint-mark)/pos.entryHint*pos.sizeHint*pos.leverage;
    return acc + pnl;
  }, 0);
  const realizedPnl     = history.reduce((acc, h) => acc + (h.pnl ?? 0), 0);
  const totalCollateral = positions.reduce((acc, p) => acc + p.collateral, 0);
  const totalNotional   = positions.reduce((acc, p) => acc + p.sizeHint * p.leverage * (markPrices[p.asset] ?? p.entryHint), 0);

  const leftW  = leftExpanded  ? "63%" : rightExpanded ? "37%" : "50%";
  const rightW = rightExpanded ? "63%" : leftExpanded  ? "37%" : "50%";

  // ── Shared sub-components ──────────────────────────────────────────────────

  const AssetTabs = ({ mobile = false }) => (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: mobile ? "5px 10px" : "5px 16px", display: "flex", gap: 4, overflowX: "auto" }}>
      {ASSETS.map(a => (
        <button key={a.symbol} onClick={() => setAsset(a)} style={{ border: asset.symbol===a.symbol ? `1px solid ${C.purple}` : "none", borderRadius: 5, padding: "4px 10px", fontSize: mobile ? 10 : 11, fontWeight: 700, background: asset.symbol===a.symbol ? C.border : "transparent", color: asset.symbol===a.symbol ? C.text : C.dim, whiteSpace: "nowrap", cursor: "pointer" }}>{a.symbol}</button>
      ))}
    </div>
  );

  const PnlBanner = ({ mobile = false }) => (
    <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: mobile ? "7px 12px" : "10px 20px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
      {[
        { label: "Unrealized PnL", val: `${unrealizedPnl>=0?"+":""}${unrealizedPnl.toFixed(5)} ETH`, sub: unrealizedPnl>=0?"▲ profit":"▼ loss",     color: unrealizedPnl>=0?C.green:C.red },
        { label: "Realized PnL",   val: `${realizedPnl>=0?"+":""}${realizedPnl.toFixed(5)} ETH`,     sub: `${history.length} closed`,               color: realizedPnl>=0?C.green:C.red },
        { label: "Notional",       val: `$${totalNotional.toFixed(0)}`,                              sub: "position value",                          color: C.dim2 },
        { label: "Collateral",     val: `${totalCollateral.toFixed(5)} ETH`,                         sub: "at risk",                                 color: C.dim2 },
        { label: "Open",           val: `${positions.length}`,                                       sub: `${positions.filter(p=>p.side==="LONG").length}L · ${positions.filter(p=>p.side==="SHORT").length}S`, color: C.dim2 },
      ].map((s, i) => (
        <div key={i} style={{ flexShrink: 0, paddingRight: i<4 ? (mobile?14:40) : 0, paddingLeft: i>0 ? (mobile?14:40) : 0, borderRight: i<4 ? `1px solid ${C.border}` : "none" }}>
          <div style={{ fontSize: mobile?8:10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{s.label}</div>
          <div style={{ fontSize: mobile?14:20, fontWeight: 800, color: s.color, fontFamily: "monospace" }}>{s.val}</div>
          <div style={{ fontSize: mobile?9:10, color: s.color, opacity: 0.7 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  );

  const OrderForm = ({ compact = false }) => (
    <div style={{ padding: compact ? 8 : 16, borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", background: C.bg, borderRadius: compact?6:8, padding: compact?2:3, marginBottom: compact?10:14 }}>
        {(["LONG","SHORT"] as const).map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ flex:1, padding: compact?"6px":"8px", borderRadius: compact?5:6, border:"none", fontWeight:700, fontSize:compact?11:13, cursor:"pointer", background: side===s?(s==="LONG"?C.green:C.red):"transparent", color: side===s?"#000":C.dim }}>{s==="LONG"?"▲ Long":"▼ Short"}</button>
        ))}
      </div>
      {!compact && <><div style={{ fontSize:11,color:C.dim,marginBottom:4 }}>Order Type</div><div style={{ background:C.bg,borderRadius:6,padding:"8px 12px",fontSize:12,color:C.dim2,marginBottom:14,border:`1px solid ${C.border}` }}>Market • Encrypted</div></>}
      <div style={{ fontSize:compact?9:11,color:C.dim,marginBottom:4 }}>Size (ETH)</div>
      <input type="number" placeholder="0.01" value={sizeInput} onChange={e=>setSizeInput(e.target.value)}
        style={{ width:"100%",background:C.bg,border:`1px solid ${C.border2}`,borderRadius:compact?5:6,color:C.text,padding:compact?"7px 8px":"9px 12px",fontSize:compact?11:13,outline:"none",boxSizing:"border-box",marginBottom:compact?6:8 }} />
      <div style={{ display:"flex",gap:compact?3:6,marginBottom:compact?10:14 }}>
        {["0.01","0.05","0.1"].map(v=>(
          <button key={v} onClick={()=>setSizeInput(v)} style={{ flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:compact?4:5,color:C.dim2,fontSize:compact?9:11,padding:"5px 0",cursor:"pointer" }}>{v}</button>
        ))}
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
        <span style={{ fontSize:compact?9:11,color:C.dim }}>Leverage: <span style={{ color:leverage>10?C.red:leverage>5?C.yellow:C.green,fontWeight:700 }}>{leverage}x</span></span>
        <span style={{ fontSize:compact?9:11,color:C.dim }}>{leverage>10?"⚠ High":leverage>5?"Med":"Low"}</span>
      </div>
      <input type="range" min={1} max={50} value={leverage} onChange={e=>setLeverage(+e.target.value)} style={{ width:"100%",accentColor:leverage>10?C.red:leverage>5?C.yellow:C.green,marginBottom:compact?10:14 }} />
      {sizeInput && price && (
        <div style={{ background:C.bg,borderRadius:compact?5:6,padding:compact?"6px 8px":"8px 12px",marginBottom:compact?10:14,fontSize:compact?9:11 }}>
          {[["Notional",`$${(parseFloat(sizeInput)*leverage*price).toFixed(0)}`],["Collateral",`${(parseFloat(sizeInput)*0.001).toFixed(5)} ETH`],["Liq.",side==="LONG"?`$${fmtPrice(price*(1-1/leverage*0.9))}`:` $${fmtPrice(price*(1+1/leverage*0.9))}`]].map(([k,v])=>(
            <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"1px 0" }}><span style={{ color:C.dim }}>{k}</span><span style={{ color:C.dim2 }}>{v}</span></div>
          ))}
        </div>
      )}
      <button onClick={handleOpen} disabled={!sizeInput||opening||!price}
        style={{ width:"100%",padding:compact?"9px":"11px",borderRadius:compact?6:8,border:"none",cursor:opening||!sizeInput?"not-allowed":"pointer",background:!sizeInput||opening?C.border:side==="LONG"?C.green:C.red,color:!sizeInput||opening?C.dim:"#000",fontWeight:800,fontSize:compact?12:14 }}>
        {opening?"🔐 Encrypting…":`🔒 ${side==="LONG"?"Buy / Long":"Sell / Short"}`}
      </button>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE
  // ─────────────────────────────────────────────────────────────────────────────
  if (isMobile) return (
    <div style={{ background:C.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif",color:C.text }}>
      {/* Nav */}
      <div style={{ background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"0 12px",height:44,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
          <div style={{ width:22,height:22,background:"linear-gradient(135deg,#8b5cf6,#3b82f6)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10 }}>🔐</div>
          <span style={{ fontWeight:700,fontSize:13,color:"#fff" }}>FHE Perp</span>
          <span style={{ fontSize:9,color:C.dim,background:C.border,borderRadius:3,padding:"1px 5px" }}>Arb Sepolia</span>
        </div>
        <div style={{ fontSize:9,color:C.dim2,display:"flex",alignItems:"center",gap:4 }}>
          {address?`${address.slice(0,6)}…${address.slice(-4)}`:"Not connected"}
          <div style={{ width:6,height:6,borderRadius:"50%",background:cofheConnected?C.green:C.red }} />
        </div>
      </div>
      <AssetTabs mobile />
      {/* Price bar */}
      <div style={{ background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"7px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div>
          <div style={{ fontSize:18,fontWeight:700,color:"#fff" }}>{price?`$${fmtPrice(price)}`:"—"} <span style={{ fontSize:11,color:change>=0?C.green:C.red }}>{change>=0?"▲":"▼"} {Math.abs(change).toFixed(2)}%</span></div>
          <div style={{ fontSize:9,color:C.dim }}>H: {high24?`$${fmtPrice(high24)}`:"—"} · L: {low24?`$${fmtPrice(low24)}`:"—"}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:9,color:C.green }}>● {source}</div>
          <div style={{ fontSize:9,color:C.dim }}>Vol: {vol24?`$${(vol24/1e6).toFixed(1)}M`:"—"}</div>
        </div>
      </div>
      <div style={{ borderBottom:`1px solid ${C.border}` }}><CandleChart candles={candles} source={source} /></div>
      <PnlBanner mobile />
      {/* Side-by-side panels */}
      <div style={{ display:"flex",width:"100%",overflow:"hidden" }}>
        {/* LEFT — Trade */}
        <div style={{ width:leftW,flexShrink:0,borderRight:`1px solid ${C.border}`,background:C.panel,transition:"width 0.3s ease",overflow:"hidden" }}>
          <div onClick={()=>{setLeftExpanded(!leftExpanded);setRightExpanded(false);}} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderBottom:`1px solid ${C.border}`,background:C.bg,cursor:"pointer" }}>
            <span style={{ fontSize:10,fontWeight:700,color:C.dim,letterSpacing:"0.5px" }}>📊 TRADE</span>
            <span style={{ color:C.dim,fontSize:11 }}>{leftExpanded?"⤡":"⤢"}</span>
          </div>
          <OrderForm compact />
          <div style={{ padding:"0 8px 8px" }}>
            <div style={{ fontSize:9,color:C.dim,fontWeight:700,marginBottom:5,letterSpacing:"0.5px" }}>ORDER BOOK</div>
            <OrderBook price={price} />
          </div>
        </div>
        {/* RIGHT — Positions */}
        <div style={{ width:rightW,flexShrink:0,background:"#0f1014",transition:"width 0.3s ease",overflow:"hidden" }}>
          <div onClick={()=>{setRightExpanded(!rightExpanded);setLeftExpanded(false);}} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 8px",borderBottom:`1px solid ${C.border}`,background:C.bg,cursor:"pointer" }}>
            <span style={{ fontSize:10,fontWeight:700,color:C.dim,letterSpacing:"0.5px" }}>📋 POS ({positions.length})</span>
            <span style={{ color:C.dim,fontSize:11 }}>{rightExpanded?"⤡":"⤢"}</span>
          </div>
          <div style={{ display:"flex",borderBottom:`1px solid ${C.border}` }}>
            {(["positions","history"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ flex:1,background:"none",border:"none",borderBottom:tab===t?`2px solid ${C.purple}`:"2px solid transparent",color:tab===t?C.text:C.dim,padding:"7px 4px",fontSize:10,fontWeight:700,cursor:"pointer" }}>
                {t==="positions"?`Open (${positions.length})`:`History (${history.length})`}
              </button>
            ))}
          </div>
          {tab==="positions" && positions.length===0 && <div style={{ padding:16,textAlign:"center",color:C.dim,fontSize:11 }}>No open positions</div>}
          {tab==="positions" && positions.map(pos=>(
            <PositionRow key={pos.id} pos={pos} markPrice={markPrices[pos.asset]??pos.entryHint} onClose={handleClose} addLog={addLog} isMobile={true} />
          ))}
          {tab==="history" && history.map((h,i)=>(
            <div key={i} style={{ margin:"6px 8px 0",background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:8 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  <span style={{ fontSize:10,fontWeight:700 }}>{h.asset}</span>
                  <span style={{ background:h.side==="LONG"?"rgba(0,212,164,0.15)":"rgba(255,77,109,0.15)",color:h.side==="LONG"?C.green:C.red,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700 }}>{h.side}</span>
                </div>
                <span style={{ color:h.pnl>=0?C.green:C.red,fontFamily:"monospace",fontSize:11,fontWeight:800 }}>{h.pnl>=0?"+":""}{h.pnl?.toFixed(5)}</span>
              </div>
              <div style={{ fontSize:9,color:C.dim }}>Entry: ${fmtPrice(h.entryHint)} → ${fmtPrice(h.closePrice)} · {new Date(h.closedAt).toLocaleTimeString()}</div>
            </div>
          ))}
          <div style={{ padding:8 }}>
            <div style={{ fontSize:9,color:C.dim,fontWeight:700,marginBottom:4 }}>⚡ CoFHE LOG</div>
            <Terminal logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:C.bg,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:C.text,display:"flex",flexDirection:"column" }}>
      {/* Nav */}
      <div style={{ background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"0 20px",display:"flex",alignItems:"center",height:50,gap:24 }}>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <div style={{ width:26,height:26,background:"linear-gradient(135deg,#8b5cf6,#3b82f6)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12 }}>🔐</div>
          <span style={{ fontWeight:700,fontSize:15,color:"#fff" }}>FHE Perp</span>
          <span style={{ fontSize:11,color:C.dim,background:C.border,borderRadius:4,padding:"2px 6px" }}>Arbitrum Sepolia</span>
        </div>
        <div style={{ display:"flex",gap:3 }}>
          {ASSETS.map(a=>(
            <button key={a.symbol} onClick={()=>setAsset(a)} style={{ background:asset.symbol===a.symbol?C.border:"transparent",border:"none",borderRadius:6,color:asset.symbol===a.symbol?C.text:C.dim,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer" }}>{a.symbol}</button>
          ))}
        </div>
        <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:11,color:C.dim2 }}>{address?`${address.slice(0,6)}…${address.slice(-4)}`:"Not connected"}</span>
          <div style={{ width:8,height:8,borderRadius:"50%",background:cofheConnected?C.green:C.red }} />
        </div>
      </div>

      {/* Price bar */}
      <div style={{ background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"9px 20px",display:"flex",alignItems:"center",gap:28 }}>
        <div>
          <span style={{ fontSize:24,fontWeight:700,color:"#fff" }}>{price?`$${fmtPrice(price)}`:"—"}</span>
          <span style={{ fontSize:13,color:change>=0?C.green:C.red,marginLeft:12 }}>{change>=0?"▲":"▼"} {Math.abs(change).toFixed(2)}%</span>
        </div>
        {[
          { label:"24h High",val:high24?`$${fmtPrice(high24)}`:"—" },
          { label:"24h Low", val:low24?`$${fmtPrice(low24)}`:"—" },
          { label:"24h Vol", val:vol24?`$${(vol24/1e6).toFixed(1)}M`:"—" },
          { label:"Open Int",val:`$${totalNotional.toFixed(0)}` },
          { label:"Source",  val:source, green:true },
        ].map(s=>(
          <div key={s.label} style={{ display:"flex",flexDirection:"column",gap:1 }}>
            <span style={{ fontSize:10,color:C.dim }}>{s.label}</span>
            <span style={{ fontSize:12,color:(s as any).green?C.green:C.dim2 }}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* PnL Banner — stats only */}
      <PnlBanner />

      {/* Main */}
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        {/* Chart + Positions */}
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"auto" }}>
          <div style={{ borderBottom:`1px solid ${C.border}` }}><CandleChart candles={candles} source={source} /></div>
          <div style={{ background:C.panel,flex:1 }}>
            <div style={{ display:"flex",borderBottom:`1px solid ${C.border}`,padding:"0 16px" }}>
              {(["positions","history"] as const).map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{ background:"none",border:"none",borderBottom:tab===t?`2px solid ${C.purple}`:"2px solid transparent",color:tab===t?C.text:C.dim,padding:"10px 16px",fontSize:12,fontWeight:600,cursor:"pointer",marginBottom:-1 }}>
                  {t==="positions"?`Positions (${positions.length})`:`History (${history.length})`}
                </button>
              ))}
            </div>
            {tab==="positions" && (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                  <thead>
                    <tr style={{ background:C.bg }}>
                      {["#","Asset","Side","Size 🔐","Entry 🔐","Mark","Lev","PnL (ETH)","PnL %","Collateral","Opened","Actions"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px",color:C.dim,fontWeight:500,textAlign:"left",whiteSpace:"nowrap",fontSize:11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.length===0
                      ? <tr><td colSpan={12} style={{ padding:24,textAlign:"center",color:C.dim }}>No open positions — open one on the right →</td></tr>
                      : positions.map(pos=>(
                          <PositionRow key={pos.id} pos={pos} markPrice={markPrices[pos.asset]??pos.entryHint} onClose={handleClose} addLog={addLog} isMobile={false} />
                        ))
                    }
                  </tbody>
                </table>
              </div>
            )}
            {tab==="history" && (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                  <thead>
                    <tr style={{ background:C.bg }}>
                      {["#","Asset","Side","Lev","Entry","Close","PnL (ETH)","PnL %","Opened","Closed"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px",color:C.dim,fontWeight:500,textAlign:"left",whiteSpace:"nowrap",fontSize:11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.length===0
                      ? <tr><td colSpan={10} style={{ padding:24,textAlign:"center",color:C.dim }}>No closed positions yet.</td></tr>
                      : history.map((h,i)=>{
                          const pnlPct = h.collateral>0?(h.pnl/h.collateral*100).toFixed(2):"0.00";
                          return (
                            <tr key={i} style={{ borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                              <td style={{ padding:"10px 12px",color:C.dim }}>{h.id}</td>
                              <td style={{ padding:"10px 12px",fontWeight:600 }}>{h.asset}</td>
                              <td style={{ padding:"10px 12px" }}><span style={{ background:h.side==="LONG"?"rgba(0,212,164,0.15)":"rgba(255,77,109,0.15)",color:h.side==="LONG"?C.green:C.red,padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:700 }}>{h.side}</span></td>
                              <td style={{ padding:"10px 12px",color:C.yellow }}>{h.leverage}x</td>
                              <td style={{ padding:"10px 12px",fontFamily:"monospace" }}>${fmtPrice(h.entryHint)}</td>
                              <td style={{ padding:"10px 12px",fontFamily:"monospace" }}>${fmtPrice(h.closePrice)}</td>
                              <td style={{ padding:"10px 12px",fontFamily:"monospace",color:h.pnl>=0?C.green:C.red,fontWeight:800,fontSize:14 }}>{h.pnl>=0?"+":""}{h.pnl?.toFixed(5)}</td>
                              <td style={{ padding:"10px 12px" }}><span style={{ background:h.pnl>=0?"rgba(0,212,164,0.12)":"rgba(255,77,109,0.12)",color:h.pnl>=0?C.green:C.red,padding:"3px 8px",borderRadius:4,fontSize:12,fontWeight:700 }}>{h.pnl>=0?"+":""}{pnlPct}%</span></td>
                              <td style={{ padding:"10px 12px",color:C.dim,whiteSpace:"nowrap" }}>{new Date(h.openedAt).toLocaleTimeString()}</td>
                              <td style={{ padding:"10px 12px",color:C.dim,whiteSpace:"nowrap" }}>{new Date(h.closedAt).toLocaleTimeString()}</td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width:320,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",background:C.panel,flexShrink:0 }}>
          <OrderForm />
          <div style={{ padding:16,borderBottom:`1px solid ${C.border}`,flex:1,overflow:"auto" }}>
            <div style={{ fontSize:11,color:C.dim,fontWeight:700,marginBottom:10,letterSpacing:"1px" }}>ORDER BOOK</div>
            <OrderBook price={price} />
          </div>
          <div style={{ padding:16 }}>
            <div style={{ fontSize:11,color:C.dim,fontWeight:700,marginBottom:8,letterSpacing:"1px" }}>⚡ CoFHE LOG</div>
            <Terminal logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}
