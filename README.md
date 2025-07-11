# Smart Wallet Performance Comparison Tool

A comprehensive benchmarking application that compares transaction performance between different smart wallet SDKs. This tool measures and analyzes transaction latency and gas usage across multiple blockchain networks and payment methods.

## Overview

This application provides a side-by-side comparison of smart wallet performance, specifically focusing on:

- **Rhinestone SDK** (Safe Smart Account + Pimlico Paymaster) on Sepolia
- **Gelato Smart Wallet SDK** on Base Sepolia

The tool enables developers and users to make informed decisions about smart wallet solutions by providing real-time performance metrics.

## Features

### 🔄 Parallel Transaction Execution
- Executes transactions simultaneously across different SDKs
- Ensures fair comparison by running under identical conditions
- Measures both sponsored and ERC20 gas payment scenarios

### ⏱️ Performance Metrics
- **Transaction Latency**: Measures time from submission to blockchain confirmation
- **Gas Usage**: Tracks actual gas consumption for each transaction
- **Real-time Updates**: Live display of transaction status and results

### 💰 Payment Method Comparison
- **Sponsored Transactions**: Gas fees paid by service providers (Pimlico/Gelato)
- **ERC20 Transactions**: Gas fees paid using ERC20 tokens (USDC/ETH)

### 🔗 Multi-Network Support
- **Sepolia**: For Rhinestone Safe smart account operations
- **Base Sepolia**: For Gelato smart wallet operations

## Architecture

### Rhinestone Implementation
- **Smart Account**: Safe smart account with ERC-7579 modules
- **Paymaster**: Pimlico for gas sponsorship
- **Authorization**: Session-based permissions with EIP-7702
- **Network**: Sepolia testnet

### Gelato Implementation
- **Smart Account**: Gelato smart wallet
- **Paymaster**: Gelato's internal sponsorship system
- **Authorization**: ECDSA signature-based
- **Network**: Base Sepolia testnet

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- pnpm package manager
- Access to required API keys

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rhinestone-sdk-demo-1
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Add your API keys to `.env`:
   ```env
   NEXT_PUBLIC_PIMLICO_API_KEY=your_pimlico_api_key
   NEXT_PUBLIC_SPONSOR_API_KEY=your_gelato_api_key
   NEXT_PUBLIC_RHINESTONE_API_KEY=your_rhinestone_api_key
   NEXT_PUBLIC_EOA_PK=your_eoa_private_key
   NEXT_PUBLIC_SESSION_OWNER_PK=your_session_owner_private_key
   NEXT_PUBLIC_SPONSOR_PK=your_sponsor_private_key
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000/eip-7702`

## Usage

### Running Performance Tests

1. **Sponsored Transaction Comparison**
   - Click "Run Sponsored TXs (Parallel)"
   - Compares gas-sponsored transactions between Rhinestone and Gelato
   - Results show latency and gas usage for each SDK

2. **ERC20 Transaction Comparison**
   - Click "Run ERC20 TXs (Parallel)"
   - Compares ERC20 gas payment transactions
   - Rhinestone requires ETH funding, Gelato uses USDC directly

### Understanding Results

#### Transaction Information
- **Transaction Hash**: Links to blockchain explorers
- **Latency**: Time from submission to confirmation (in seconds)
- **Gas Used**: Actual gas consumption for the transaction
- **Task ID**: For Gelato transactions (links to status page)

#### Account Status
- **EOA Funding**: Shows whether smart accounts have been funded
- **Delegation Status**: Indicates if accounts are properly configured

## Technical Details

### Transaction Flow

#### Rhinestone Sponsored Transactions
1. Create Safe smart account with session validator
2. Prepare user operation with increment call
3. Sign with session owner
4. Submit via Pimlico paymaster
5. Wait for confirmation

#### Gelato Sponsored Transactions
1. Create Gelato smart account
2. Prepare transaction with sponsored payment
3. Submit to Gelato network
4. Wait for task completion

### Performance Measurement
- **Latency**: Measured from transaction submission to blockchain confirmation
- **Gas Usage**: Retrieved from transaction receipts
- **Retry Logic**: Implements retry mechanisms for transaction receipt retrieval

## API Keys Required

| Service | Purpose | Network |
|---------|---------|---------|
| Pimlico | Gas sponsorship for Rhinestone | Sepolia |
| Gelato | Smart wallet operations | Base Sepolia |
| Rhinestone | Omni account creation | Sepolia |

## Development

### Project Structure
```
src/
├── app/
│   └── eip-7702/
│       └── page.tsx          # Main comparison interface
├── components/
│   ├── Button.tsx           # Reusable button component
│   └── Footer.tsx           # Application footer
└── utils/
    ├── clients.ts           # Blockchain client configurations
    └── types.ts             # TypeScript type definitions
```

### Key Dependencies
- **Next.js**: React framework
- **viem**: Ethereum client library
- **permissionless**: Account abstraction utilities
- **@rhinestone/sdk**: Rhinestone smart account SDK
- **@gelatonetwork/smartwallet**: Gelato smart wallet SDK

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For questions or issues:
- Create an issue in this repository
- Check the [Module SDK documentation](https://github.com/rhinestonewtf/module-sdk-tutorials)
- Review the [Gelato documentation](https://docs.gelato.network/)

---

**Note**: This tool is designed for testing and comparison purposes. Always verify results in your specific use case and network conditions.
