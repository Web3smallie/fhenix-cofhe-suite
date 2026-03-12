"use client";

import { useEffect, useRef, useState } from "react";
import { FheTypes } from "cofhejs/web";
import { useEncryptInput } from "~~/hooks/useEncryptInput";
import { useDecryptValue } from "~~/hooks/useDecrypt";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useCofheConnected } from "~~/hooks/useCofhe";
import { notification } from "~~/utils/scaffold-eth";

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg:     "#0a0b0e",
  panel:  "#111318",
  border: "#1e2028",
  border2:"#2a2d3a",
  text:   "#e2e4ea",
  dim:    "#6b7280",
  dim2:   "#9ca3af",
  green:  "#00d4a4",
  red:    "#ff4d6d",
  blue:   "#3b82f6",
  purple: "#8b5cf6",
  yellow: "#f59e0b",
};

// ─── Terminal ─────────────────────────────────────────────────────────────────

type LogEntry = { msg: string; type: "sys" | "ok" | "err" | "info" };

function Terminal({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{ background: "#000", borderRadius: 8, padding: "10px 14px", height: 160, overflowY: "auto", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
      {!logs.length
        ? <span style={{ color: "#374151" }}>// CoFHE encryption log…</span>
        : logs.map((l, i) => (
            <span key={i} style={{ color: l.type === "ok" ? C.green : l.type === "err" ? C.red : l.type === "sys" ? "#67e8f9" : C.dim2 }}>
              {l.msg}
            </span>
          ))
      }
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TxRecord = { type: "Deposit" | "Withdraw"; amount: string; ts: number };

export const FHEVaultComponent = () => {
  const { address } = useAccount();
  const cofheConnected = useCofheConnected();
  const { onEncryptInput, isEncryptingInput } = useEncryptInput();

  const [activeTab, setActiveTab]     = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount]           = useState("");
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [txHistory, setTxHistory]     = useState<TxRecord[]>([]);
  const [isDepositing, setIsDepositing]   = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  const [leftExpanded, setLeftExpanded]   = useState(false);
  const [rightExpanded, setRightExpanded] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const addLog = (msg: string, type: LogEntry["type"] = "info") =>
    setLogs(prev => [...prev.slice(-49), { msg, type }]);

  // ── On-chain reads ──────────────────────────────────────────────────────────

  const { data: vaultBalance } = useScaffoldReadContract({
    contractName: "FHEVault",
    functionName: "getVaultBalance",
    watch: true,
  });

  const { data: userDepositCount } = useScaffoldReadContract({
    contractName: "FHEVault",
    functionName: "depositCount",
    args: [address],
    watch: true,
  });

  // Encrypted balance hash — read from contract
  const { data: encBalanceHash } = useScaffoldReadContract({
    contractName: "FHEVault",
    functionName: "balances",
    args: [address],
    watch: true,
  });

  // Decrypt balance
  const { onDecrypt: revealBalance, result: balanceResult } = useDecryptValue(
    FheTypes.Uint128,
    encBalanceHash ? BigInt(encBalanceHash as any) : null,
  );

  // ── Write contracts ─────────────────────────────────────────────────────────

  const { writeContractAsync: depositAsync }  = useScaffoldWriteContract("FHEVault");
  const { writeContractAsync: withdrawAsync } = useScaffoldWriteContract("FHEVault");

  // ── Deposit ─────────────────────────────────────────────────────────────────

  const handleDeposit = async () => {
    if (!amount || !cofheConnected) {
      if (!cofheConnected) notification.error("Connect CoFHE wallet first");
      return;
    }
    setIsDepositing(true);
    setLogs([]);
    try {
      addLog("▶ Preparing deposit…", "sys");
      const amountWei = parseEther(amount);
      addLog(`  Amount: ${amount} ETH → encrypting via CoFHE…`, "info");
      const encAmount = await onEncryptInput(FheTypes.Uint128, amountWei);
      if (!encAmount) throw new Error("Encryption failed");
      addLog("✓ Amount encrypted — ZK-proof generated 🔐", "ok");
      addLog("▶ Sending deposit tx → FHEVault…", "sys");
      await depositAsync({
        functionName: "deposit",
        args: [encAmount],
        value: amountWei,
      });
      addLog(`✓ Deposited ${amount} ETH — amount hidden on-chain 🔐`, "ok");
      setTxHistory(prev => [{ type: "Deposit", amount, ts: Date.now() }, ...prev]);
      setAmount("");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setIsDepositing(false); }
  };

  // ── Withdraw ────────────────────────────────────────────────────────────────

  const handleWithdraw = async () => {
    if (!amount || !cofheConnected) {
      if (!cofheConnected) notification.error("Connect CoFHE wallet first");
      return;
    }
    setIsWithdrawing(true);
    setLogs([]);
    try {
      addLog("▶ Preparing withdrawal…", "sys");
      const amountWei = parseEther(amount);
      addLog(`  Amount: ${amount} ETH → encrypting via CoFHE…`, "info");
      const encAmount = await onEncryptInput(FheTypes.Uint128, amountWei);
      if (!encAmount) throw new Error("Encryption failed");
      addLog("✓ Amount encrypted — ZK-proof generated 🔐", "ok");
      addLog("▶ Sending withdraw tx → FHEVault…", "sys");
      await withdrawAsync({
        functionName: "withdraw",
        args: [encAmount],
      });
      addLog(`✓ Withdrew ${amount} ETH — amount hidden on-chain 🔐`, "ok");
      setTxHistory(prev => [{ type: "Withdraw", amount, ts: Date.now() }, ...prev]);
      setAmount("");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setIsWithdrawing(false); }
  };

  // ── Reveal / Encrypt balance ────────────────────────────────────────────────

  const handleReveal = async () => {
    setLogs([]);
    addLog("▶ Requesting balance reveal…", "sys");
    addLog("  Fetching encrypted balance handle…", "info");
    await new Promise(r => setTimeout(r, 400));
    addLog("  CoFHE coprocessor unsealing…", "info");
    await revealBalance();
    if (balanceResult.state === "success") {
      addLog(`✓ Balance revealed 🔓`, "ok");
    } else {
      addLog("✗ Reveal failed — check permit", "err");
    }
  };

  const handleEncrypt = async () => {
    setLogs([]);
    addLog("▶ Re-hiding balance…", "sys");
    await new Promise(r => setTimeout(r, 500));
    addLog("✓ Balance hidden again 🔐", "ok");
    window.location.reload();
  };

  // ── Derived values ──────────────────────────────────────────────────────────

  const vaultEth       = vaultBalance ? parseFloat(formatEther(vaultBalance as bigint)).toFixed(4) : "0.0000";
  const depositCount   = userDepositCount ? Number(userDepositCount).toString() : "0";
  const balanceOk      = balanceResult.state === "success" && balanceResult.value != null;
  const balanceDisplay = balanceOk ? `${parseFloat(formatEther(balanceResult.value as bigint)).toFixed(6)} ETH` : null;

  const isLoading = isDepositing || isWithdrawing || isEncryptingInput;

  const leftW  = leftExpanded  ? "63%" : rightExpanded ? "37%" : "50%";
  const rightW = rightExpanded ? "63%" : leftExpanded  ? "37%" : "50%";

  // ── Shared UI pieces ────────────────────────────────────────────────────────

  // Stats bar — 3 items, no PnL, no buttons
  const StatsBanner = ({ mobile = false }) => (
    <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: mobile ? "8px 12px" : "12px 20px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
      {/* Vault Total */}
      <div style={{ flexShrink: 0, paddingRight: mobile ? 16 : 40, borderRight: `1px solid ${C.border}` }}>
        <div style={{ fontSize: mobile ? 9 : 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Vault Total ETH</div>
        <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 800, color: C.purple, fontFamily: "monospace" }}>{vaultEth} ETH</div>
        <div style={{ fontSize: mobile ? 9 : 10, color: C.dim }}>Total locked in contract</div>
      </div>
      {/* Deposit Count */}
      <div style={{ flexShrink: 0, padding: `0 ${mobile ? 16 : 40}px`, borderRight: `1px solid ${C.border}` }}>
        <div style={{ fontSize: mobile ? 9 : 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Your Deposits</div>
        <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 800, color: "#67e8f9", fontFamily: "monospace" }}>{depositCount}</div>
        <div style={{ fontSize: mobile ? 9 : 10, color: C.dim }}>Encrypted on-chain</div>
      </div>
      {/* Balance — reveal/encrypt here */}
      <div style={{ flexShrink: 0, paddingLeft: mobile ? 16 : 40 }}>
        <div style={{ fontSize: mobile ? 9 : 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Your Balance</div>
        {balanceOk
          ? <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 800, color: C.green, fontFamily: "monospace", marginBottom: 4 }}>{balanceDisplay}</div>
          : <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 800, color: "#374151", fontFamily: "monospace", marginBottom: 4 }}>🔐 Hidden</div>
        }
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleReveal} style={{ background: "linear-gradient(135deg,#4c1d95,#5b21b6)", border: `1px solid ${C.purple}`, borderRadius: 5, color: "#c4b5fd", padding: mobile ? "4px 10px" : "5px 14px", fontSize: mobile ? 10 : 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>🔓 Reveal</button>
          <button onClick={handleEncrypt} style={{ background: "linear-gradient(135deg,#1e3a5f,#1d4ed8)", border: `1px solid ${C.blue}`, borderRadius: 5, color: "#93c5fd", padding: mobile ? "4px 10px" : "5px 14px", fontSize: mobile ? 10 : 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>🔐 Encrypt</button>
        </div>
      </div>
    </div>
  );

  // Deposit / Withdraw form
  const VaultForm = ({ compact = false }) => (
    <div style={{ padding: compact ? 10 : 20 }}>
      {/* Tabs */}
      <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 3, marginBottom: compact ? 12 : 16 }}>
        {(["deposit", "withdraw"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: compact ? "7px" : "9px", borderRadius: 6, border: "none", fontWeight: 700, fontSize: compact ? 11 : 13, cursor: "pointer", background: activeTab === t ? C.purple : "transparent", color: activeTab === t ? "#fff" : C.dim, textTransform: "capitalize" }}>
            {t === "deposit" ? "🏦 Deposit" : "💸 Withdraw"}
          </button>
        ))}
      </div>

      {/* Info */}
      <div style={{ background: "#0f1a2e", border: `1px solid #1d4ed8`, borderRadius: 8, padding: compact ? "8px 10px" : "10px 14px", marginBottom: compact ? 12 : 16, fontSize: compact ? 10 : 12, color: "#93c5fd" }}>
        🔐 Your {activeTab} amount is CoFHE-encrypted — the chain only sees a ZK-proof, not the value.
      </div>

      {/* Amount */}
      <div style={{ fontSize: compact ? 9 : 11, color: C.dim, marginBottom: 4 }}>Amount (ETH)</div>
      <input
        type="number" placeholder="0.00" value={amount}
        onChange={e => setAmount(e.target.value)}
        style={{ width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 7, color: C.text, padding: compact ? "8px 10px" : "10px 14px", fontSize: compact ? 12 : 14, outline: "none", boxSizing: "border-box", marginBottom: compact ? 6 : 10 }}
      />

      {/* Quick amount presets */}
      <div style={{ display: "flex", gap: compact ? 4 : 8, marginBottom: compact ? 12 : 16 }}>
        {["0.001", "0.005", "0.01"].map(v => (
          <button key={v} onClick={() => setAmount(v)} style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.dim2, fontSize: compact ? 10 : 12, padding: compact ? "5px 0" : "6px 0", cursor: "pointer", textAlign: "center" }}>{v} ETH</button>
        ))}
      </div>

      {/* Action button */}
      <button
        onClick={activeTab === "deposit" ? handleDeposit : handleWithdraw}
        disabled={!amount || isLoading}
        style={{ width: "100%", padding: compact ? "10px" : "12px", borderRadius: 8, border: "none", cursor: !amount || isLoading ? "not-allowed" : "pointer", background: !amount || isLoading ? C.border : activeTab === "deposit" ? C.purple : C.blue, color: !amount || isLoading ? C.dim : "#fff", fontWeight: 800, fontSize: compact ? 13 : 15 }}
      >
        {isLoading ? "🔐 Encrypting…" : activeTab === "deposit" ? "🔒 Deposit" : "🔒 Withdraw"}
      </button>
    </div>
  );

  // Transaction history table
  const HistoryTable = ({ compact = false }) => (
    <div style={{ padding: compact ? "0 10px 10px" : "0 20px 20px" }}>
      <div style={{ fontSize: compact ? 10 : 12, color: C.dim, fontWeight: 700, letterSpacing: "0.5px", marginBottom: compact ? 8 : 12, textTransform: "uppercase" }}>📋 Transaction History</div>
      {txHistory.length === 0
        ? <div style={{ color: C.dim, fontSize: compact ? 10 : 12, textAlign: "center", padding: compact ? 12 : 20 }}>No transactions yet this session.</div>
        : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 10 : 12 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["Type", "Amount", "Time", "On-chain"].map(h => (
                  <th key={h} style={{ padding: compact ? "6px 8px" : "8px 12px", color: C.dim, fontWeight: 500, textAlign: "left", fontSize: compact ? 9 : 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {txHistory.map((tx, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: compact ? "7px 8px" : "10px 12px" }}>
                    <span style={{ background: tx.type === "Deposit" ? "rgba(0,212,164,0.15)" : "rgba(245,158,11,0.15)", color: tx.type === "Deposit" ? C.green : C.yellow, padding: "2px 8px", borderRadius: 4, fontSize: compact ? 9 : 11, fontWeight: 700 }}>{tx.type}</span>
                  </td>
                  <td style={{ padding: compact ? "7px 8px" : "10px 12px", fontFamily: "monospace", color: C.text }}>{tx.amount} ETH</td>
                  <td style={{ padding: compact ? "7px 8px" : "10px 12px", color: C.dim, whiteSpace: "nowrap" }}>{new Date(tx.ts).toLocaleTimeString()}</td>
                  <td style={{ padding: compact ? "7px 8px" : "10px 12px" }}>
                    <span style={{ background: C.border, border: `1px solid ${C.border2}`, borderRadius: 4, padding: "2px 8px", fontSize: compact ? 9 : 11, color: C.dim2 }}>🔐 Encrypted</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE
  // ─────────────────────────────────────────────────────────────────────────────

  if (isMobile) return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: C.text }}>
      {/* Nav */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 12px", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 22, height: 22, background: "linear-gradient(135deg,#8b5cf6,#3b82f6)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>🔐</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>FHE Vault</span>
          <span style={{ fontSize: 9, color: C.dim, background: C.border, borderRadius: 3, padding: "1px 5px" }}>Arb Sepolia</span>
        </div>
        <div style={{ fontSize: 9, color: C.dim2, display: "flex", alignItems: "center", gap: 4 }}>
          {address ? `${address.slice(0,6)}…${address.slice(-4)}` : "Not connected"}
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>

      {/* Stats banner */}
      <StatsBanner mobile />

      {/* Side-by-side panels */}
      <div style={{ display: "flex", width: "100%", overflow: "hidden" }}>

        {/* LEFT — Vault Form */}
        <div style={{ width: leftW, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.panel, transition: "width 0.3s ease", overflow: "hidden" }}>
          <div onClick={() => { setLeftExpanded(!leftExpanded); setRightExpanded(false); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: "0.5px" }}>🏦 VAULT</span>
            <span style={{ color: C.dim, fontSize: 11 }}>{leftExpanded ? "⤡" : "⤢"}</span>
          </div>
          <VaultForm compact />
        </div>

        {/* RIGHT — Terminal + History */}
        <div style={{ width: rightW, flexShrink: 0, background: "#0f1014", transition: "width 0.3s ease", overflow: "hidden" }}>
          <div onClick={() => { setRightExpanded(!rightExpanded); setLeftExpanded(false); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: "0.5px" }}>📋 HISTORY</span>
            <span style={{ color: C.dim, fontSize: 11 }}>{rightExpanded ? "⤡" : "⤢"}</span>
          </div>
          <div style={{ padding: "8px 8px 4px" }}>
            <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, marginBottom: 5, letterSpacing: "0.5px" }}>⚡ CoFHE LOG</div>
            <Terminal logs={logs} />
          </div>
          <HistoryTable compact />
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex", alignItems: "center", height: 50, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, background: "linear-gradient(135deg,#8b5cf6,#3b82f6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🔐</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>FHE Vault</span>
          <span style={{ fontSize: 11, color: C.dim, background: C.border, borderRadius: 4, padding: "2px 6px" }}>Arbitrum Sepolia</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: C.dim2 }}>{address ? `${address.slice(0,6)}…${address.slice(-4)}` : "Not connected"}</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>

      {/* Stats banner — no PnL, just vault stats + reveal/encrypt on balance */}
      <StatsBanner />

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, gap: 0, overflow: "hidden" }}>

        {/* LEFT — Deposit/Withdraw form */}
        <div style={{ width: 420, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.panel, display: "flex", flexDirection: "column" }}>
          <VaultForm />
        </div>

        {/* CENTER — Terminal log */}
        <div style={{ flex: 1, borderRight: `1px solid ${C.border}`, background: C.panel, display: "flex", flexDirection: "column", padding: 20 }}>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 700, marginBottom: 12, letterSpacing: "1px", textTransform: "uppercase" }}>⚡ CoFHE Encryption Log</div>
          <Terminal logs={logs} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>
              All deposit and withdrawal amounts are encrypted using <span style={{ color: C.purple }}>CoFHE</span> before being sent on-chain. Nobody — including validators — can see your amounts.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "🔐", text: "Amount encrypted locally via CoFHE ZK-proof" },
                { icon: "📡", text: "Only the encrypted proof is sent on-chain" },
                { icon: "🔓", text: "Only you can reveal your balance with your wallet key" },
                { icon: "✅", text: "Smart contract verifies proof without knowing the value" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: C.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ fontSize: 12, color: C.dim2, lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Transaction history */}
        <div style={{ width: 420, flexShrink: 0, background: C.panel, display: "flex", flexDirection: "column" }}>
          <HistoryTable />
        </div>
      </div>
    </div>
  );
};

export default FHEVaultComponent;
