"use client";

import { useCallback, useState } from "react";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";
import { useCofheCreatePermit, useCofheModalStore } from "~~/hooks/useCofhe";

type ExpirationOption = "1 day" | "1 week" | "1 month";

export const CofhePermitModal = () => {
  const { generatePermitModalOpen, generatePermitModalCallback, setGeneratePermitModalOpen } = useCofheModalStore();
  const createPermit = useCofheCreatePermit();
  const [expiration, setExpiration] = useState<ExpirationOption>("1 week");
  const [name, setName] = useState<string>("");

  const handleClose = useCallback(() => {
    setGeneratePermitModalOpen(false);
    setExpiration("1 week");
    setName("");
  }, [setGeneratePermitModalOpen]);

  const handleGeneratePermit = useCallback(async () => {
    const result = await createPermit();
    if (result?.success) {
      handleClose();
      if (generatePermitModalCallback) {
        generatePermitModalCallback();
      }
    }
  }, [createPermit, generatePermitModalCallback, handleClose]);

  return (
    <dialog className={`modal ${generatePermitModalOpen ? "modal-open" : ""}`}>
      <div className="modal-box relative">
        <button className="btn btn-ghost btn-sm btn-circle absolute right-3 top-3" onClick={handleClose}>
          ✕
        </button>
        <div className="flex items-center justify-center mb-4">
          <ShieldCheckIcon className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-4">Generate CoFHE Permit</h2>
        <p className="text-center mb-6">
          A permit is required to authenticate your identity and grant access to your encrypted data.
        </p>
        <p className="text-center mb-6">
          Generating a permit will open your wallet to sign a message (EIP712) which verifies your ownership of the
          connected wallet.
        </p>

        <div className="flex flex-col gap-4 mb-6">
          {/* Name */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <label className="text-sm font-semibold">
                Name <span className="font-normal">(optional)</span>
              </label>
              <span className="text-xs text-gray-500">{name.length}/24</span>
            </div>
            <input
              type="text"
              placeholder="Enter permit name"
              className="input input-bordered w-full"
              value={name}
              onChange={e => setName(e.target.value.slice(0, 24))}
              maxLength={24}
            />
          </div>

          {/* Expiration */}
          <div className="flex flex-row items-center justify-between gap-2">
            <label className="text-sm font-semibold">Expiration</label>
            <div className="flex gap-2">
              {(["1 day", "1 week", "1 month"] as const).map(option => (
                <div
                  key={option}
                  className={`btn btn-sm ${expiration === option ? "btn-cofhe" : "btn-ghost"}`}
                  onClick={() => setExpiration(option)}
                >
                  {option}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button className="btn btn-cofhe" onClick={handleGeneratePermit}>
            Generate Permit
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={handleClose}>
        <button>close</button>
      </div>
    </dialog>
  );
};
