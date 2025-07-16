"use client";
import { Button } from "@/components/Button";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  Address,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  Hex,
  http,
  isAddress,
  parseEther,
} from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
} from "viem/chains";
import { Footer } from "@/components/Footer";
import { getTokenAddress } from "@rhinestone/sdk/orchestrator";
import { createRhinestoneAccount } from "@rhinestone/sdk";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createWalletClient } from "viem";

import {
  createGelatoSmartWalletClient,
  type GelatoTaskStatus,
  sponsored,
  erc20,
} from "@gelatonetwork/smartwallet";
import { gelato } from "@gelatonetwork/smartwallet/accounts";

const sourceChain = baseSepolia;
const targetChains = [arbitrumSepolia, baseSepolia, optimismSepolia, sepolia];

export default function Home() {
  // Rhinestone Omni Account State
  const [rhinestoneAccount, setRhinestoneAccount] = useState<any>(null);
  const [accountAddress, setAccountAddress] = useState<`0x${string}` | "">("");
  const [isAccountFunded, setIsAccountFunded] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [createAccountLoading, setCreateAccountLoading] = useState(false);
  const [fundAccountLoading, setFundAccountLoading] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [targetAddress, setTargetAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [selectedNetwork, setSelectedNetwork] = useState(421614);
  const [error, setError] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState<string>("");

  // Gelato State
  const [account, setAccount] = useState<any>();
  const [sponsoredLoading, setSponsoredLoading] = useState(false);
  const [erc20Loading, setErc20Loading] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [gelatoTxHash, setGelatoTxHash] = useState<string>("");
  const [gelatoTaskId, setGelatoTaskId] = useState<string>("");
  const [gelatoErc20TaskId, setGelatoErc20TaskId] = useState<string>("");
  const [gelatoLatency, setGelatoLatency] = useState<number | null>(null);
  const [gelatoStartTime, setGelatoStartTime] = useState<number | null>(null);
  const [gelatoGasUsed, setGelatoGasUsed] = useState<string | null>(null);

  // Create public client for Base Sepolia (Gelato)
  const baseSepoliaPublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // Load saved account from localStorage on component mount
  useEffect(() => {
    const savedAccount = localStorage.getItem("rhinestone-account");
    if (savedAccount) {
      const accountData = JSON.parse(savedAccount);
      setAccountAddress(accountData.address as `0x${string}`);
      setIsAccountFunded(accountData.funded || false);
      
      // Recreate the rhinestone account if we have the private key
      if (accountData.privateKey) {
        const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
        if (rhinestoneApiKey) {
          const account = privateKeyToAccount(accountData.privateKey as `0x${string}`);
          createRhinestoneAccount({
            owners: {
              type: 'ecdsa',
              accounts: [account],
            },
            rhinestoneApiKey,
          }).then(setRhinestoneAccount);
        }
      }
    }
  }, []);

  // Rhinestone Omni Account Functions
  const getBalance = async () => {
    if (accountAddress) {
      try {
        console.log("Fetching balance for account:", accountAddress);
        
        const publicClient = createPublicClient({
          chain: sourceChain,
          transport: http(),
        });

        // Get USDC balance
        const usdcAddress = getTokenAddress("USDC", sourceChain.id);
        console.log("USDC contract address:", usdcAddress);

        const balance = await publicClient.readContract({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [accountAddress as `0x${string}`],
        });

        const balanceInUsdc = Number(balance) / 10 ** 6;
        console.log("Raw balance:", balance.toString());
        console.log("Balance in USDC:", balanceInUsdc);
        
        setUsdcBalance(balanceInUsdc);

        // Get ETH balance
        const ethBalanceWei = await publicClient.getBalance({
          address: accountAddress as `0x${string}`,
        });

        const ethBalanceInEth = Number(ethBalanceWei) / 10 ** 18;
        console.log("ETH balance in ETH:", ethBalanceInEth);
        
        setEthBalance(ethBalanceInEth);
      } catch (error) {
        console.error("Error fetching balance:", error);
        setError(`Failed to fetch balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  useEffect(() => {
    getBalance();
  }, [accountAddress]);

  // Auto-refresh balance every 5 seconds when account is funded
  useEffect(() => {
    if (!isAccountFunded) return;
    
    // Initial balance check
    getBalance();
    
    const interval = setInterval(() => {
      getBalance();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, [isAccountFunded]);

  // Add manual refresh function
  const refreshBalance = useCallback(async () => {
    console.log("Manually refreshing balance...");
    await getBalance();
  }, []);

  const handleCreateAccount = useCallback(async () => {
    console.log("🚀 BUTTON CLICKED - handleCreateAccount called!");
    
    try {
      setCreateAccountLoading(true);
      setError(null);
      
      // Clear any existing account data
      setRhinestoneAccount(null);
      setAccountAddress("");
      setIsAccountFunded(false);
      setBundleId("");
      localStorage.removeItem("rhinestone-account");
      
      console.log("=== CREATE ACCOUNT DEBUG ===");
      console.log("Creating Rhinestone Omni Account...");
      
      // Validate required environment variables
      const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
      console.log("Rhinestone API Key present:", !!rhinestoneApiKey);
      console.log("Rhinestone API Key length:", rhinestoneApiKey?.length);
      
      if (!rhinestoneApiKey) {
        throw new Error('NEXT_PUBLIC_RHINESTONE_API_KEY environment variable is required');
      }

      // Generate a new private key each time for a unique account
      const newPrivateKey = generatePrivateKey();
      console.log("Generated new private key:", newPrivateKey);

      const account = privateKeyToAccount(newPrivateKey);
      console.log("Using new EOA:", account.address);

      // Create Rhinestone account - exactly as in docs
      console.log("Calling createRhinestoneAccount...");
      const _rhinestoneAccount = await createRhinestoneAccount({
        owners: {
          type: 'ecdsa',
          accounts: [account],
        },
        rhinestoneApiKey,
    });
    
      console.log("Rhinestone account created, getting address...");
      const address = await _rhinestoneAccount.getAddress();
      console.log("Smart account address:", address);

      setRhinestoneAccount(_rhinestoneAccount);
      setAccountAddress(address as `0x${string}`);
      
      // Save to localStorage (only save the address and private key, not the account object)
      localStorage.setItem("rhinestone-account", JSON.stringify({
        address: address,
        privateKey: newPrivateKey,
        funded: false
      }));
      
      console.log("Rhinestone Omni Account created successfully");
      
    } catch (error) {
      console.error("=== CREATE ACCOUNT ERROR ===");
      console.error("Error creating Rhinestone account:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        rhinestoneApiKey: process.env.NEXT_PUBLIC_RHINESTONE_API_KEY ? 'Present' : 'Missing',
        EOA_PK: process.env.NEXT_PUBLIC_EOA_PK ? 'Present' : 'Missing'
      });
      setError(`Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCreateAccountLoading(false);
    }
  }, []);

    const handleFundAccount = useCallback(async () => {
    if (!accountAddress) {
      setError("No account address available");
      return;
    }

    try {
      setFundAccountLoading(true);
      setError(null);
      console.log("Funding account with ETH...");

      // Use the funding private key from environment variables
      const fundingPrivateKey = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
      if (!fundingPrivateKey) {
        throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required for funding');
      }

      const fundingAccount = privateKeyToAccount(fundingPrivateKey);
      const publicClient = createPublicClient({
      chain: sourceChain,
        transport: http(),
      });
      const fundingClient = createWalletClient({
        account: fundingAccount,
      chain: sourceChain,
      transport: http(),
    });

      console.log(`Funding smart account (${accountAddress}) with 0.001 ETH from funding account...`);
      console.log(`Funding account address: ${fundingAccount.address}`);

      // Check funding account balance first
      const fundingBalance = await publicClient.getBalance({
        address: fundingAccount.address,
      });
      console.log(`Funding account balance: ${fundingBalance} wei`);

      if (fundingBalance < parseEther('0.002')) {
        throw new Error(`Insufficient balance in funding account. Need at least 0.002 ETH, have ${Number(fundingBalance) / 10**18} ETH`);
      }

      const txHash = await fundingClient.sendTransaction({
        to: accountAddress as `0x${string}`,
        value: parseEther('0.001'),
      });

      console.log('Funding transaction sent! Hash:', txHash);
      console.log('Waiting for funding confirmation...');
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log('Smart account funded successfully!');

      setIsAccountFunded(true);
      
      // Update localStorage
      const savedAccount = localStorage.getItem("rhinestone-account");
      if (savedAccount) {
        const accountData = JSON.parse(savedAccount);
        accountData.funded = true;
        localStorage.setItem("rhinestone-account", JSON.stringify(accountData));
      }

      console.log("Account funded successfully");
      
    } catch (error) {
      console.error("Error funding account:", error);
      setError(`Failed to fund account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFundAccountLoading(false);
    }
  }, [accountAddress]);

  const handleTransfer = useCallback(async () => {
    setError(null);
    if (!rhinestoneAccount) {
      setError("No Rhinestone account available");
      return;
    }

    if (!targetAddress || !amount) {
      setError("Please enter a target address and amount");
      return;
    } else if (!isAddress(targetAddress, { strict: false })) {
      setError("Invalid target address");
      return;
    } else if (Number(amount) > usdcBalance) {
      setError("Insufficient balance");
      return;
    } else if (Number(amount) > 10) {
      setError("Amount must be less than 10 USDC");
      return;
    } else if (ethBalance < 0.0001) {
      setError("Insufficient ETH for gas fees. Please fund the account first.");
      return;
    }

    setTransferLoading(true);

    try {
      console.log("Starting cross-chain transfer...");
      
      // Get the target chain
      const targetChain = targetChains.find(
        (chain) => chain.id === selectedNetwork,
      );
      
      if (!targetChain) {
        throw new Error("Invalid target chain");
      }

      console.log("Target chain:", targetChain.name);
      console.log("Transfer amount:", amount, "USDC");
      console.log("Recipient:", targetAddress);

      // Get USDC address on target chain - exactly as in docs
      const usdcTarget = getTokenAddress('USDC', targetChain.id);
      const usdcAmount = BigInt(Number(amount) * 10 ** 6);

      console.log("USDC target address:", usdcTarget);
      console.log("USDC amount (wei):", usdcAmount.toString());

      // Send the cross-chain transaction - exactly as in docs
      console.log("Sending cross-chain transaction...");
      const transaction = await rhinestoneAccount.sendTransaction({
        sourceChain,
        targetChain,
        calls: [
          {
            to: usdcTarget,
            value: 0n,
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'transfer',
              args: [targetAddress, usdcAmount],
            }),
          },
        ],
        tokenRequests: [
          {
            address: usdcTarget,
            amount: usdcAmount,
          },
        ],
      });

      console.log('Transaction sent:', transaction);

      // Extract and display bundle ID
      console.log('Full transaction object:', transaction);
      if (transaction && typeof transaction === 'object') {
        // Try different possible properties for bundle ID
        const bundleIdValue = (transaction as any).bundleId || (transaction as any).id || (transaction as any).bundle_id;
        if (bundleIdValue) {
          setBundleId(bundleIdValue);
          console.log('Bundle ID found:', bundleIdValue);
        } else {
          console.log('No bundle ID found in transaction object');
        }
      }

      // Stop loading spinner once bundle is sent
      setTransferLoading(false);
      console.log("Bundle sent successfully!");

      setAmount("");
      setTargetAddress("");
      
      // Wait for execution in background (don't block UI)
      rhinestoneAccount.waitForExecution(transaction).then((transactionResult: any) => {
        console.log('Transaction result:', transactionResult);
        console.log("Cross-chain transfer completed successfully!");
        
        // Update balance after execution completes
      setTimeout(() => {
        getBalance();
      }, 2000);
      }).catch((error: any) => {
        console.error("Error waiting for execution:", error);
      });

          } catch (error) {
      console.error("Error in cross-chain transfer:", error);
      setError(`Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    setTransferLoading(false);
    }
  }, [
    rhinestoneAccount,
    amount,
    targetAddress,
    usdcBalance,
    ethBalance,
    selectedNetwork,
  ]);

  // Gelato Functions
  const handleSponsoredTransaction = useCallback(async () => {
    if (!baseSepoliaPublicClient) {
      console.error("No public client");
      return;
    }

    // Clear all previous transaction data to start fresh
    setLastTxHash("");
    setGelatoTxHash("");
    setGelatoTaskId("");
    setGelatoErc20TaskId("");
    setGelatoLatency(null);
    setGelatoStartTime(null);
    setGelatoGasUsed(null);
    setSponsoredLoading(true);

          try {
            // Validate required environment variables
            const sponsorApiKey = process.env.NEXT_PUBLIC_SPONSOR_API_KEY;
            if (!sponsorApiKey) {
              throw new Error('NEXT_PUBLIC_SPONSOR_API_KEY environment variable is required');
            }

            const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
            if (!EOA_PK) {
              throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
            }
            const owner = privateKeyToAccount(EOA_PK);

            // Define the function we want to call (increment counter)
            const incrementAbi = [
              {
                name: "increment",
                type: "function",
                stateMutability: "nonpayable",
                inputs: [],
                outputs: [],
              },
            ] as const;

            const incrementData = encodeFunctionData({
              abi: incrementAbi,
              functionName: "increment",
            });

            // Create Gelato smart account
            const account = await gelato({
              owner,
              client: baseSepoliaPublicClient,
            });

            const client = createWalletClient({
              account,
              chain: baseSepolia,
              transport: http(),
            });

            console.log("Creating Gelato smart wallet client...");
            const swc = await createGelatoSmartWalletClient(client, {
              apiKey: sponsorApiKey,
            });

            console.log("Preparing Gelato transaction...");
            // Prepare the transaction with sponsored payment (gas paid by Gelato)
            const preparedCalls = await swc.prepare({
              payment: sponsored(sponsorApiKey),
              calls: [
                {
                  to: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as `0x${string}`,
                  data: incrementData,
                  value: 0n,
                },
              ],
            });

            console.log("Sending Gelato transaction...");
            const response = await swc.send({
              preparedCalls,
            });

            setGelatoTaskId(response.id);

            // Start timing AFTER transaction is submitted to network
            const startTime = Date.now();
            setGelatoStartTime(startTime);
            let gelatoLocalStartTime = startTime;
            console.log('Starting Gelato sponsored transaction timing (after network submission)...');

            // Return a promise that resolves when transaction completes
            return new Promise((resolve, reject) => {
              response.on("success", (status: GelatoTaskStatus) => {
                // Calculate latency from submission to completion
                const endTime = Date.now();
                const latency = endTime - gelatoLocalStartTime;
                setGelatoLatency(latency);
                console.log(`Gelato transaction latency: ${(latency / 1000).toFixed(2)}s`);
                
                console.log("Gelato transaction successful:", status);
                if (status.transactionHash) {
                  setGelatoTxHash(status.transactionHash);
                  
                  // Fetch gas used from transaction receipt with retry mechanism
                  // This is needed because transaction receipt might not be immediately available
                  (async () => {
                    let retries = 0;
                    const maxRetries = 10;
                    const retryDelay = 2000; // 2 seconds
                    
                    while (retries < maxRetries) {
                      try {
                        console.log(`Attempting to get Gelato gas used (attempt ${retries + 1}/${maxRetries})...`);
                        const txReceipt = await baseSepoliaPublicClient.getTransactionReceipt({ 
                          hash: status.transactionHash as `0x${string}` 
                        });
                        console.log('Full transaction receipt:', txReceipt);
                        const gasUsed = txReceipt.gasUsed.toString();
                        setGelatoGasUsed(gasUsed);
                        console.log(`Gelato gas used: ${gasUsed}`);
                        break;
                      } catch (error) {
                        retries++;
                        if (retries >= maxRetries) {
                          console.error('Failed to get Gelato gas used after all retries:', error);
                          break;
                        }
                        console.log(`Transaction receipt not ready yet, retrying in ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                      }
                    }
                  })();
                }
          setSponsoredLoading(false);
                resolve({ success: true, provider: 'Gelato', hash: status.transactionHash });
              });
              response.on("error", (error: Error) => {
                console.error("Gelato transaction failed:", error);
          setSponsoredLoading(false);
                reject({ success: false, provider: 'Gelato', error });
              });
            });
          } catch (error) {
            console.error("Gelato sponsored transaction failed:", error);
            console.error("Error details:", {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              sponsorApiKey: process.env.NEXT_PUBLIC_SPONSOR_API_KEY ? 'Present' : 'Missing',
              EOA_PK: process.env.NEXT_PUBLIC_EOA_PK ? 'Present' : 'Missing'
            });
      setSponsoredLoading(false);
    }
  }, [baseSepoliaPublicClient]);

  const handleErc20Transaction = useCallback(async () => {
    if (!baseSepoliaPublicClient) {
      console.error("No public client");
      return;
    }

    // Clear all previous transaction data to start fresh
    setLastTxHash("");
    setGelatoTxHash("");
    setGelatoTaskId("");
    setGelatoErc20TaskId("");
    setGelatoLatency(null);
    setGelatoStartTime(null);
    setGelatoGasUsed(null);
    setErc20Loading(true);

          try {
            const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
            if (!EOA_PK) {
              throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
            }
            const owner = privateKeyToAccount(EOA_PK);

            // Define the function to call
            const incrementAbi = [{
              name: "increment",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [],
              outputs: []
            }] as const;

            const incrementData = encodeFunctionData({
              abi: incrementAbi,
              functionName: "increment"
            });

            // Create Gelato smart account
            const account = await gelato({
              owner,
              client: baseSepoliaPublicClient,
            });

            const client = createWalletClient({
              account,
              chain: baseSepolia,
              transport: http(),
            });

            const swc = await createGelatoSmartWalletClient(client);

            // USDC token address on Base Sepolia for gas payment
            const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

            // Execute transaction using ERC20 tokens for gas payment
            const response = await swc.execute({
              payment: erc20(usdcAddress), // Use USDC to pay for gas
              calls: [
                {
                  to: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as `0x${string}`,
                  data: incrementData,
                  value: 0n,
                },
              ],
            });

            setGelatoErc20TaskId(response.id);

            // Start timing AFTER transaction is submitted to network
            const startTime = Date.now();
            setGelatoStartTime(startTime);
            let gelatoLocalStartTime = startTime;
            console.log('Starting Gelato ERC20 transaction timing (after network submission)...');

            // Return promise that resolves when transaction completes
            return new Promise((resolve, reject) => {
              response.on("success", (status: GelatoTaskStatus) => {
                // Calculate latency from submission to completion
                const endTime = Date.now();
                const latency = endTime - gelatoLocalStartTime;
                setGelatoLatency(latency);
                console.log(`Gelato ERC20 transaction latency: ${(latency / 1000).toFixed(2)}s`);
                
                console.log(`Gelato ERC20 Transaction successful: https://sepolia.basescan.org/tx/${status.transactionHash}`);
                if (status.transactionHash) {
                  setGelatoTxHash(status.transactionHash);
                  
                  // Fetch gas used with retry mechanism
                  (async () => {
                    let retries = 0;
                    const maxRetries = 10;
                    const retryDelay = 2000; // 2 seconds
                    
                    while (retries < maxRetries) {
                      try {
                        console.log(`Attempting to get Gelato ERC20 gas used (attempt ${retries + 1}/${maxRetries})...`);
                        const txReceipt = await baseSepoliaPublicClient.getTransactionReceipt({ 
                          hash: status.transactionHash as `0x${string}` 
                        });
                        console.log('Full transaction receipt:', txReceipt);
                        const gasUsed = txReceipt.gasUsed.toString();
                        setGelatoGasUsed(gasUsed);
                        console.log(`Gelato ERC20 gas used: ${gasUsed}`);
                        break;
                      } catch (error) {
                        retries++;
                        if (retries >= maxRetries) {
                          console.error('Failed to get Gelato ERC20 gas used after all retries:', error);
                          break;
                        }
                        console.log(`Transaction receipt not ready yet, retrying in ${retryDelay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                      }
                    }
                  })();
                }
          setErc20Loading(false);
                resolve({ success: true, provider: 'Gelato', hash: status.transactionHash });
              });
              response.on("error", (error: Error) => {
                console.error(`Gelato ERC20 Transaction failed: ${error.message}`);
          setErc20Loading(false);
                reject({ success: false, provider: 'Gelato', error });
              });
            });
          } catch (error) {
            console.error("Gelato ERC20 transaction failed:", error);
      setErc20Loading(false);
    }
  }, [baseSepoliaPublicClient]);

  // Static Gelato addresses for display purposes
  const gelatoOwner = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";
  const gelatoSmartWallet = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";

  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center">
      <div className="flex flex-col lg:flex-row max-w-6xl w-full">
        {/* RHINESTONE SECTION - Left Side */}
        <div className="flex-1 flex flex-col gap-8 pr-4 h-96">
          <div className="flex flex-row items-center align-center">
            <Image
              className="dark:invert"
              src="/rhinestone.svg"
              alt="Rhinestone logo"
              width={180}
              height={38}
              priority
            />{" "}
            <span className="text-lg font-bold">x Omni Account Transfers</span>
          </div>
          
          {/* Workflow Steps */}
          <div className="text-sm -mt-5">
            <h3 className="font-bold mb-2">Workflow Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li className="text-gray-400">
                Create Rhinestone Omni Account
              </li>
              <li className="text-gray-400">
                Fund account with ETH (0.001 ETH recommended)
              </li>
              <li className="text-gray-400">
                Fund account with USDC on Base Sepolia testnet
              </li>
              <li className="text-gray-400">
                Execute cross-chain transfer to any supported testnet
              </li>
            </ol>
          </div>
          
          <div className="font-[family-name:var(--font-geist-mono)] text-sm flex-1 break-words mt-2">
            <div>
              {accountAddress && (
                <div className="mt-4 mb-0">
                  <div>Smart Account Address: <span className="break-all">{accountAddress}</span></div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {accountAddress && (
                <>
                  <span>Balance on Base Sepolia: {usdcBalance} USDC</span>
                  <span>| ETH: {ethBalance.toFixed(6)} ETH</span>
                  {isAccountFunded && (
                    <button
                      onClick={refreshBalance}
                      className="text-blue-500 hover:text-blue-700 text-xs underline"
                    >
                      Refresh
                    </button>
                  )}
                </>
              )}
            </div>
            <div>
              {isAccountFunded && (
                <div className="text-gray-600">
                  ✅ Account funded on Base Sepolia
                  <div className="text-xs text-gray-500 mt-1">
                    You can now send USDC to this address
                  </div>
                  </div>
              )}
              {bundleId && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500">Bundle ID:</div>
                  <div className="text-xs break-all text-blue-600">{bundleId}</div>
                </div>
              )}
            </div>
            </div>
            
          <div className="flex gap-4 justify-center items-center flex-col sm:flex-row">
            <select
              id="network-select"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(Number(e.target.value))}
              className="block w-full px-4 py-1 bg-white text-black border border-gray-300 rounded-2xl"
            >
              {targetChains.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>

            <input
              className="bg-white rounded-2xl text-black px-4 py-1"
              placeholder="Target address"
              onChange={(e) => setTargetAddress(e.target.value)}
              value={targetAddress}
              id="targetAddress"
            />
            <input
              className="bg-white rounded-2xl text-black px-4 py-1"
              placeholder="Amount in USDC"
              onChange={(e) => setAmount(e.target.value)}
              value={amount}
              type="number"
              id="amount"
            />
              </div>

          <div className="flex gap-4 items-center flex-col sm:flex-row">
            <Button
              buttonText="Create Account"
              onClick={handleCreateAccount}
              disabled={false}
              isLoading={createAccountLoading}
            />
            <Button
              buttonText="Fund Account"
              disabled={!rhinestoneAccount || isAccountFunded}
              onClick={handleFundAccount}
              isLoading={fundAccountLoading}
            />

            <Button
              buttonText="Send Transfer"
              disabled={!isAccountFunded}
              onClick={handleTransfer}
              isLoading={transferLoading}
            />
                  </div>
          {error && (
            <div className="flex justify-center text-red-500 text-center w-full items-center">
              {error}
                  </div>
                )}
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-4 flex-shrink-0 self-stretch"></div>

        {/* GELATO SECTION - Right Side */}
        <div className="flex-1 flex flex-col gap-8 pl-4 h-96">
          <div className="flex flex-row items-center align-center">
            <Image
              src="/gelato.svg"
              alt="Gelato logo"
              width={38}
              height={38}
              priority
            />
            <span className="text-2xl font-bold ml-2">Gelato Smart Wallet SDK</span>
          </div>
          
          {/* Workflow Steps */}
          <div className="text-sm -mt-4">
            <h3 className="font-bold mb-2">Workflow Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li className="text-gray-400">
                Create smart account (automatic)
              </li>
              <li className="text-gray-400">
                Choose gas payment method:
              </li>
              <li className="text-gray-400 ml-4">
                • Sponsored: Gas paid by Gelato
              </li>
              <li className="text-gray-400 ml-4">
                • ERC-20: Pay gas with USDC tokens (Base Sepolia testnet)
              </li>
              <li className="text-gray-400">
                Execute transaction and monitor status
              </li>
            </ol>
          </div>
          
          <div className="text-sm mt-3">
            {/* Gelato Account Information */}
            <div className="font-[family-name:var(--font-geist-mono)] text-sm break-words mb-2">
              <div>Owner: <span className="break-all">{gelatoOwner}</span></div>
              <div>Smart Wallet: <span className="break-all">{gelatoSmartWallet}</span></div>
            </div>
            
            {/* Gelato Task ID Display for Sponsored Transactions */}
            {gelatoTaskId && (
              <div className="mt-4">
                <div><strong>Gelato Task ID:</strong> {gelatoTaskId}</div>
                <div>
                  <a 
                    href={`https://api.gelato.digital/tasks/status/${gelatoTaskId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Check Status
                  </a>
                </div>
              </div>
            )}
            
            {/* Gelato Task ID Display for ERC20 Transactions */}
            {gelatoErc20TaskId && (
              <div className="mt-4">
                <div><strong>Gelato ERC20 Task ID:</strong> {gelatoErc20TaskId}</div>
                <div>
                  <a 
                    href={`https://api.gelato.digital/tasks/status/${gelatoErc20TaskId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Check Status
                  </a>
                </div>
              </div>
            )}
            
            {/* Gelato Transaction Results Display */}
            {gelatoTxHash && (
              <div className="mt-4">
                <div><strong>Gelato TX Hash:</strong></div>
                <div><a 
                  href={`https://sepolia.basescan.org/tx/${gelatoTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {gelatoTxHash}
                </a></div>
                {/* Display latency in seconds */}
                {gelatoLatency && (
                  <div className="mt-2">
                    <strong>Latency:</strong> {(gelatoLatency / 1000).toFixed(2)}s
                  </div>
                )}
                {/* Display gas usage */}
                {gelatoGasUsed && (
                  <div className="mt-2">
                    <strong>Gas Used:</strong> {gelatoGasUsed}
                  </div>
                )}
              </div>
            )}
            
            {/* Display previous transaction hash if available */}
            {lastTxHash && (
              <div className="mt-4">
                <div><strong>Transaction Hash:</strong> <a 
                  href={`https://sepolia.basescan.org/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {lastTxHash}
                </a></div>
              </div>
            )}
          </div>
          
          {/* TRANSACTION BUTTONS - Moved to Gelato section */}
          <div className="flex gap-4 items-center flex-col sm:flex-row mt-14 mb-14">
            {/* Sponsored Transaction Button */}
            <Button
                  buttonText="Basic sponsored transactions"
                  onClick={handleSponsoredTransaction}
                  isLoading={sponsoredLoading}
            />
              {/* ERC20 Transaction Button */}
            <Button
                  buttonText="ERC-20 gas payments"
                  onClick={handleErc20Transaction}
                  isLoading={erc20Loading}
                />
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}