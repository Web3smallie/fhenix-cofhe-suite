"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useConnectCofheClient, useCofheActivePermit, useCofheConnected, useCofheModalStore } from "~~/hooks/useCofhe";
import { FHEVaultComponent } from "./FHEVaultComponent";
import { PrivatePerpDEXComponent } from "./PrivatePerpDEXComponent";
import { PrivateVotingComponent } from "./PrivateVotingComponent";
import { PrivatePredictionMarketComponent } from "./PrivatePredictionMarketComponent";

const Home = () => {
  const { address: connectedAddress } = useAccount();
  useConnectCofheClient();
  const [activeTab, setActiveTab] = useState<"vault" | "perp" | "voting" | "market">("vault");
  const cofheConnected = useCofheConnected();
  const activePermit = useCofheActivePermit();
  const setGeneratePermitModalOpen = useCofheModalStore(state => state.setGeneratePermitModalOpen);
  const [promptedPermit, setPromptedPermit] = useState(false);

  // Auto-prompt permit when wallet connects and CoFHE is ready but no permit exists
  useEffect(() => {
    if (cofheConnected && connectedAddress && !activePermit && !promptedPermit) {
      setPromptedPermit(true);
      setTimeout(() => {
        setGeneratePermitModalOpen(true);
      }, 1500);
    }
  }, [cofheConnected, connectedAddress, activePermit, promptedPermit, setGeneratePermitModalOpen]);

  const tabs = [
    { key: "vault", label: "🏦 FHE Vault" },
    { key: "perp", label: "📈 Perp DEX" },
    { key: "voting", label: "🗳️ Voting" },
    { key: "market", label: "🎯 Prediction Market" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <div className="relative flex flex-col items-center pt-16 pb-10 px-4 bg-gradient-to-br from-primary/10 via-base-200 to-base-300 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-secondary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-5 rotate-3 text-4xl">
          🔐
        </div>

        <h1 className="relative z-10 text-4xl md:text-5xl font-extrabold text-center mb-3 text-base-content">
          Fhenix Privacy Suite
        </h1>

        <p className="relative z-10 text-center text-base-content/60 mb-2 max-w-xl text-lg">
          End-to-End Encrypted DeFi on Arbitrum Sepolia
        </p>
        <p className="relative z-10 text-center text-base-content/40 mb-5 max-w-lg text-sm">
          Your trades, votes and bets are fully encrypted on-chain using real Fully Homomorphic Encryption — nobody can see your data, not even the blockchain.
        </p>

        <div className="relative z-10 flex flex-wrap justify-center items-center gap-2 mb-5">
          <span className="badge badge-success gap-1 py-3 px-3">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            CoFHE Live
          </span>
          <span className="badge badge-info gap-1 py-3 px-3">🔵 Arbitrum Sepolia</span>
          <span className="badge badge-warning gap-1 py-3 px-3">⚡ Real FHE</span>
          <span className="badge badge-ghost gap-1 py-3 px-3">🛡️ On-chain Privacy</span>
        </div>

        {connectedAddress && (
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 bg-base-100 rounded-full px-4 py-2 shadow-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              <span className="text-sm text-base-content/50">Connected:</span>
              <Address address={connectedAddress} />
            </div>
            {cofheConnected && !activePermit && (
              <div
                className="flex items-center gap-2 bg-warning/20 border border-warning rounded-full px-4 py-2 cursor-pointer hover:bg-warning/30 transition-colors"
                onClick={() => setGeneratePermitModalOpen(true)}
              >
                <span className="w-2 h-2 bg-warning rounded-full animate-pulse"></span>
                <span className="text-sm text-warning font-medium">⚠️ Click to generate your CoFHE permit</span>
              </div>
            )}
            {cofheConnected && activePermit && (
              <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-full px-4 py-2">
                <span className="w-2 h-2 bg-success rounded-full"></span>
                <span className="text-sm text-success font-medium">🛡️ CoFHE Permit Active</span>
              </div>
            )}
          </div>
        )}

        {!connectedAddress && (
          <div className="relative z-10 flex items-center gap-2 bg-base-100 rounded-full px-4 py-2 shadow-sm">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span className="text-sm text-base-content/50">Connect your wallet to get started</span>
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
    </div>
  );
};

export default Home;
