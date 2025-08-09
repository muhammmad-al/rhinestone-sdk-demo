# Rhinestone SDK & Gelato Smart Wallet Demo

A comprehensive demonstration application showcasing two cutting-edge smart wallet solutions: **Rhinestone Omni Accounts** for cross-chain transfers and **Gelato Smart Wallets** for flexible gas payment options. This interactive demo allows developers to explore and compare different smart wallet capabilities in a hands-on environment.

## 🌟 What This Demo Showcases

This application provides two distinct smart wallet experiences side-by-side:

### 🔮 Rhinestone Omni Account (Left Side)
- **Cross-chain USDC transfers** from Base Sepolia to Ethereum Sepolia
- **Account abstraction** with Safe smart accounts and ERC-7579 modules  
- **Session-based permissions** using EIP-7702 authorization
- **Pimlico paymaster integration** for gas sponsorship
- **Real-time transaction tracking** with bundle IDs and transaction hashes

### 🍦 Gelato Smart Wallet (Right Side)
- **Flexible gas payment options** - pay with sponsored transactions or ERC-20 tokens
- **Automated transaction relay** through Gelato's infrastructure
- **Task-based execution** with status monitoring
- **Simple counter contract interactions** to demonstrate functionality
- **Base Sepolia network operations**

## ✨ Key Features

### 🔄 Cross-Chain Operations
- **Seamless USDC transfers** across different blockchain networks
- **Unified account experience** - one account works across multiple chains
- **Real-time status updates** for cross-chain transaction settlement

### 💰 Multiple Gas Payment Methods
- **Sponsored Transactions**: Gas fees covered by service providers
- **ERC-20 Gas Payments**: Pay transaction fees using USDC or other tokens
- **ETH Gas Payments**: Traditional gas payment for Rhinestone operations

### 🔗 Multi-Network Architecture
- **Base Sepolia**: Primary network for Gelato operations and USDC funding
- **Ethereum Sepolia**: Target network for Rhinestone cross-chain transfers
- **Testnet-safe environment** for risk-free experimentation

### 📊 Live Transaction Monitoring
- **Real-time latency tracking** from submission to confirmation
- **Gas usage analytics** for each transaction type
- **Transaction hash links** to blockchain explorers
- **Task status monitoring** for Gelato operations

## 🏗️ Technical Architecture

### Rhinestone Implementation
```
Smart Account: Safe + ERC-7579 modules
├── Paymaster: Pimlico gas sponsorship
├── Authorization: EIP-7702 session permissions  
├── Cross-chain: Omni Account infrastructure
└── Networks: Base Sepolia → Ethereum Sepolia
```

### Gelato Implementation
```
Smart Wallet: Gelato infrastructure
├── Gas Options: Sponsored & ERC-20 payments
├── Authorization: ECDSA signatures
├── Execution: Task-based relay system
└── Network: Base Sepolia
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **pnpm** package manager
- **Testnet tokens** (Base Sepolia ETH & USDC)

### Required API Keys
| Service | Purpose | Get API Key |
|---------|---------|-------------|
| **Pimlico** | Gas sponsorship for Rhinestone | [pimlico.io](https://pimlico.io) |
| **Gelato** | Smart wallet operations | [gelato.network](https://gelato.network) |
| **Rhinestone** | Omni account creation | [rhinestone.wtf](https://rhinestone.wtf) |

### Installation & Setup

1. **Clone and install**
   ```bash
   git clone <repository-url>
   cd rhinestone-sdk-demo-2
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Add your credentials to `.env`:
   ```env
   NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_api_key
   NEXT_PUBLIC_SPONSOR_API_KEY=your_gelato_api_key  
   NEXT_PUBLIC_RHINESTONE_API_KEY=your_rhinestone_api_key
   NEXT_PUBLIC_EOA_PK=your_eoa_private_key
   NEXT_PUBLIC_SESSION_OWNER_PK=your_session_owner_private_key
   NEXT_PUBLIC_SPONSOR_PK=your_sponsor_private_key
   ```

3. **Start the demo**
   ```bash
   pnpm dev
   ```
   
4. **Open the application**
   Navigate to `http://localhost:3000`

