"use client";

import { useCallback, useEffect, useState } from "react";
import { cofhejs, Encryptable, FheTypes } from "cofhejs/web";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { create } from "zustand";
import { notification } from "~~/utils/scaffold-eth";

// ─── Store ────────────────────────────────────────────────────────────────────

interface CofheStore {
  connected: boolean;
  setConnected: (v: boolean) => void;
  permitActive: boolean;
  setPermitActive: (v: boolean) => void;
}

export const useCofheStore = create<CofheStore>(set => ({
  connected: false,
  setConnected: connected => set({ connected }),
  permitActive: false,
  setPermitActive: permitActive => set({ permitActive }),
}));

// ─── Permit Modal Store ───────────────────────────────────────────────────────

interface CofhePermitModalStore {
  generatePermitModalOpen: boolean;
  generatePermitModalCallback?: () => void;
  setGeneratePermitModalOpen: (open: boolean, callback?: () => void) => void;
}

export const useCofheModalStore = create<CofhePermitModalStore>(set => ({
  generatePermitModalOpen: false,
  setGeneratePermitModalOpen: (open, callback) =>
    set({ generatePermitModalOpen: open, generatePermitModalCallback: callback }),
}));

// ─── Connect Hook ─────────────────────────────────────────────────────────────

export function useConnectCofheClient() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const setConnected = useCofheStore(s => s.setConnected);
  const setPermitActive = useCofheStore(s => s.setPermitActive);

  useEffect(() => {
    const connect = async () => {
      if (!publicClient || !walletClient || !address) return;
      try {
        const result = await cofhejs.initializeWithViem({
          viemClient: publicClient as any,
          viemWalletClient: walletClient as any,
          environment: "TESTNET",
          generatePermit: false,
        });
        if (result.success) {
          setConnected(true);
          notification.success("CoFHE connected");
          // Check if permit exists
          const permit = cofhejs.getPermit();
          setPermitActive(!!permit);
        } else {
          console.error("CoFHE connection failed:", result.error);
          notification.error(`CoFHE error: ${result.error}`);
        }
      } catch (err) {
        console.error("CoFHE init error:", err);
      }
    };
    connect();
  }, [walletClient, publicClient, address, setConnected, setPermitActive]);
}

// ─── Status Hooks ─────────────────────────────────────────────────────────────

export const useCofheConnected = () => useCofheStore(s => s.connected);

export const useCofheActivePermit = () => {
  const [permit, setPermit] = useState<any>(null);
  const connected = useCofheConnected();
  useEffect(() => {
    if (!connected) return;
    try {
      const p = cofhejs.getPermit();
      setPermit(p ?? null);
    } catch {
      setPermit(null);
    }
  }, [connected]);
  return permit;
};

export const useCofheStatus = () => {
  const connected = useCofheConnected();
  const { address } = useAccount();
  return { connected, account: address };
};

// ─── Permit Hooks ─────────────────────────────────────────────────────────────

export const useCofheCreatePermit = () => {
  const setPermitActive = useCofheStore(s => s.setPermitActive);
  return useCallback(async () => {
    try {
      const result = await cofhejs.createPermit({ type: "self" });
      if (result.success) {
        setPermitActive(true);
        notification.success("Permit created!");
      } else {
        notification.error(`Permit failed: ${result.error}`);
      }
      return result;
    } catch (err: any) {
      notification.error(`Permit error: ${err.message}`);
    }
  }, [setPermitActive]);
};

export const useCofheIsActivePermitValid = () => {
  const permit = useCofheActivePermit();
  return !!permit;
};

// ─── Encrypt Hook ─────────────────────────────────────────────────────────────

export { cofhejs, Encryptable, FheTypes };
