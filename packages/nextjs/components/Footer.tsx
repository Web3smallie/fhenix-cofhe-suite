import React from "react";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { useGlobalState } from "~~/services/store/store";

/**
 * Site footer
 */
export const Footer = () => {
  const nativeCurrencyPrice = useGlobalState(state => state.nativeCurrency.price);
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <div className="min-h-0 mb-11 lg:mb-0">
      {/* Fixed bottom bar for price */}
      <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-2 pointer-events-auto">
          {nativeCurrencyPrice > 0 && !isLocalNetwork && (
            <div className="btn btn-primary btn-sm font-normal gap-1 cursor-auto">
              <CurrencyDollarIcon className="h-4 w-4" />
              <span>{nativeCurrencyPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main footer */}
      <footer className="bg-base-200 border-t border-base-300 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Top section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            {/* Brand */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="font-bold text-lg text-primary">Fhenix Privacy Suite</span>
              </div>
              <p className="text-sm text-base-content/60 ml-10">End-to-End Encrypted DeFi</p>
            </div>

            {/* Links */}
            <div className="flex gap-6 text-sm">
              <a
                href="https://github.com/Web3smallie/fhenix-cofhe-suite"
                target="_blank"
                rel="noreferrer"
                className="link link-hover text-base-content/70 hover:text-primary"
              >
                GitHub
              </a>
              <a
                href="https://docs.fhenix.io"
                target="_blank"
                rel="noreferrer"
                className="link link-hover text-base-content/70 hover:text-primary"
              >
                Fhenix Docs
              </a>
              <a
                href="https://sepolia.arbiscan.io"
                target="_blank"
                rel="noreferrer"
                className="link link-hover text-base-content/70 hover:text-primary"
              >
                Explorer
              </a>
            </div>
          </div>

          {/* Tech badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="badge badge-outline badge-primary gap-1 py-3 px-3">
              🔐 Fhenix CoFHE
            </span>
            <span className="badge badge-outline gap-1 py-3 px-3">
              🔵 Arbitrum Sepolia
            </span>
            <span className="badge badge-outline gap-1 py-3 px-3">
              ⚡ Real FHE Encryption
            </span>
            <span className="badge badge-outline gap-1 py-3 px-3">
              🛡️ On-chain Privacy
            </span>
            <span className="badge badge-outline gap-1 py-3 px-3">
              🏗️ Scaffold-ETH 2
            </span>
          </div>

          {/* Contract addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6 text-xs text-base-content/50">
            <div>FHE Vault: <span className="font-mono">0x131F...6f34</span></div>
            <div>Private PerpDEX: <span className="font-mono">0x6129...972A</span></div>
            <div>Private Voting: <span className="font-mono">0xa74B...06A</span></div>
            <div>Prediction Market: <span className="font-mono">0x437e...803e</span></div>
          </div>

          {/* Bottom */}
          <div className="border-t border-base-300 pt-4 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-base-content/50">
            <span>© 2026 Fhenix Privacy Suite. Built with ❤️ on Fhenix CoFHE</span>
            <span>Powered by <a href="https://fhenix.io" target="_blank" rel="noreferrer" className="link link-hover text-primary">Fhenix</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
};
