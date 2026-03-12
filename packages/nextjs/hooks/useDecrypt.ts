"use client";

import { useCallback, useEffect, useState } from "react";
import { cofhejs, FheTypes } from "cofhejs/web";
import { zeroAddress } from "viem";
import { useCofheConnected } from "./useCofhe";
import { useAccount } from "wagmi";

export type UnsealedItem<T extends FheTypes> = T extends FheTypes.Bool
  ? boolean
  : T extends FheTypes.Uint160
    ? string
    : bigint;

export type DecryptionResult<T extends FheTypes> =
  | { fheType: T; ctHash: null; value: null; error: null; state: "no-data" }
  | { fheType: T; ctHash: bigint; value: null; error: null; state: "encrypted" }
  | { fheType: T; ctHash: bigint; value: null; error: null; state: "pending" }
  | { fheType: T; ctHash: bigint; value: UnsealedItem<T>; error: null; state: "success" }
  | { fheType: T; ctHash: bigint; value: null; error: string; state: "error" };

const _decryptValue = async <T extends FheTypes>(fheType: T, ctHash: bigint): Promise<DecryptionResult<T>> => {
  if (ctHash === 0n) {
    const zeroValue = fheType === FheTypes.Bool ? false : fheType === FheTypes.Uint160 ? zeroAddress : 0n;
    return {
      fheType,
      ctHash: 0n,
      value: zeroValue,
      error: null,
      state: "success",
    } as DecryptionResult<T>;
  }

  try {
    const permit = cofhejs.getPermit();
    if (!permit) throw new Error("No active permit");

    const result = await cofhejs.unseal(ctHash, fheType);
    if (result.success) {
      return {
        fheType,
        ctHash,
        value: result.data as UnsealedItem<T>,
        error: null,
        state: "success",
      } as DecryptionResult<T>;
    }
    return {
      fheType,
      ctHash,
      value: null,
      error: String(result.error),
      state: "error",
    } as DecryptionResult<T>;
  } catch (err: any) {
    return {
      fheType,
      ctHash,
      value: null,
      error: err.message ?? "Unknown error",
      state: "error",
    } as DecryptionResult<T>;
  }
};

const initialDecryptionResult = <T extends FheTypes>(
  fheType: T,
  ctHash: bigint | null | undefined,
): DecryptionResult<T> => {
  if (ctHash == null) {
    return { fheType, ctHash: null, value: null, error: null, state: "no-data" };
  }
  if (ctHash === 0n) {
    return {
      fheType,
      ctHash,
      value: (fheType === FheTypes.Bool ? false : fheType === FheTypes.Uint160 ? zeroAddress : 0n) as UnsealedItem<T>,
      error: null,
      state: "success",
    };
  }
  return { fheType, ctHash, value: null, error: null, state: "encrypted" };
};

export const useDecryptValue = <T extends FheTypes>(
  fheType: T,
  ctHash: bigint | null | undefined,
): { onDecrypt: () => Promise<void>; result: DecryptionResult<T> } => {
  const { address } = useAccount();
  const cofheConnected = useCofheConnected();
  const [result, setResult] = useState<DecryptionResult<T>>(initialDecryptionResult(fheType, ctHash));

  useEffect(() => {
    setResult(initialDecryptionResult(fheType, ctHash));
  }, [fheType, ctHash]);

  const onDecrypt = useCallback(async () => {
    if (ctHash == null) {
      setResult({ fheType, ctHash: null, value: null, error: null, state: "no-data" });
      return;
    }
    if (!cofheConnected || !address) {
      setResult({
        fheType,
        ctHash,
        value: null,
        error: !cofheConnected ? "CoFHE not connected" : "No account connected",
        state: "error",
      });
      return;
    }
    setResult({ fheType, ctHash, value: null, error: null, state: "pending" });
    try {
      const res = await _decryptValue(fheType, ctHash);
      setResult(res);
    } catch (error) {
      setResult({
        fheType,
        ctHash,
        value: null,
        error: error instanceof Error ? error.message : "Unknown error",
        state: "error",
      });
    }
  }, [fheType, ctHash, address, cofheConnected]);

  return { onDecrypt, result };
};
