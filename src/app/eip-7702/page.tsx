"use client";
import { Button } from "@/components/Button";
import { getIncrementCalldata } from "@/components/Counter";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  toSafeSmartAccount,
  ToSafeSmartAccountReturnType,
} from "permissionless/accounts";
import {
  Account,
  Address,
  Chain,
  createPublicClient,
  encodeFunctionData,
  Hex,
  http,
  parseAbi,
  toBytes,
  toHex,
  Transport,
  zeroAddress,
} from "viem";
import { signAuthorization } from "viem/actions";
import { Erc7579Actions } from "permissionless/actions/erc7579";
import { createSmartAccountClient, SmartAccountClient } from "permissionless";
import {
  entryPoint07Address,
  getUserOperationHash,
} from "viem/account-abstraction";
import {
  RHINESTONE_ATTESTER_ADDRESS,
  MOCK_ATTESTER_ADDRESS,
  encodeValidatorNonce,
  getAccount,
  Session,
  OWNABLE_VALIDATOR_ADDRESS,
  encodeValidationData,
  getSudoPolicy,
  getSmartSessionsValidator,
  encodeSmartSessionSignature,
  getOwnableValidatorMockSignature,
  SmartSessionMode,
  getPermissionId,
  SMART_SESSIONS_ADDRESS,
} from "@rhinestone/module-sdk";
import { sepolia, baseSepolia } from "viem/chains";
import { getAccountNonce } from "permissionless/actions";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { Footer } from "@/components/Footer";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeContract } from "viem/actions";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createRhinestoneAccount } from '@rhinestone/sdk';
import { createWalletClient, parseEther } from 'viem';
import {
  createGelatoSmartWalletClient,
  type GelatoTaskStatus,
  sponsored,
  erc20,
} from "@gelatonetwork/smartwallet";
import { gelato } from "@gelatonetwork/smartwallet/accounts";

const appId = "smart-sessions-7702";

// Session configuration for Rhinestone - defines permissions and policies
const sessionOwner = privateKeyToAccount(
  process.env.NEXT_PUBLIC_SESSION_OWNER_PK! as Hex,
);

const session: Session = {
  sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
  sessionValidatorInitData: encodeValidationData({
    threshold: 1,
    owners: [sessionOwner.address],
  }),
  salt: toHex(toBytes("0", { size: 32 })),
  userOpPolicies: [getSudoPolicy()],
  erc7739Policies: {
    allowedERC7739Content: [],
    erc1271Policies: [],
  },
  actions: [
    {
      actionTarget: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as Address,
      actionTargetSelector: "0xd09de08a" as Hex,
      actionPolicies: [getSudoPolicy()],
    },
  ],
  chainId: BigInt(sepolia.id),
  permitERC4337Paymaster: true,
};

