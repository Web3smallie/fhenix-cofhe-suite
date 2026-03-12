"use client";

import { useState } from "react";
import { FheTypes } from "@cofhe/sdk";
import { useEncryptInput } from "./useEncryptInput";
import { useScaffoldWriteContract, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";
import { parseEther } from "viem";

const ASSETS = [
  { symbol: "BTC/USD", price: 97420 },
  { symbol: "ETH/USD", price: 3840 },
  { symbol: "SOL/USD", price: 182 },
];

export const PrivatePerpDEXComponent = () => {
  const { address } = useAccount();
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [leverage, setLeverage] = useState(5);
  const [size, setSize] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[1]);
  const { onEncryptInput, isEncryptingInput, inputEncryptionDisabled } = useEncryptInput();

  const { isPending, writeContractAsync } = useScaffoldWriteContract({
  contractName: "PrivatePerpDEX",
  disableSimulate: true,
});

  const { data: traderPositions } = useScaffoldReadContract({
    contractName: "PrivatePerpDEX",
    functionName: "getTraderPositions",
    args: [address],
  });

  const handleOpenPosition = async () => {
    if (!size) return;
    const sizeVal = BigInt(Math.floor(parseFloat(size) * 100));
    const entryVal = BigInt(Math.floor(selectedAsset.price));
    const collateral = parseEther((parseFloat(size) * 0.001).toFixed(6));

    const encSize = await onEncryptInput(FheTypes.Uint32, sizeVal);
    const encEntry = await onEncryptInput(FheTypes.Uint32, entryVal);
    if (!encSize || !encEntry) return;

    await writeContractAsync({
      functionName: "openPosition",
      args: [side === "LONG", leverage, encSize, encEntry],
      value: collateral,
    });
    setSize("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="alert alert-info">
        <span>🔐 Position size and entry price are FHE-encrypted. Nobody can see your trade details.</span>
      </div>

      {/* Asset Selector */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">📈 Open Encrypted Position</h2>

          <div className="flex gap-2 flex-wrap mt-2">
            {ASSETS.map(a => (
              <button
                key={a.symbol}
                onClick={() => setSelectedAsset(a)}
                className={`btn btn-sm ${selectedAsset.symbol === a.symbol ? "btn-primary" : "btn-ghost border border-base-300"}`}
              >
                {a.symbol}
              </button>
            ))}
          </div>

          <div className="text-2xl font-bold mt-2">${selectedAsset.price.toLocaleString()}</div>

          {/* Long/Short */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setSide("LONG")}
              className={`btn flex-1 ${side === "LONG" ? "btn-success" : "btn-ghost border border-base-300"}`}
            >
              📈 LONG
            </button>
            <button
              onClick={() => setSide("SHORT")}
              className={`btn flex-1 ${side === "SHORT" ? "btn-error" : "btn-ghost border border-base-300"}`}
            >
              📉 SHORT
            </button>
          </div>

          {/* Leverage */}
          <div className="mt-2">
            <div className="flex justify-between text-sm mb-1">
              <span>Leverage</span>
              <span className={`font-bold ${leverage > 10 ? "text-error" : leverage > 5 ? "text-warning" : "text-success"}`}>
                {leverage}x {leverage > 10 ? "⚠ High Risk" : leverage > 5 ? "Medium" : "Low Risk"}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={leverage}
              onChange={e => setLeverage(parseInt(e.target.value))}
              className="range range-primary range-sm"
            />
          </div>

          {/* Size */}
          <div className="mt-2">
            <label className="label"><span className="label-text">Size (ETH)</span></label>
            <input
              type="number"
              placeholder="0.01"
              value={size}
              onChange={e => setSize(e.target.value)}
              className="input input-bordered w-full"
            />
          </div>

          {size && (
            <div className="text-sm text-base-content/60 mt-1">
              Notional: ${(parseFloat(size || "0") * leverage * selectedAsset.price).toFixed(0)}
            </div>
          )}

          <button
            onClick={handleOpenPosition}
            disabled={!size || isPending || isEncryptingInput || inputEncryptionDisabled}
            className={`btn mt-3 ${side === "LONG" ? "btn-success" : "btn-error"}`}
          >
            {isEncryptingInput ? "🔐 Encrypting..." : isPending ? "⏳ Opening..." : `🔒 Open ${side} ${leverage}x`}
          </button>
        </div>
      </div>

      {/* Positions */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">📋 Your Positions</h2>
          {traderPositions && traderPositions.length > 0 ? (
            <div className="flex flex-col gap-2">
              {Array.from(traderPositions).map((posId: any) => (
                <div key={posId.toString()} className="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                  <span className="font-mono text-sm">Position #{posId.toString()}</span>
                  <span className="badge badge-info">🔐 Encrypted</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-base-content/50 text-sm">No open positions</p>
          )}
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
