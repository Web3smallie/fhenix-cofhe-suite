"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FheTypes } from "cofhejs/web";
import { useEncryptInput } from "../hooks/useEncryptInput";
import { useScaffoldReadContract, useScaffoldWriteContract } from "../hooks/scaffold-eth";
import { useAccount } from "wagmi";
import { useCofheConnected } from "../hooks/useCofhe";
import { notification } from "~~/utils/scaffold-eth";

const C = {
  bg: "#0a0b0e", panel: "#111318", panel2: "#16181e",
  border: "#1e2028", border2: "#2a2d3a",
  text: "#e2e4ea", dim: "#6b7280", dim2: "#9ca3af",
  green: "#00d4a4", red: "#ff4d6d", blue: "#3b82f6",
  purple: "#8b5cf6", yellow: "#f59e0b",
};

function daysLeft(deadline: number) {
  const d = Math.ceil((deadline - Date.now() / 1000) / 86400);
  if (d <= 0) return "Ended";
  return d === 1 ? "Ends in 1 day" : `Ends in ${d} days`;
}
function shortAddr(addr?: string) {
  if (!addr) return "Not connected";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type LogEntry = { msg: string; type: "sys" | "ok" | "err" | "info" };

function Terminal({ logs }: { logs: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{ background: "#000", borderRadius: 8, padding: "10px 14px", height: 110, overflowY: "auto", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
      {!logs.length
        ? <span style={{ color: "#374151" }}>// CoFHE vote encryption log…</span>
        : logs.map((l, i) => <span key={i} style={{ color: l.type === "ok" ? C.green : l.type === "err" ? C.red : l.type === "sys" ? "#67e8f9" : C.dim2 }}>{l.msg}</span>)
      }
    </div>
  );
}

function StatusBadge({ proposal }: { proposal: any }) {
  const active = proposal.deadline > Date.now() / 1000 && !proposal.revealed;
  if (proposal.revealed) return (
    <span style={{ background: proposal.passed ? "rgba(0,212,164,0.15)" : "rgba(255,77,109,0.15)", color: proposal.passed ? C.green : C.red, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {proposal.passed ? "✅ Passed" : "❌ Defeated"}
    </span>
  );
  if (active) return <span style={{ background: "rgba(59,130,246,0.15)", color: C.blue, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>● Active</span>;
  return <span style={{ background: "rgba(107,114,128,0.15)", color: C.dim, padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>○ Closed</span>;
}

function ProposalCard({ proposal, onSelect, selected }: { proposal: any; onSelect: (p: any) => void; selected: boolean }) {
  const active = proposal.deadline > Date.now() / 1000 && !proposal.revealed;
  return (
    <div onClick={() => onSelect(proposal)} style={{ background: selected ? C.panel2 : C.panel, border: `1px solid ${selected ? C.purple : C.border}`, borderRadius: 14, padding: "20px 24px", cursor: "pointer", marginBottom: 10, transition: "all 0.15s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, lineHeight: 1.45, flex: 1 }}>{proposal.description}</div>
        <StatusBadge proposal={proposal} />
      </div>
      <div style={{ display: "flex", gap: 20, fontSize: 11, color: C.dim }}>
        <span>🗳 {proposal.totalVotes.toLocaleString()} votes</span>
        <span>⏱ {active ? daysLeft(proposal.deadline) : "Ended"}</span>
        <span style={{ color: C.purple, fontSize: 10, fontWeight: 600 }}>🔐 FHE</span>
      </div>
      {proposal.revealed && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${proposal.forPct || 50}%`, height: "100%", background: C.green, borderRadius: 4 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10 }}>
            <span style={{ color: C.green, fontWeight: 700 }}>For {proposal.forPct || 50}%</span>
            <span style={{ color: C.red, fontWeight: 700 }}>Against {100 - (proposal.forPct || 50)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProposalDetail({ proposal, logs, onVote, loading }: { proposal: any; logs: LogEntry[]; onVote: (id: number, vote: boolean) => void; loading: boolean }) {
  const [voted, setVoted] = useState<"for" | "against" | null>(null);
  const active = proposal.deadline > Date.now() / 1000 && !proposal.revealed;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <StatusBadge proposal={proposal} />
          <span style={{ fontSize: 11, color: C.dim }}>#{proposal.id + 1}</span>
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.text, lineHeight: 1.5, marginBottom: 10 }}>{proposal.description}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: C.dim }}>
          <span>🗳 {proposal.totalVotes.toLocaleString()} votes</span>
          <span>⏱ {active ? daysLeft(proposal.deadline) : "Voting ended"}</span>
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {proposal.revealed ? "Results" : "🔐 Results Hidden (FHE)"}
        </div>
        {proposal.revealed ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ label: "For", pct: proposal.forPct || 50, color: C.green }, { label: "Against", pct: 100 - (proposal.forPct || 50), color: C.red }].map(r => (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: r.color }}>{r.label}</span>
                  <span style={{ color: r.color }}>{r.pct}%</span>
                </div>
                <div style={{ height: 8, background: C.border, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${r.pct}%`, height: "100%", background: r.color, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: "#0f1117", border: `1px solid ${C.border2}`, borderRadius: 10, padding: "16px", textAlign: "center" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🔐</div>
            <div style={{ fontSize: 12, color: C.dim2, lineHeight: 1.6 }}>
              Vote tallies are CoFHE-encrypted on-chain.<br />Results only reveal after voting ends.
            </div>
          </div>
        )}
      </div>

      {/* Vote */}
      {active ? (
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Cast Your Vote</div>
          <div style={{ background: "#0c1829", border: `1px solid #1d4ed855`, borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#93c5fd", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🔐</span> Your vote is CoFHE-encrypted — completely private
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => { setVoted("for"); onVote(proposal.id, true); }} disabled={loading || !!voted}
              style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${voted === "for" ? C.green : C.border}`, cursor: loading || !!voted ? "not-allowed" : "pointer", background: voted === "for" ? "rgba(0,212,164,0.15)" : C.panel2, color: voted === "for" ? C.green : C.dim2, fontWeight: 800, fontSize: 14 }}>
              {loading && voted === "for" ? "🔐 Encrypting…" : "👍 For"}
            </button>
            <button onClick={() => { setVoted("against"); onVote(proposal.id, false); }} disabled={loading || !!voted}
              style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${voted === "against" ? C.red : C.border}`, cursor: loading || !!voted ? "not-allowed" : "pointer", background: voted === "against" ? "rgba(255,77,109,0.15)" : C.panel2, color: voted === "against" ? C.red : C.dim2, fontWeight: 800, fontSize: 14 }}>
              {loading && voted === "against" ? "🔐 Encrypting…" : "👎 Against"}
            </button>
          </div>
          {voted && !loading && (
            <div style={{ marginTop: 10, textAlign: "center", fontSize: 12, color: voted === "for" ? C.green : C.red, fontWeight: 600 }}>
              ✓ Vote submitted — encrypted on-chain 🔐
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ background: C.panel2, borderRadius: 10, padding: "14px", textAlign: "center", fontSize: 12, color: C.dim }}>
            {proposal.revealed ? "This proposal has been resolved." : "Voting period has ended."}
          </div>
        </div>
      )}

      <div style={{ padding: "14px 20px", marginTop: "auto" }}>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" }}>⚡ CoFHE Log</div>
        <Terminal logs={logs} />
      </div>
    </div>
  );
}

function CreateProposalPanel({ onCreate, loading }: { onCreate: (desc: string, days: number) => void; loading: boolean }) {
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState(7);
  return (
    <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24, maxWidth: 600 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 4 }}>New Proposal</div>
      <div style={{ fontSize: 12, color: C.dim, marginBottom: 18 }}>Create a governance proposal for the community to vote on.</div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 500 }}>Description</div>
      <textarea placeholder="e.g. Should we increase staking rewards to 15% APY?" value={desc} onChange={e => setDesc(e.target.value)} rows={4}
        style={{ width: "100%", background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 10, color: C.text, padding: "10px 14px", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "none", marginBottom: 16, fontFamily: "inherit", lineHeight: 1.6 }} />
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 500 }}>Duration: <span style={{ color: C.yellow, fontWeight: 700 }}>{days} days</span></div>
      <input type="range" min={1} max={30} value={days} onChange={e => setDays(+e.target.value)} style={{ width: "100%", accentColor: C.purple, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[3, 7, 14].map(d => (
          <button key={d} onClick={() => setDays(d)} style={{ flex: 1, background: days === d ? C.border2 : C.panel2, border: `1px solid ${days === d ? C.purple : C.border}`, borderRadius: 8, color: days === d ? C.text : C.dim2, fontSize: 11, padding: "6px 0", cursor: "pointer", fontWeight: days === d ? 700 : 400 }}>{d} days</button>
        ))}
      </div>
      <button onClick={() => { if (desc) onCreate(desc, days); }} disabled={!desc || loading}
        style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: !desc || loading ? "not-allowed" : "pointer", background: !desc || loading ? C.border : C.purple, color: !desc || loading ? C.dim : "#fff", fontWeight: 800, fontSize: 14 }}>
        {loading ? "⏳ Creating…" : "📋 Submit Proposal"}
      </button>
    </div>
  );
}

export default function PrivateVotingComponent() {
  const { address } = useAccount();
  const cofheConnected = useCofheConnected();
  const { onEncryptInput, isEncryptingInput } = useEncryptInput();

  const [proposals, setProposals]             = useState<any[]>([]);
  const [selected, setSelected]               = useState<any>(null);
  const [logs, setLogs]                       = useState<LogEntry[]>([]);
  const [votingLoading, setVotingLoading]     = useState(false);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [view, setView]                       = useState<"proposals" | "create">("proposals");
  const [filter, setFilter]                   = useState<"all" | "active" | "closed">("all");
  const [isMobile, setIsMobile]               = useState(false);
  const [mobileTab, setMobileTab]             = useState<"proposals" | "vote" | "create">("proposals");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") =>
    setLogs(prev => [...prev.slice(-49), { msg, type }]), []);

  const { data: proposalCount } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "proposalCount", watch: true });
  const { data: p0 } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "getProposal", args: [0n], watch: true });
  const { data: p1 } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "getProposal", args: [1n], watch: true });
  const { data: p2 } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "getProposal", args: [2n], watch: true });
  const { data: p3 } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "getProposal", args: [3n], watch: true });
  const { data: p4 } = useScaffoldReadContract({ contractName: "PrivateVoting", functionName: "getProposal", args: [4n], watch: true });

  useEffect(() => {
    const count = proposalCount ? Number(proposalCount) : 0;
    const raw = [p0, p1, p2, p3, p4].slice(0, count).filter(Boolean);
    const parsed = raw.map((p: any, i: number) => ({
      id: i, description: p[0] as string, deadline: Number(p[1]),
      totalVotes: Number(p[2]), revealed: p[3] as boolean, passed: p[4] as boolean, forPct: 50,
    }));
    setProposals(parsed);
    if (parsed.length > 0 && !selected) setSelected(parsed[0]);
  }, [proposalCount, p0, p1, p2, p3, p4]);

  const { writeContractAsync: voteAsync }   = useScaffoldWriteContract("PrivateVoting");
  const { writeContractAsync: createAsync } = useScaffoldWriteContract("PrivateVoting");

  const handleVote = async (proposalId: number, vote: boolean) => {
    if (!cofheConnected) { notification.error("Connect CoFHE wallet first"); return; }
    setVotingLoading(true); setLogs([]);
    try {
      addLog(`▶ Casting ${vote ? "FOR" : "AGAINST"} vote on proposal #${proposalId + 1}…`, "sys");
      addLog("  Encrypting vote (bool) via CoFHE…", "info");
      const encVote = await onEncryptInput(FheTypes.Bool, vote);
      if (!encVote) throw new Error("Vote encryption failed");
      addLog("✓ Vote encrypted 🔐", "ok");
      addLog("▶ Broadcasting tx → PrivateVoting…", "sys");
      await voteAsync({ functionName: "castVote", args: [BigInt(proposalId), encVote] });
      addLog(`✓ Vote cast — completely private 🔐`, "ok");
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, totalVotes: p.totalVotes + 1 } : p));
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setVotingLoading(false); }
  };

  const handleCreate = async (desc: string, days: number) => {
    if (!cofheConnected) { notification.error("Connect CoFHE wallet first"); return; }
    setCreatingLoading(true); setLogs([]);
    try {
      addLog("▶ Creating proposal…", "sys");
      await createAsync({ functionName: "createProposal", args: [desc, BigInt(days * 24 * 60 * 60)] });
      addLog(`✓ Proposal created on-chain`, "ok");
      setView("proposals");
    } catch (err: any) {
      addLog(`✗ Error: ${err.message}`, "err");
      notification.error(err.message);
    } finally { setCreatingLoading(false); }
  };

  const filtered    = proposals.filter(p => filter === "active" ? (p.deadline > Date.now()/1000 && !p.revealed) : filter === "closed" ? (p.deadline <= Date.now()/1000 || p.revealed) : true);
  const activeCount = proposals.filter(p => p.deadline > Date.now()/1000 && !p.revealed).length;
  const totalVotes  = proposals.reduce((a, p) => a + p.totalVotes, 0);

  // MOBILE
  if (isMobile) return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "system-ui,sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 14px", height: 46, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#8b5cf6,#3b82f6)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>🗳</div>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>FHE Governance</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.dim2 }}>
          {shortAddr(address)}<div style={{ width: 6, height: 6, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>
      <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: "8px 0", display: "flex" }}>
        {[{l:"Proposals",v:`${proposals.length}`,c:C.purple},{l:"Active",v:`${activeCount}`,c:C.green},{l:"Votes",v:totalVotes.toLocaleString(),c:"#67e8f9"},{l:"Privacy",v:"🔐",c:C.blue}].map((s,i)=>(
          <div key={i} style={{ flex:1,textAlign:"center",borderRight:i<3?`1px solid ${C.border}`:"none" }}>
            <div style={{ fontSize:8,color:C.dim,textTransform:"uppercase",letterSpacing:"0.5px" }}>{s.l}</div>
            <div style={{ fontSize:15,fontWeight:800,color:s.c,fontFamily:"monospace" }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        {([{key:"proposals",label:"📋 Proposals"},{key:"vote",label:"🗳 Vote"},{key:"create",label:"➕ Create"}] as const).map(t=>(
          <button key={t.key} onClick={()=>setMobileTab(t.key)} style={{ flex:1,background:"none",border:"none",borderBottom:mobileTab===t.key?`2px solid ${C.purple}`:"2px solid transparent",color:mobileTab===t.key?C.text:C.dim,padding:"9px 4px",fontSize:11,fontWeight:700,cursor:"pointer" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {mobileTab==="proposals" && (
          <div style={{ padding:"10px 12px" }}>
            <div style={{ display:"flex",gap:4,marginBottom:10 }}>
              {(["all","active","closed"] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)} style={{ flex:1,background:filter===f?C.border2:"transparent",border:`1px solid ${filter===f?C.purple:C.border}`,borderRadius:8,color:filter===f?C.text:C.dim,fontSize:10,padding:"5px 0",cursor:"pointer",fontWeight:filter===f?700:400,textTransform:"capitalize" }}>{f}</button>
              ))}
            </div>
            {filtered.length===0
              ? <div style={{ textAlign:"center",padding:40,color:C.dim }}><div style={{ fontSize:32,marginBottom:8 }}>🗳</div><div style={{ color:C.dim2,fontWeight:600,fontSize:13 }}>No proposals yet</div></div>
              : filtered.map(p=><ProposalCard key={p.id} proposal={p} onSelect={p2=>{setSelected(p2);setMobileTab("vote");}} selected={selected?.id===p.id} />)
            }
          </div>
        )}
        {mobileTab==="vote" && (selected
          ? <ProposalDetail proposal={selected} logs={logs} onVote={handleVote} loading={votingLoading||isEncryptingInput} />
          : <div style={{ padding:32,textAlign:"center",color:C.dim,fontSize:13 }}>← Select a proposal first</div>
        )}
        {mobileTab==="create" && <div style={{ padding:12 }}><CreateProposalPanel onCreate={handleCreate} loading={creatingLoading} /></div>}
      </div>
    </div>
  );

  // DESKTOP
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter',system-ui,sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", height: 54, gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#8b5cf6,#3b82f6)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🗳</div>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>FHE Governance</span>
          <span style={{ fontSize: 10, color: C.dim, background: C.border, borderRadius: 4, padding: "2px 8px" }}>Arbitrum Sepolia</span>
        </div>
        <div style={{ display: "flex", gap: 2, marginLeft: 16 }}>
          {(["all","active","closed"] as const).map(f=>(
            <button key={f} onClick={()=>{setFilter(f);setView("proposals");}} style={{ background:filter===f&&view==="proposals"?C.border:"transparent",border:"none",borderRadius:8,color:filter===f&&view==="proposals"?C.text:C.dim,padding:"5px 16px",fontSize:12,fontWeight:600,cursor:"pointer",textTransform:"capitalize" }}>
              {f==="all"?"All Proposals":f==="active"?"🟢 Active":"✅ Closed"}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={()=>setView(view==="create"?"proposals":"create")} style={{ background:view==="create"?C.border2:C.purple,border:"none",borderRadius:10,color:"#fff",padding:"7px 18px",fontSize:12,fontWeight:700,cursor:"pointer" }}>
            {view==="create"?"← Back":"📋 New Proposal"}
          </button>
          <span style={{ fontSize: 11, color: C.dim2 }}>{shortAddr(address)}</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cofheConnected ? C.green : C.red }} />
        </div>
      </div>
      <div style={{ background: "#0d1117", borderBottom: `1px solid ${C.border}`, padding: "10px 28px", display: "flex", alignItems: "center", gap: 40 }}>
        {[
          {label:"Total Proposals",val:`${proposals.length}`,sub:"on-chain",color:C.purple},
          {label:"Active",val:`${activeCount}`,sub:"accepting votes",color:C.green},
          {label:"Total Votes",val:totalVotes.toLocaleString(),sub:"cast privately",color:"#67e8f9"},
          {label:"Privacy",val:"🔐 CoFHE",sub:"votes encrypted",color:C.blue},
        ].map((s,i)=>(
          <div key={i} style={{ display:"flex",flexDirection:"column",gap:2,paddingRight:i<3?40:0,borderRight:i<3?`1px solid ${C.border}`:"none" }}>
            <div style={{ fontSize:10,color:C.dim,textTransform:"uppercase",letterSpacing:"0.5px" }}>{s.label}</div>
            <div style={{ fontSize:20,fontWeight:800,color:s.color,fontFamily:"monospace" }}>{s.val}</div>
            <div style={{ fontSize:10,color:s.color,opacity:0.7 }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", borderRight: `1px solid ${C.border}` }}>
          {view==="create" ? <CreateProposalPanel onCreate={handleCreate} loading={creatingLoading} /> : (
            <>
              <div style={{ fontSize:12,color:C.dim,marginBottom:14 }}>{filtered.length} proposal{filtered.length!==1?"s":""}</div>
              {filtered.length===0
                ? <div style={{ textAlign:"center",padding:"60px 20px",color:C.dim }}>
                    <div style={{ fontSize:40,marginBottom:12 }}>🗳</div>
                    <div style={{ fontWeight:700,color:C.dim2,fontSize:16,marginBottom:6 }}>No proposals yet</div>
                    <div style={{ fontSize:13 }}>Use 📋 New Proposal to create the first one.</div>
                  </div>
                : filtered.map(p=><ProposalCard key={p.id} proposal={p} onSelect={setSelected} selected={selected?.id===p.id} />)
              }
            </>
          )}
        </div>
        <div style={{ width: 380, flexShrink: 0, background: C.panel, display: "flex", flexDirection: "column" }}>
          {selected
            ? <ProposalDetail proposal={selected} logs={logs} onVote={handleVote} loading={votingLoading||isEncryptingInput} />
            : <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:C.dim,padding:24,textAlign:"center" }}>
                <div style={{ fontSize:36 }}>🗳</div>
                <div style={{ fontSize:14,color:C.dim2,fontWeight:600 }}>Select a proposal</div>
                <div style={{ fontSize:12 }}>Click any proposal on the left to vote</div>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
