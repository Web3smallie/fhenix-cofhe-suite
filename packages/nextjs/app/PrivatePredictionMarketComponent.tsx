"use client";

import { useState } from "react";
import { FheTypes } from "@cofhe/sdk";
import { useEncryptInput } from "./useEncryptInput";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { parseEther } from "viem";

const DEFAULT_MARKETS = [
  { id: 0, question: "Will ETH reach $5,000 before end of 2025?", endTime: Date.now() / 1000 + 86400 * 30 },
  { id: 1, question: "Will Bitcoin hit $150,000 this year?", endTime: Date.now() / 1000 + 86400 * 60 },
  { id: 2, question: "Will Fhenix mainnet launch in 2025?", endTime: Date.now() / 1000 + 86400 * 90 },
];

export const PrivatePredictionMarketComponent = () => {
  const [betAmounts, setBetAmounts] = useState<Record<number, string>>({});
  const [bettingOn, setBettingOn] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const { onEncryptInput, isEncryptingInput, inputEncryptionDisabled } = useEncryptInput();

  const { isPending: isBetting, writeContractAsync: betAsync } = useScaffoldWriteContract({
  contractName: "PrivatePredictionMarket",
  disableSimulate: true,
});

const { isPending: isCreating, writeContractAsync: createAsync } = useScaffoldWriteContract({
  contractName: "PrivatePredictionMarket",
  disableSimulate: true,
});

  const { data: marketCount } = useScaffoldReadContract({
    contractName: "PrivatePredictionMarket",
    functionName: "marketCount",
  });

  const handleBet = async (marketId: number, side: boolean) => {
    const amount = betAmounts[marketId];
    if (!amount) return;
    setBettingOn(marketId);

    const amountVal = BigInt(Math.floor(parseFloat(amount) * 100));
    const encSide = await onEncryptInput(FheTypes.Bool, side);
    const encAmount = await onEncryptInput(FheTypes.Uint32, amountVal);
    if (!encSide || !encAmount) { setBettingOn(null); return; }

    await betAsync({
      functionName: "placeBet",
      args: [BigInt(marketId), encSide, encAmount],
      value: parseEther(amount),
    });
    setBetAmounts(prev => ({ ...prev, [marketId]: "" }));
    setBettingOn(null);
  };

  const handleCreateMarket = async () => {
    if (!newQuestion) return;
    await createAsync({
      functionName: "createMarket",
      args: [newQuestion, BigInt(30 * 24 * 60 * 60)],
    });
    setNewQuestion("");
  };

  const daysLeft = (endTime: number) => {
    const days = Math.max(0, Math.floor((endTime - Date.now() / 1000) / 86400));
    return days === 0 ? "Ending soon" : `${days}d left`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="alert alert-info">
        <span>🔐 Your bet side and amount are FHE-encrypted. Nobody knows if you bet YES or NO.</span>
      </div>

      {/* Stats */}
      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-title">Active Markets</div>
          <div className="stat-value text-primary">{marketCount ? Number(marketCount) : DEFAULT_MARKETS.length}</div>
        </div>
        <div className="stat">
          <div className="stat-title">Privacy</div>
          <div className="stat-value text-success text-xl">🔐 FHE</div>
        </div>
      </div>

      {/* Markets */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">🎯 Prediction Markets</h2>
          <div className="flex flex-col gap-4 mt-2">
            {DEFAULT_MARKETS.map(market => (
              <div key={market.id} className="p-4 bg-base-100 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium flex-1 mr-2">{market.question}</p>
                  <span className="badge badge-ghost text-xs whitespace-nowrap">{daysLeft(market.endTime)}</span>
                </div>
                <input
                  type="number"
                  placeholder="Bet amount (ETH)"
                  value={betAmounts[market.id] || ""}
                  onChange={e => setBetAmounts(prev => ({ ...prev, [market.id]: e.target.value }))}
                  className="input input-bordered input-sm w-full mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBet(market.id, true)}
                    disabled={!betAmounts[market.id] || isBetting || isEncryptingInput || inputEncryptionDisabled}
                    className="btn btn-success btn-sm flex-1"
                  >
                    {bettingOn === market.id && isEncryptingInput ? "🔐 Encrypting..." :
                     bettingOn === market.id && isBetting ? "⏳ Placing..." : "✅ Bet YES"}
                  </button>
                  <button
                    onClick={() => handleBet(market.id, false)}
                    disabled={!betAmounts[market.id] || isBetting || isEncryptingInput || inputEncryptionDisabled}
                    className="btn btn-error btn-sm flex-1"
                  >
                    {bettingOn === market.id && isEncryptingInput ? "🔐 Encrypting..." :
                     bettingOn === market.id && isBetting ? "⏳ Placing..." : "❌ Bet NO"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Market */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">➕ Create Market</h2>
          <textarea
            placeholder="Enter your prediction question..."
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            className="textarea textarea-bordered w-full mt-2"
            rows={3}
          />
          <button
            onClick={handleCreateMarket}
            disabled={!newQuestion || isCreating || inputEncryptionDisabled}
            className="btn btn-primary mt-2"
          >
            {isCreating ? "⏳ Creating..." : "➕ Create Market"}
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
