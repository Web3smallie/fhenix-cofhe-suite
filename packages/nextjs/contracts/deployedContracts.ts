/**
 * This file contains the deployed contract addresses and ABIs for the Fhenix Privacy Suite.
 * Deployed on Arbitrum Sepolia (chainId: 421614) using real CoFHE encryption.
 */
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

const InEuint32 = {
  components: [
    { internalType: "uint256", name: "ctHash", type: "uint256" },
    { internalType: "uint8", name: "securityZone", type: "uint8" },
    { internalType: "uint8", name: "utype", type: "uint8" },
    { internalType: "bytes", name: "signature", type: "bytes" },
  ],
  internalType: "struct InEuint32",
  type: "tuple",
};

const InEuint128 = {
  components: [
    { internalType: "uint256", name: "ctHash", type: "uint256" },
    { internalType: "uint8", name: "securityZone", type: "uint8" },
    { internalType: "uint8", name: "utype", type: "uint8" },
    { internalType: "bytes", name: "signature", type: "bytes" },
  ],
  internalType: "struct InEuint128",
  type: "tuple",
};

const InEbool = {
  components: [
    { internalType: "uint256", name: "ctHash", type: "uint256" },
    { internalType: "uint8", name: "securityZone", type: "uint8" },
    { internalType: "uint8", name: "utype", type: "uint8" },
    { internalType: "bytes", name: "signature", type: "bytes" },
  ],
  internalType: "struct InEbool",
  type: "tuple",
};

const deployedContracts = {
  421614: {
    FHEVault: {
      address: "0x131F9177303293E4c168f904C965C0d827916f34",
      abi: [
        { inputs: [], stateMutability: "nonpayable", type: "constructor" },
        {
          inputs: [{ ...InEuint128, name: "encryptedAmount" }],
          name: "deposit",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [{ ...InEuint128, name: "encryptedAmount" }],
          name: "withdraw",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "getVaultBalance",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "address", name: "", type: "address" }],
          name: "depositCount",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "address", name: "user", type: "address" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "Deposited",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "address", name: "user", type: "address" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "Withdrawn",
          type: "event",
        },
      ],
      inheritedFunctions: {},
    },
    PrivatePredictionMarket: {
      address: "0x437e3284D566C93Ab2379CcE82aef25AFba6803e",
      abi: [
        {
          inputs: [
            { internalType: "string", name: "question", type: "string" },
            { internalType: "uint256", name: "duration", type: "uint256" },
          ],
          name: "createMarket",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            { internalType: "uint256", name: "marketId", type: "uint256" },
            { ...InEbool, name: "encSide" },
            { ...InEuint32, name: "encAmount" },
          ],
          name: "placeBet",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [],
          name: "marketCount",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          name: "markets",
          outputs: [
            { internalType: "string", name: "question", type: "string" },
            { internalType: "uint256", name: "endTime", type: "uint256" },
            { internalType: "bool", name: "resolved", type: "bool" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "uint256", name: "", type: "uint256" },
            { internalType: "address", name: "", type: "address" },
          ],
          name: "hasBet",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "view",
          type: "function",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
            { indexed: false, internalType: "string", name: "question", type: "string" },
            { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" },
          ],
          name: "MarketCreated",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "uint256", name: "marketId", type: "uint256" },
            { indexed: true, internalType: "address", name: "bettor", type: "address" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "BetPlaced",
          type: "event",
        },
      ],
      inheritedFunctions: {},
    },
    PrivateVoting: {
      address: "0xa74B829e7F2C2A95849C2c4d708d85a7ed71A06A",
      abi: [
        {
          inputs: [
            { internalType: "string", name: "description", type: "string" },
            { internalType: "uint256", name: "duration", type: "uint256" },
          ],
          name: "createProposal",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            { internalType: "uint256", name: "proposalId", type: "uint256" },
            { ...InEbool, name: "encVote" },
          ],
          name: "castVote",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [],
          name: "proposalCount",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          name: "proposals",
          outputs: [
            { internalType: "string", name: "description", type: "string" },
            { internalType: "uint256", name: "endTime", type: "uint256" },
            { internalType: "bool", name: "executed", type: "bool" },
            { internalType: "euint32", name: "yesCount", type: "uint256" },
            { internalType: "euint32", name: "noCount", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { internalType: "uint256", name: "", type: "uint256" },
            { internalType: "address", name: "", type: "address" },
          ],
          name: "hasVoted",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "view",
          type: "function",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "uint256", name: "proposalId", type: "uint256" },
            { indexed: false, internalType: "string", name: "description", type: "string" },
            { indexed: false, internalType: "uint256", name: "endTime", type: "uint256" },
          ],
          name: "ProposalCreated",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "uint256", name: "proposalId", type: "uint256" },
            { indexed: true, internalType: "address", name: "voter", type: "address" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "VoteCast",
          type: "event",
        },
      ],
      inheritedFunctions: {},
    },
    PrivatePerpDEX: {
      address: "0x6129878988C70f126FEe109a3a5D986F1Bcf972A",
      abi: [
        {
          inputs: [
            { internalType: "bool", name: "isLong", type: "bool" },
            { internalType: "uint8", name: "leverage", type: "uint8" },
            { ...InEuint32, name: "encSize" },
            { ...InEuint32, name: "encEntry" },
          ],
          name: "openPosition",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "positionId", type: "uint256" }],
          name: "closePosition",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [{ internalType: "address", name: "trader", type: "address" }],
          name: "getTraderPositions",
          outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [],
          name: "positionCount",
          outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
          name: "positions",
          outputs: [
            { internalType: "address", name: "trader", type: "address" },
            { internalType: "bool", name: "isLong", type: "bool" },
            { internalType: "uint8", name: "leverage", type: "uint8" },
            { internalType: "euint32", name: "encSize", type: "uint256" },
            { internalType: "euint32", name: "encEntry", type: "uint256" },
            { internalType: "bool", name: "isOpen", type: "bool" },
            { internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "address", name: "trader", type: "address" },
            { indexed: false, internalType: "uint256", name: "positionId", type: "uint256" },
            { indexed: false, internalType: "bool", name: "isLong", type: "bool" },
            { indexed: false, internalType: "uint8", name: "leverage", type: "uint8" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "PositionOpened",
          type: "event",
        },
        {
          anonymous: false,
          inputs: [
            { indexed: true, internalType: "address", name: "trader", type: "address" },
            { indexed: false, internalType: "uint256", name: "positionId", type: "uint256" },
            { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
          ],
          name: "PositionClosed",
          type: "event",
        },
      ],
      inheritedFunctions: {},
    },
    Multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      abi: [
        { inputs: [{ components: [{ internalType: "address", name: "target", type: "address" }, { internalType: "bytes", name: "callData", type: "bytes" }], internalType: "struct Multicall3.Call[]", name: "calls", type: "tuple[]" }], name: "aggregate", outputs: [{ internalType: "uint256", name: "blockNumber", type: "uint256" }, { internalType: "bytes[]", name: "returnData", type: "bytes[]" }], stateMutability: "payable", type: "function" },
        { inputs: [], name: "getBlockNumber", outputs: [{ internalType: "uint256", name: "blockNumber", type: "uint256" }], stateMutability: "view", type: "function" },
        { inputs: [], name: "getChainId", outputs: [{ internalType: "uint256", name: "chainid", type: "uint256" }], stateMutability: "view", type: "function" },
      ],
      inheritedFunctions: {},
    },
  },
} as const;

export default deployedContracts satisfies GenericContractsDeclaration;