export default function Home() {
  // Create public clients for both networks to interact with blockchain
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const baseSepoliaPublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // State management for accounts and smart account client
  const [account, setAccount] = useState<Account>();
  const [safeOwner, setSafeOwner] = useState<Account>();

  const [smartAccountClient, setSmartAccountClient] = useState<
    SmartAccountClient<Transport, Chain, ToSafeSmartAccountReturnType<"0.7">> &
      Erc7579Actions<ToSafeSmartAccountReturnType<"0.7">>
  >();
  const [accountIsDelegated, setAccountIsDelegated] = useState(false);

  // Loading states for transaction operations
  const [combinedSponsoredLoading, setCombinedSponsoredLoading] = useState(false);
  const [combinedErc20Loading, setCombinedErc20Loading] = useState(false);
  
  // Transaction tracking state
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [lastTxChain, setLastTxChain] = useState<string>("sepolia");
  const [rhinestoneTxHash, setRhinestoneTxHash] = useState<string>("");
  const [gelatoTxHash, setGelatoTxHash] = useState<string>("");
  const [userOpReceipt, setUserOpReceipt] = useState<unknown>(null);
  const [gelatoTaskId, setGelatoTaskId] = useState<string>("");
  const [gelatoErc20TaskId, setGelatoErc20TaskId] = useState<string>("");
  
  // EOA funding status: tracks whether the smart account has been funded with ETH
  const [eoaFunded, setEoaFunded] = useState<"idle" | "no" | "yes">("no");
  
  // Latency tracking state - measures transaction confirmation time
  const [rhinestoneLatency, setRhinestoneLatency] = useState<number | null>(null);
  const [gelatoLatency, setGelatoLatency] = useState<number | null>(null);
  const [rhinestoneStartTime, setRhinestoneStartTime] = useState<number | null>(null);
  const [gelatoStartTime, setGelatoStartTime] = useState<number | null>(null);

  // Gas usage tracking state - measures how much gas each transaction consumes
  const [rhinestoneGasUsed, setRhinestoneGasUsed] = useState<string | null>(null);
  const [gelatoGasUsed, setGelatoGasUsed] = useState<string | null>(null);

  // Load saved accounts from localStorage on component mount
  useEffect(() => {
    const localAccount = localStorage.getItem("7702-account") || "";
    if (localAccount) {
      setAccount(privateKeyToAccount(localAccount as Hex));
    }

    const localOwner = localStorage.getItem("7702-owner") || "";
    if (localOwner) {
      setSafeOwner(privateKeyToAccount(localOwner as Hex));
    }
  }, []);

  /**
   * Handles sponsored transactions for both Rhinestone (Safe + Pimlico) and Gelato in parallel
   * This function compares transaction latency and gas usage between the two approaches
   * Rhinestone uses Safe smart account with Pimlico paymaster, Gelato uses its own SDK
   */
  const handleCombinedSponsoredTransaction = useCallback(async () => {
    setEoaFunded("idle");
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear all previous transaction data to start fresh
    setLastTxHash("");
    setLastTxChain("sepolia");
    setRhinestoneTxHash("");
    setGelatoTxHash("");
    setGelatoTaskId("");
    setGelatoErc20TaskId("");
    setRhinestoneLatency(null);
    setGelatoLatency(null);
    setRhinestoneStartTime(null);
    setGelatoStartTime(null);
    setRhinestoneGasUsed(null);
    setGelatoGasUsed(null);
    setCombinedSponsoredLoading(true);

    try {
      // Execute both transactions simultaneously using Promise.allSettled
      // This allows us to compare performance between Rhinestone (Safe + Pimlico) and Gelato
      const [rhinestoneResult, gelatoResult] = await Promise.allSettled([
        // RHINESTONE SPONSORED TRANSACTION (Safe + Pimlico)
        (async () => {
          try {
            if (!smartAccountClient) {
              throw new Error("No smart account client available");
            }

            // Get nonce for the smart account
            const nonce = await getAccountNonce(publicClient, {
              address: smartAccountClient.account.address,
              entryPointAddress: entryPoint07Address,
              key: encodeValidatorNonce({
                account: getAccount({
                  address: smartAccountClient.account.address,
                  type: "safe",
                }),
                validator: SMART_SESSIONS_ADDRESS,
              }),
            });

            // Prepare session details for authorization
            const sessionDetails = {
              mode: SmartSessionMode.USE,
              permissionId: getPermissionId({ session }),
              signature: getOwnableValidatorMockSignature({
                threshold: 1,
              }),
            };

            // Prepare user operation with increment call
            const userOperation = await smartAccountClient.prepareUserOperation({
              account: smartAccountClient.account,
              calls: [getIncrementCalldata()],
              nonce,
              signature: encodeSmartSessionSignature(sessionDetails),
            });

            // Get user operation hash to sign
            const userOpHashToSign = getUserOperationHash({
              chainId: sepolia.id,
              entryPointAddress: entryPoint07Address,
              entryPointVersion: "0.7",
              userOperation,
            });

            // Sign the user operation with session owner
            sessionDetails.signature = await sessionOwner.signMessage({
              message: { raw: userOpHashToSign },
            });

            userOperation.signature = encodeSmartSessionSignature(sessionDetails);

            // Start timing AFTER user operation is prepared and signed
            const startTime = Date.now();
            setRhinestoneStartTime(startTime);
            console.log('Starting Rhinestone sponsored transaction timing (after preparation)...');

            // Send user operation (Pimlico will pay for gas)
            const userOpHash = await smartAccountClient.sendUserOperation(userOperation);

            // Wait for user operation receipt
            const receipt = await smartAccountClient.waitForUserOperationReceipt({
              hash: userOpHash,
            });

            // Calculate latency from submission to confirmation
            const endTime = Date.now();
            const latency = endTime - startTime;
            setRhinestoneLatency(latency);
            console.log(`Rhinestone transaction latency: ${(latency / 1000).toFixed(2)}s`);

            // Extract transaction hash and gas usage from receipt
            let txHash: string | undefined;
            let gasUsed: string | undefined;

            if (receipt && typeof receipt === 'object' && receipt !== null) {
              const receiptObj = receipt as { 
                receipt?: { transactionHash?: string; gasUsed?: bigint };
                userOpHash?: string;
              };
              
              // Get transaction hash from receipt
              txHash = receiptObj.receipt?.transactionHash;
              
              if (txHash) {
                setRhinestoneTxHash(txHash);
              }

              // Get gas used from transaction receipt
              if (txHash) {
                try {
                  const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                  gasUsed = txReceipt.gasUsed.toString();
                  setRhinestoneGasUsed(gasUsed);
                  console.log(`Rhinestone gas used: ${gasUsed}`);
                } catch (error) {
                  console.error('Error getting Rhinestone gas used:', error);
                }
              }
            }

            return { success: true, provider: 'Rhinestone', hash: txHash || 'unknown' };
          } catch (error) {
            console.error("Rhinestone sponsored transaction failed:", error);
            return { success: false, provider: 'Rhinestone', error };
          }
        })(),

        // GELATO SPONSORED TRANSACTION
        (async () => {
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

            // Create Base Sepolia public client for Gelato transactions
            const baseSepoliaPublicClient = createPublicClient({
              chain: baseSepolia,
              transport: http(),
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
                resolve({ success: true, provider: 'Gelato', hash: status.transactionHash });
              });
              response.on("error", (error: Error) => {
                console.error("Gelato transaction failed:", error);
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
            return { success: false, provider: 'Gelato', error };
          }
        })()
      ]);

      console.log("Combined sponsored transaction results:");
      console.log("Rhinestone:", rhinestoneResult);
      console.log("Gelato:", gelatoResult);

    } catch (error) {
      console.error("Error in combined sponsored transaction:", error);
    }

    setCombinedSponsoredLoading(false);
  }, [publicClient, smartAccountClient]);

  /**
   * Handles ERC20 transactions for both Rhinestone and Gelato in parallel
   * This function compares transaction latency and gas usage when using ERC20 tokens for gas payment
   * Rhinestone requires funding the smart account first, Gelato uses ERC20 tokens directly
   */
  const handleCombinedErc20Transaction = useCallback(async () => {
    setEoaFunded("idle");
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear all previous transaction data to start fresh
    setLastTxHash("");
    setLastTxChain("sepolia");
    setRhinestoneTxHash("");
    setGelatoTxHash("");
    setGelatoTaskId("");
    setGelatoErc20TaskId("");
    setRhinestoneLatency(null);
    setGelatoLatency(null);
    setRhinestoneStartTime(null);
    setGelatoStartTime(null);
    setRhinestoneGasUsed(null);
    setGelatoGasUsed(null);
    setCombinedErc20Loading(true);

    try {
      // Execute both ERC20 transactions simultaneously
      const [rhinestoneResult, gelatoResult] = await Promise.allSettled([
        // RHINESTONE ERC20 TRANSACTION
        (async () => {
          try {
            const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
            if (!rhinestoneApiKey) {
              throw new Error('NEXT_PUBLIC_RHINESTONE_API_KEY environment variable is required');
            }

            const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
            if (!EOA_PK) {
              throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
            }
            const account = privateKeyToAccount(EOA_PK);

            // Create Rhinestone smart account
            const rhinestoneAccount = await createRhinestoneAccount({
              owners: {
                type: 'ecdsa',
                accounts: [account],
              },
              rhinestoneApiKey,
            });
            
            const address = await rhinestoneAccount.getAddress();
            console.log(`Smart account address: ${address}`);

            // FUNDING STEP: Send ETH from EOA to smart account to pay for gas
            // This is required for Rhinestone ERC20 transactions
            console.log(`Funding smart account (${address}) with 0.01 ETH from your EOA (${account.address})...`);

            const walletClient = createWalletClient({
              account: account,
              chain: sepolia,
              transport: http(),
            });

            const hash = await walletClient.sendTransaction({
              to: address,
              value: parseEther('0.01'),
            });
            console.log('Transaction sent! Hash:', hash);

            console.log('Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            console.log('Smart account funded! Receipt:', receipt);
            setEoaFunded("yes");

            // Now send the actual ERC20 transaction using the funded smart account
            const result = await rhinestoneAccount.sendTransaction({
              chain: sepolia,
              calls: [],     // Empty calls = noop transaction
              tokenRequests: [], // Noop transaction
            });

            // Start timing AFTER transaction has been sent (excluding funding time)
            const startTime = Date.now();
            setRhinestoneStartTime(startTime);
            console.log('Starting Rhinestone ERC20 transaction timing (after submission)...');

            const receipt2 = await rhinestoneAccount.waitForExecution(result, false);
            
            // Calculate latency from submission to confirmation
            const endTime = Date.now();
            const latency = endTime - startTime;
            setRhinestoneLatency(latency);
            console.log(`Rhinestone ERC20 transaction latency (excluding funding): ${(latency / 1000).toFixed(2)}s`);
            
            // Extract transaction hash and gas usage
            let txHash: string | undefined;
            let gasUsed: string | undefined;
            if (receipt2 && typeof receipt2 === 'object' && receipt2 !== null) {
              const receipt = receipt2 as { 
                fillTransactionHash?: string; 
                claims?: Array<{ claimTransactionHash?: string }>;
                gasUsed?: bigint;
              };
              
              txHash = receipt.fillTransactionHash || 
                (receipt.claims && receipt.claims[0]?.claimTransactionHash);
              
              if (txHash) {
                setRhinestoneTxHash(txHash);
              }

              // Fetch gas used from transaction receipt
              if (txHash) {
                try {
                  const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
                  gasUsed = txReceipt.gasUsed.toString();
                  setRhinestoneGasUsed(gasUsed);
                  console.log(`Rhinestone ERC20 gas used: ${gasUsed}`);
                } catch (error) {
                  console.error('Error getting Rhinestone ERC20 gas used:', error);
                }
              }
            }

            return { success: true, provider: 'Rhinestone', hash: txHash || 'unknown' };
          } catch (error) {
            console.error("Rhinestone ERC20 transaction failed:", error);
            return { success: false, provider: 'Rhinestone', error };
          }
        })(),

        // GELATO ERC20 TRANSACTION
        (async () => {
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

            // Create Base Sepolia public client
            const baseSepoliaPublicClient = createPublicClient({
              chain: baseSepolia,
              transport: http(),
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
                resolve({ success: true, provider: 'Gelato', hash: status.transactionHash });
              });
              response.on("error", (error: Error) => {
                console.error(`Gelato ERC20 Transaction failed: ${error.message}`);
                reject({ success: false, provider: 'Gelato', error });
              });
            });
          } catch (error) {
            console.error("Gelato ERC20 transaction failed:", error);
            return { success: false, provider: 'Gelato', error };
          }
        })()
      ]);

      console.log("Combined ERC20 transaction results:");
      console.log("Rhinestone:", rhinestoneResult);
      console.log("Gelato:", gelatoResult);

    } catch (error) {
      console.error("Error in combined ERC20 transaction:", error);
    }

    setCombinedErc20Loading(false);
  }, [publicClient]);

  // Check if account is delegated (has smart contract code)
  const getDelegationState = useCallback(async () => {
    if (!account) {
      return;
    } else if (!publicClient) {
      return;
    }

    if (
      await publicClient?.getCode({
        address: account.address,
      })
    ) {
      setAccountIsDelegated(true);
    } else {
      setAccountIsDelegated(false);
    }
  }, [account, publicClient]);

  // Create smart account client for Safe account operations with Pimlico paymaster
  const getSmartAccountClient = useCallback(async () => {
    if (!account) {
      return;
    } else if (!safeOwner) {
      return;
    } else if (!publicClient) {
      return;
    }

    const safeAccount = await toSafeSmartAccount({
      address: account.address,
      client: publicClient,
      owners: [safeOwner],
      version: "1.4.1",
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
      safe4337ModuleAddress: "0x7579EE8307284F293B1927136486880611F20002",
      erc7579LaunchpadAddress: "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
    });

    const pimlicoSepoliaUrl = `https://api.pimlico.io/v2/${sepolia.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;

    const pimlicoClient = createPimlicoClient({
      transport: http(pimlicoSepoliaUrl),
      entryPoint: {
        address: entryPoint07Address,
        version: "0.7",
      },
    });

    const _smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      paymaster: pimlicoClient,  // Pimlico pays for gas in sponsored transactions
      chain: sepolia,
      userOperation: {
        estimateFeesPerGas: async () =>
          (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
      bundlerTransport: http(pimlicoSepoliaUrl),
    }).extend(erc7579Actions());

    setSmartAccountClient(_smartAccountClient as any); // eslint-disable-line
  }, [account, publicClient, safeOwner]);

  // Initialize account state when component mounts
  useEffect(() => {
    const fetchInitialAccountState = async () => {
      if (!account || !publicClient) {
        return;
      }

      if (
        !smartAccountClient ||
        smartAccountClient.account.address !== account.address
      ) {
        getDelegationState();
        getSmartAccountClient();
      }
    };

    fetchInitialAccountState();
  }, [
    account,
    publicClient,
    smartAccountClient,
    getDelegationState,
    getSmartAccountClient,
  ]);

  // Static Gelato addresses for display purposes
  const gelatoOwner = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";
  const gelatoSmartWallet = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";

  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center">
      <div className="flex flex-col lg:flex-row max-w-6xl w-full">
        {/* RHINESTONE SECTION - Left Side */}
        <div className="flex-1 flex flex-col gap-8 pr-8 h-96">
          <div className="flex flex-row items-center align-center">
            <Image
              className="dark:invert"
              src="/rhinestone.svg"
              alt="Rhinestone logo"
              width={180}
              height={38}
              priority
            />{" "}
            <span className="text-lg font-bold">x 7702</span>
          </div>
          <div className="font-[family-name:var(--font-geist-mono)] text-sm flex-1 break-words">
            <div>{account && <>Account: {account.address}</>}</div>
            <div>
              {sessionOwner && <>Session owner: {sessionOwner.address}</>}
            </div>
            <div>
              {account && <>Account {!accountIsDelegated && "not"} delegated</>}
            </div>
            
            {/* EOA Funding Status Display */}
            <div className="mt-4">
              <strong>EOA funded:</strong> {eoaFunded === "yes" ? "yes" : "no"}
            </div>
            
            {/* Display previous transaction hash if available */}
            {lastTxHash && lastTxChain === "sepolia" && (
              <div className="mt-4">
                <div>Transaction Hash: <a 
                  href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {lastTxHash}
                </a></div>
              </div>
            )}
            
            {/* Rhinestone Transaction Results Display */}
            {rhinestoneTxHash && (
              <div className="mt-4">
                <div><strong>Rhinestone TX Hash:</strong></div>
                <div><a 
                  href={`https://sepolia.etherscan.io/tx/${rhinestoneTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {rhinestoneTxHash}
                </a></div>
                {/* Display latency in seconds */}
                {rhinestoneLatency && (
                  <div className="mt-2">
                    <strong>Latency:</strong> {(rhinestoneLatency / 1000).toFixed(2)}s
                  </div>
                )}
                {/* Display gas usage */}
                {rhinestoneGasUsed && (
                  <div className="mt-2">
                    <strong>Gas Used:</strong> {rhinestoneGasUsed}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-4 flex-shrink-0 self-stretch"></div>

        {/* GELATO SECTION - Right Side */}
        <div className="flex-1 flex flex-col gap-8 pl-8 h-96">
          <div className="flex flex-row items-center align-center">
            <Image
              src="/gelato.svg"
              alt="Gelato logo"
              width={38}
              height={38}
              priority
            />
            <span className="text-2xl font-bold ml-2">Gelato Smart Wallet</span>
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
            {lastTxHash && lastTxChain === "base-sepolia" && (
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
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex gap-4 items-center flex-col sm:flex-row">
            </div>
          </div>
        </div>
      </div>
      
      {/* TRANSACTION BUTTONS - Bottom Center */}
      <div className="flex justify-center mt-8">
        <div className="flex gap-4 items-center flex-col sm:flex-row">
          {/* Sponsored Transaction Button - Compares Safe+Pimlico vs Gelato sponsored transactions */}
          <div className="w-64">
            <Button
              buttonText="Run Sponsored TXs (Parallel)"
              onClick={handleCombinedSponsoredTransaction}
              isLoading={combinedSponsoredLoading}
            />
          </div>
          {/* ERC20 Transaction Button - Compares ERC20 gas payment transactions */}
          <div className="w-64">
            <Button
              buttonText="Run ERC20 TXs (Parallel)"
              onClick={handleCombinedErc20Transaction}
              isLoading={combinedErc20Loading}
            />
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}