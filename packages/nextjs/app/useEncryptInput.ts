"use client";

import { useCallback, useState } from "react";
import { cofhejs, Encryptable, FheTypes } from "cofhejs/web";
import { useCofheConnected } from "./useCofhe";
import { notification } from "~~/utils/scaffold-eth";

export const useEncryptInput = () => {
  const [isEncryptingInput, setIsEncryptingInput] = useState(false);
  const connected = useCofheConnected();

  const onEncryptInput = useCallback(
    async (fheType: FheTypes, value: any) => {
      if (!connected) return;
      setIsEncryptingInput(true);
      try {
        let encryptable;
        switch (fheType) {
          case FheTypes.Bool:
            encryptable = Encryptable.bool(value);
            break;
          case FheTypes.Uint8:
            encryptable = Encryptable.uint8(value);
            break;
          case FheTypes.Uint16:
            encryptable = Encryptable.uint16(value);
            break;
          case FheTypes.Uint32:
            encryptable = Encryptable.uint32(value);
            break;
          case FheTypes.Uint64:
            encryptable = Encryptable.uint64(value);
            break;
          case FheTypes.Uint128:
            encryptable = Encryptable.uint128(value);
            break;
          default:
            throw new Error(`Unsupported FHE type: ${fheType}`);
        }

        const result = await cofhejs.encrypt([encryptable]);
        if (!result.success) {
          notification.error(`Encryption failed: ${result.error}`);
          return;
        }
        return result.data[0];
      } catch (err: any) {
        notification.error(`Encryption error: ${err.message}`);
        return;
      } finally {
        setIsEncryptingInput(false);
      }
    },
    [connected],
  );

  return { onEncryptInput, isEncryptingInput, inputEncryptionDisabled: !connected };
};
