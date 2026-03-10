"use client";

import { useRef } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import { useCofheActivePermit, useCofheConnected, useCofheCreatePermit, useCofheStatus } from "~~/app/useCofhe";
import { useOutsideClick } from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";

export const CofhePortal = () => {
  const { account, connected } = useCofheStatus();
  const dropdownRef = useRef<HTMLDetailsElement>(null);
  const activePermit = useCofheActivePermit();
  const createPermit = useCofheCreatePermit();

  const closeDropdown = () => {
    dropdownRef.current?.removeAttribute("open");
  };

  useOutsideClick(dropdownRef, closeDropdown);

  const { chainId } = useCofheStatus() as any;
  const networkName = scaffoldConfig.targetNetworks[0]?.name ?? "Arbitrum Sepolia";

  const handleCreatePermit = async () => {
    closeDropdown();
    await createPermit();
  };

  return (
    <details ref={dropdownRef} className="dropdown dropdown-end leading-3">
      <summary className="ml-1 btn btn-cofhe btn-sm px-2 rounded-full dropdown-toggle">
        <ShieldCheckIcon className="h-4 w-4" />
        <ChevronDownIcon className="h-4 w-4" />
      </summary>
      <div className="dropdown-content z-2 p-4 mt-2 shadow-center shadow-accent bg-base-200 rounded-box gap-1 min-w-[275px]">
        <div className="flex flex-row justify-center items-center gap-2 px-2 py-1">
          <ShieldCheckIcon className="h-5 w-5 text-cofhe-primary" />
          <span className="font-bold">CoFHE Portal</span>
        </div>

        {/* Connection Status */}
        <div className="flex flex-col gap-1 mt-2">
          <div className="menu-title text-xs">Connection Status</div>
          <InfoRow
            className="h-8"
            label="Connected"
            value={connected ? "Yes" : "No"}
            valueClassName={connected ? "text-success" : "text-error"}
          />
          <InfoRow
            className="h-8"
            label="Account"
            value={account ? account.slice(0, 6) + "..." + account.slice(-4) : "Not connected"}
            valueClassName={account ? "font-mono" : undefined}
          />
          <InfoRow className="h-8" label="Network" value={networkName} />
        </div>

        {/* Permit Status */}
        <div className="flex flex-col gap-1 mt-2">
          <div className="menu-title text-xs">Permit</div>
          {activePermit ? (
            <div className="flex flex-col bg-base-300/30 p-2 rounded-lg">
              <div className="text-xs font-semibold text-success mb-1">✅ Active Permit</div>
              <InfoRow className="text-xs" label="Issuer" value={activePermit.issuer?.slice(0, 6) + "..." + activePermit.issuer?.slice(-4)} valueClassName="font-mono" />
              {activePermit.expiration && (
                <InfoRow className="text-xs" label="Expires" value={new Date(Number(activePermit.expiration) * 1000).toLocaleDateString()} />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 bg-base-300/30 py-4 rounded-lg">
              <span className="text-base-content/50 text-sm">No active permit</span>
            </div>
          )}
          <div
            className={`btn btn-sm btn-cofhe mt-2 w-full ${!connected && "btn-disabled"}`}
            onClick={handleCreatePermit}
          >
            {activePermit ? "Regenerate Permit" : "Create Permit"}
          </div>
        </div>
      </div>
    </details>
  );
};

const InfoRow = ({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) => {
  return (
    <div className={`flex flex-row justify-between items-center text-sm gap-6 ${className}`}>
      <span className="text-left text-nowrap">{label}</span>
      <span className={`font-bold text-nowrap text-right ${valueClassName}`}>{value}</span>
    </div>
  );
};
