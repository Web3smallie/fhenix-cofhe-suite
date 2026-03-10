"use client";

import { useState } from "react";
import { FheTypes } from "@cofhe/sdk";
import { useEncryptInput } from "./useEncryptInput";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useAccount } from "wagmi";
import { parseEther } from "viem";

export const FHEVaultComponent = () => {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const { onEncryptInput, isEncryptingInput, inputEncryptionDisabled } = useEncryptInput();

  const { isPending: isDepositing, writeContractAsync: depositAsync } = useScaffoldWriteContract({
  contractName: "FHEVault",
  disableSimulate: true,
});

const { isPending: isWithdrawing, writeContractAsync: withdrawAsync } = useScaffoldWriteContract({
  contractName: "FHEVault",
  disableSimulate: true,
});

  const { data: vaultBalance } = useScaffoldReadContract({
    contractName: "FHEVault",
    functionName: "getVaultBalance",
  });

  const { data: userDepositCount } = useScaffoldReadContract({
    contractName: "FHEVault",
    functionName: "depositCount",
    args: [address],
  });

  const handleDeposit = async () => {
    if (!depositAmount) return;
    const amountWei = parseEther(depositAmount);
    const encryptedAmount = await onEncryptInput(FheTypes.Uint128, BigInt(amountWei));
    if (!encryptedAmount) return;
    await depositAsync({
      functionName: "deposit",
      args: [encryptedAmount],
      value: amountWei,
    });
    setDepositAmount("");
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    const amountWei = parseEther(withdrawAmount);
    const encryptedAmount = await onEncryptInput(FheTypes.Uint128, BigInt(amountWei));
    if (!encryptedAmount) return;
    await withdrawAsync({
      functionName: "withdraw",
      args: [encryptedAmount],
    });
    setWithdrawAmount("");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Info Banner */}
      <div className="alert alert-info">
        <span>🔐 Your balance is encrypted on-chain using FHE. Only you can decrypt it.</span>
      </div>

      {/* Stats */}
      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-title">Vault ETH Balance</div>
          <div className="stat-value text-primary text-2xl">
            {vaultBalance ? (Number(vaultBalance) / 1e18).toFixed(4) : "0"} ETH
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Your Deposits</div>
          <div className="stat-value text-secondary text-2xl">
            {userDepositCount ? Number(userDepositCount) : 0}
          </div>
        </div>
      </div>

      {/* Deposit */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">🏦 Deposit ETH (Encrypted)</h2>
          <p className="text-sm text-base-content/60">Amount is FHE-encrypted before sending to chain</p>
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Amount in ETH"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              className="input input-bordered flex-1"
            />
            <button
              onClick={handleDeposit}
              disabled={!depositAmount || isDepositing || isEncryptingInput || inputEncryptionDisabled}
              className="btn btn-primary"
            >
              {isEncryptingInput ? "🔐 Encrypting..." : isDepositing ? "⏳ Depositing..." : "🔒 Deposit"}
            </button>
          </div>
        </div>
      </div>

      {/* Withdraw */}
      <div className="card bg-base-200 shadow">
        <div className="card-body">
          <h2 className="card-title">💸 Withdraw ETH (Encrypted)</h2>
          <p className="text-sm text-base-content/60">Amount is FHE-encrypted before sending to chain</p>
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Amount in ETH"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              className="input input-bordered flex-1"
            />
            <button
              onClick={handleWithdraw}
              disabled={!withdrawAmount || isWithdrawing || isEncryptingInput || inputEncryptionDisabled}
              className="btn btn-secondary"
            >
              {isEncryptingInput ? "🔐 Encrypting..." : isWithdrawing ? "⏳ Withdrawing..." : "💸 Withdraw"}
            </button>
          </div>
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
