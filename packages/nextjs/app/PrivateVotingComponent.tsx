"use client";

import { useState } from "react";
import { FheTypes } from "@cofhe/sdk";
import { useEncryptInput } from "./useEncryptInput";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";

const DEFAULT_PROPOSALS = [
  { id: 0, description: "Should we increase protocol fees to 0.3%?", endTime: Date.now() / 1000 + 86400 },
  { id: 1, description: "Should we add SOL/USD market to the Perp DEX?", endTime: Date.now() / 1000 + 172800 },
  { id: 2, description: "Should we deploy on Base mainnet?", endTime: Date.now() / 1000 + 259200 },
];

export const PrivateVotingComponent = () => {
  const [newProposal, setNewProposal] = useState("");
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const { onEncryptInput, isEncryptingInput, inputEncryptionDisabled } = useEncryptInput();

  const { isPending: isCreating, writeContractAsync: createAsync } = useScaffoldWriteContract({
    contractName: "PrivateVoting",
  });

  const { isPending: isVoting, writeContractAsync: voteAsync } = useScaffoldWriteContract({
    contractName: "PrivateVoting",
  });

  const { data: proposalCount } = useScaffoldReadContract({
    contractName: "PrivateVoting",
    functionName: "proposalCount",
  });

  const handleCreateProposal = async () => {
    if (!newProposal) return;
    await createAsync({
      functionName: "createProposal",
      args: [newProposal, BigInt(7 * 24 * 60 * 60)],
    });
    setNewProposal("");
  };

  const handleVote = async (proposalId: number, vote: boolean) => {
    setVotingFor(proposalId);
    const encVote = await onEncryptInput(FheTypes.Bool, vote);
    if (!encVote) { setVotingFor(null); return; }
    await voteAsync({
      functionName: "castVote",
      args: [BigInt(proposalId), encVote],
    });
    setVotingFor(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="alert alert-info">
        <span>🔐 Votes are FHE-encrypted. Results are computed without revealing individual votes.</span>
      </div>

      {/* Stats */}
      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-title">Active Proposals</div>
          <div className="stat-value text-primary">{proposalCount ? Number(proposalCount) : DEFAULT_PROPOSALS.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Privacy</div>
          <div className="stat-value text-success text-xl">🔐 FHE</div>
        </div>
      </div>

      {/* Proposals */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">🗳️ Active Proposals</h2>
          <div className="flex flex-col gap-3 mt-2">
            {DEFAULT_PROPOSALS.map(proposal => (
              <div key={proposal.id} className="p-4 bg-base-100 rounded-xl">
                <div className="flex justify-between items-start mb-3">
                  <p className="font-medium flex-1 mr-2">{proposal.description}</p>
                  <span className="badge badge-ghost text-xs">#{proposal.id}</span>
                </div>
                <div className="text-xs text-base-content/50 mb-3">
                  Ends: {new Date(proposal.endTime * 1000).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(proposal.id, true)}
                    disabled={isVoting || isEncryptingInput || inputEncryptionDisabled}
                    className="btn btn-success btn-sm flex-1"
                  >
                    {votingFor === proposal.id && isEncryptingInput ? "🔐 Encrypting..." :
                     votingFor === proposal.id && isVoting ? "⏳ Voting..." : "✅ Yes"}
                  </button>
                  <button
                    onClick={() => handleVote(proposal.id, false)}
                    disabled={isVoting || isEncryptingInput || inputEncryptionDisabled}
                    className="btn btn-error btn-sm flex-1"
                  >
                    {votingFor === proposal.id && isEncryptingInput ? "🔐 Encrypting..." :
                     votingFor === proposal.id && isVoting ? "⏳ Voting..." : "❌ No"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Proposal */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">➕ Create Proposal</h2>
          <textarea
            placeholder="Enter your proposal description..."
            value={newProposal}
            onChange={e => setNewProposal(e.target.value)}
            className="textarea textarea-bordered w-full mt-2"
            rows={3}
          />
          <button
            onClick={handleCreateProposal}
            disabled={!newProposal || isCreating || inputEncryptionDisabled}
            className="btn btn-primary mt-2"
          >
            {isCreating ? "⏳ Creating..." : "➕ Create Proposal"}
          </button>
        </div>
      </div>

      {inputEncryptionDisabled && (
        <div className="alert alert-warning">
          <span>⚠️ Connect your wallet to enable FHE encryption</span>
        </div>
      )}
    </div>
  );
};
