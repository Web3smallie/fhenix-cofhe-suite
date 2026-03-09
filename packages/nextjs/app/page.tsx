"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useConnectCofheClient } from "./useCofhe";
import { FHEVaultComponent } from "./FHEVaultComponent";
import { PrivatePerpDEXComponent } from "./PrivatePerpDEXComponent";
import { PrivateVotingComponent } from "./PrivateVotingComponent";
import { PrivatePredictionMarketComponent } from "./PrivatePredictionMarketComponent";

const Home = () => {
  const { address: connectedAddress } = useAccount();
  useConnectCofheClient();
  const [activeTab, setActiveTab] = useState<"vault" | "perp" | "voting" | "market">("vault");

  const tabs = [
    { key: "vault", label: "🏦 FHE Vault" },
    { key: "perp", label: "📈 Perp DEX" },
    { key: "voting", label: "🗳️ Voting" },
    { key: "market", label: "🎯 Prediction Market" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Header */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4 bg-gradient-to-b from-base-300 to-base-200">
        <div className="text-6xl mb-3">🔐</div>
        <h1 className="text-4xl font-bold text-center mb-2">Fhenix Privacy Suite</h1>
        <p className="text-center text-base-content/60 mb-1 max-w-lg">
          Real Fully Homomorphic Encryption on Arbitrum Sepolia. Your data stays encrypted — even on-chain.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <span className="badge badge-success badge-sm">CoFHE Live</span>
          <span className="badge badge-info badge-sm">Arbitrum Sepolia</span>
        </div>
        {connectedAddress && (
          <div className="flex items-center gap-2 mt-3">
            <span className="text-sm text-base-content/50">Connected:</span>
            <Address address={connectedAddress} />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 px-4 py-4 flex-wrap bg-base-200 border-b border-base-300">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`btn btn-sm ${activeTab === tab.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex justify-center px-4 py-8 bg-base-100 flex-1">
        <div className="w-full max-w-2xl">
          {activeTab === "vault" && <FHEVaultComponent />}
          {activeTab === "perp" && <PrivatePerpDEXComponent />}
          {activeTab === "voting" && <PrivateVotingComponent />}
          {activeTab === "market" && <PrivatePredictionMarketComponent />}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-sm text-base-content/40 bg-base-200">
        Powered by Fhenix CoFHE • Arbitrum Sepolia Testnet
      </div>
    </div>
  );
};

export default Home;
