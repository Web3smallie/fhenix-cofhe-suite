# 🔐 Fhenix Privacy Suite

A full Privacy DeFi Suite built on Arbitrum Sepolia using **CoFHE** (Collaborative Fully Homomorphic Encryption) by Fhenix. All transactions, votes, and bets are encrypted on-chain — nobody can see your data, not even validators.

🌐 **Live Demo:** https://fhenix-cofhe-suite.netlify.app

---

## ✨ Features

### 🏦 FHE Vault
- Deposit and withdraw ETH with **fully encrypted amounts**
- Your balance is hidden on-chain using CoFHE
- Only you can reveal your balance using your wallet key
- Smart contract verifies the ZK-proof without ever knowing the value

### 📈 Private Perp DEX
- Trade perpetual futures with **encrypted position sizes and entry prices**
- Live price feeds from Binance and CoinGecko
- Real-time candlestick charts
- Your trades are completely private on-chain

### 🗳️ Private Voting (like Snapshot)
- Governance voting where your **vote is CoFHE-encrypted**
- Create proposals with custom durations
- Vote tallies are hidden until voting ends
- Results only reveal after the deadline passes

### 🎯 Private Prediction Market (like Polymarket)
- Bet on outcomes with **encrypted bet sides and amounts**
- Nobody can see which side you bet on or how much
- Full on-chain privacy powered by FHE

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, TailwindCSS, DaisyUI
- **Blockchain:** Solidity, Hardhat, Arbitrum Sepolia
- **FHE:** CoFHE by Fhenix (`cofhejs`)
- **Web3:** Wagmi, Viem, RainbowKit
- **Framework:** Scaffold-ETH 2
- **Deployment:** Netlify

---

## 🔒 How CoFHE Works

1. **Encrypt locally** — Values are encrypted in the browser using CoFHE before being sent on-chain
2. **ZK-proof on-chain** — Only the encrypted proof is submitted to the smart contract
3. **Private computation** — The contract performs operations on encrypted values without ever decrypting them
4. **User-controlled reveal** — Only you can decrypt your own data using your wallet signature (permit)

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- Yarn
- MetaMask or any EVM wallet

### Installation

```bash
git clone https://github.com/web3smallie/fhenix-cofhe-suite.git
cd fhenix-cofhe-suite
yarn install
```

### Start the frontend

```bash
cd packages/nextjs
yarn dev
```

Open [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file in `packages/nextjs`:

```
NEXT_PUBLIC_IGNORE_BUILD_ERROR=true
```

---

## 📡 Smart Contracts (Arbitrum Sepolia)

| Contract | Description |
|----------|-------------|
| `FHEVault` | Private ETH deposits and withdrawals |
| `PrivatePerpDEX` | Encrypted perpetual trading |
| `PrivateVoting` | Private governance voting |
| `PrivatePredictionMarket` | Encrypted prediction markets |

---

## 🏗️ Project Structure

```
fhenix-cofhe-suite/
├── packages/
│   ├── nextjs/          # Frontend (Next.js)
│   │   ├── app/         # Pages and components
│   │   ├── hooks/       # Custom React hooks
│   │   └── contracts/   # Contract ABIs and addresses
│   └── hardhat/         # Smart contracts
│       └── contracts/   # Solidity contracts
```

---

## 🙏 Built With

- [Fhenix CoFHE](https://fhenix.io) — Real on-chain FHE
- [Scaffold-ETH 2](https://scaffoldeth.io) — Ethereum dev framework
- [Arbitrum](https://arbitrum.io) — L2 scaling solution

---

Built with ❤️ for the Fhenix Privacy Hackathon