## 🎮 How to Use the Demo

### Rhinestone Omni Account Workflow

1. **Create Account** - Generate a new Rhinestone Omni Account
2. **Fund with ETH** - Add ETH for gas fees (0.001 ETH recommended)
3. **Add USDC** - Send USDC to your account on Base Sepolia
4. **Execute Transfer** - Send USDC cross-chain to Ethereum Sepolia

### Gelato Smart Wallet Workflow

1. **Sponsored Transactions** - Try gas-free transactions paid by Gelato
2. **ERC-20 Gas Payments** - Pay transaction fees using USDC tokens
3. **Monitor Results** - Track transaction status and gas usage

## 📋 Understanding the Results

### Transaction Information
- **Transaction Hash**: Direct links to blockchain explorers
- **Bundle ID**: Rhinestone cross-chain operation identifier  
- **Task ID**: Gelato operation tracking number
- **Latency**: Time from submission to blockchain confirmation
- **Gas Used**: Actual computational cost of the transaction

### Account Status Indicators
- **✅ Account Funded**: Ready for operations
- **Balance Display**: Real-time USDC and ETH balances
- **Transaction Links**: Direct access to explorer details

## 🛠️ Development

### Project Structure
```
src/
├── app/
│   ├── eip-7702/page.tsx      # Main demo interface
│   ├── layout.tsx             # App layout
│   └── providers.tsx          # Context providers
├── components/
│   ├── Button.tsx             # Reusable UI components
│   ├── Counter.tsx            # Smart contract interactions
│   └── Footer.tsx             # App footer
└── utils/
    ├── clients.ts             # Blockchain client configs
    ├── orchestrator.ts        # Rhinestone cross-chain logic
    └── types.ts               # TypeScript definitions
```

### Key Dependencies
- **@rhinestone/sdk**: Omni account and cross-chain operations
- **@gelatonetwork/smartwallet**: Smart wallet infrastructure  
- **viem**: Ethereum interactions and utilities
- **permissionless**: Account abstraction primitives
- **Next.js**: React framework and UI

### Smart Contracts Used
- **Counter Contract**: `0x19575934a9542be941d3206f3ecff4a5ffb9af88`
  - Simple increment function for testing smart wallet operations
  - Deployed on Base Sepolia for Gelato interactions

## 🔍 What Makes This Demo Special

### Real-World Smart Wallet Scenarios
- **Cross-chain asset transfers** using intent-based transactions
- **Flexible gas payment** options beyond traditional ETH fees
- **Session-based permissions** for improved user experience
- **Production-ready SDKs** from leading smart wallet providers

### Educational Value
- **Side-by-side comparison** of different smart wallet approaches
- **Live transaction monitoring** to understand performance characteristics  
- **Multiple authorization patterns** (ECDSA signatures vs session keys)
- **Network abstraction** - users don't need to manage multiple wallets

### Developer-Friendly
- **Complete source code** with detailed comments
- **Environment variable templates** for easy setup
- **Error handling examples** and debugging information
- **TypeScript support** throughout the application

## 🤝 Contributing

Interested in improving this demo? We welcome contributions!

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 📚 Learn More

### Documentation & Resources
- **[Rhinestone SDK Docs](https://github.com/rhinestonewtf/module-sdk-tutorials)** - Complete guides and tutorials
- **[Gelato Documentation](https://docs.gelato.network/)** - Smart wallet implementation details
- **[ERC-7579](https://eips.ethereum.org/EIPS/eip-7579)** - Modular account standard
- **[EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)** - Account delegation specification

### Community & Support
- **GitHub Issues** - Report bugs or request features
- **Rhinestone Discord** - Join the modular account community  
- **Gelato Community** - Connect with smart wallet developers

## ⚠️ Important Notes

- **Testnet Only**: This demo uses Sepolia and Base Sepolia testnets
- **API Key Security**: Never expose production API keys in client-side code
- **Gas Requirements**: Ensure sufficient testnet tokens for operations
- **Network Dependencies**: Requires stable connections to multiple RPC endpoints

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to explore the future of smart wallets?** 🚀

Start the demo and experience seamless cross-chain transfers with Rhinestone and flexible gas payments with Gelato!
