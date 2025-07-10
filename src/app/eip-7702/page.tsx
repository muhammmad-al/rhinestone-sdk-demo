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
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const [account, setAccount] = useState<Account>();
  const [safeOwner, setSafeOwner] = useState<Account>();

  const [smartAccountClient, setSmartAccountClient] = useState<
    SmartAccountClient<Transport, Chain, ToSafeSmartAccountReturnType<"0.7">> &
      Erc7579Actions<ToSafeSmartAccountReturnType<"0.7">>
  >();
  const [accountIsDelegated, setAccountIsDelegated] = useState(false);

  const [combinedSponsoredLoading, setCombinedSponsoredLoading] = useState(false);
  const [combinedErc20Loading, setCombinedErc20Loading] = useState(false);
  // Removed unused variable 'count' to fix ESLint error
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [lastTxChain, setLastTxChain] = useState<string>("sepolia");
  const [rhinestoneTxHash, setRhinestoneTxHash] = useState<string>("");
  const [gelatoTxHash, setGelatoTxHash] = useState<string>("");
  // Use 'unknown' instead of 'any' for userOpReceipt to satisfy ESLint
  const [userOpReceipt, setUserOpReceipt] = useState<unknown>(null);
  const [gelatoTaskId, setGelatoTaskId] = useState<string>("");
  const [gelatoErc20TaskId, setGelatoErc20TaskId] = useState<string>("");
  const [eoaFunded, setEoaFunded] = useState<"idle" | "no" | "yes">("idle");
  
  // Latency tracking state
  const [rhinestoneLatency, setRhinestoneLatency] = useState<number | null>(null);
  const [gelatoLatency, setGelatoLatency] = useState<number | null>(null);
  const [rhinestoneStartTime, setRhinestoneStartTime] = useState<number | null>(null);
  const [gelatoStartTime, setGelatoStartTime] = useState<number | null>(null);

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







  const handleCombinedSponsoredTransaction = useCallback(async () => {
    setEoaFunded("idle");
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear previous transaction info
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
    setCombinedSponsoredLoading(true);

    try {
      // Run both transactions in parallel
      const [rhinestoneResult, gelatoResult] = await Promise.allSettled([
                // Rhinestone sponsored transaction
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

            const rhinestoneAccount = await createRhinestoneAccount({
              owners: {
                type: 'ecdsa',
                accounts: [account],
              },
              rhinestoneApiKey,
            });

            const result = await rhinestoneAccount.sendTransaction({
              chain: sepolia,
              calls: [],     
              tokenRequests: [], // Noop transaction
            });

            // Start timing AFTER transaction has been sent
            const startTime = Date.now();
            setRhinestoneStartTime(startTime);
            console.log('Starting Rhinestone sponsored transaction timing (after submission)...');

            const receipt2 = await rhinestoneAccount.waitForExecution(result, false);
            
            const endTime = Date.now();
            const latency = endTime - startTime;
            setRhinestoneLatency(latency);
            console.log(`Rhinestone transaction latency: ${(latency / 1000).toFixed(2)}s`);
            
            let txHash: string | undefined;
            if (receipt2 && typeof receipt2 === 'object' && receipt2 !== null) {
              const receipt = receipt2 as { 
                fillTransactionHash?: string; 
                claims?: Array<{ claimTransactionHash?: string }>;
              };
              
              txHash = receipt.fillTransactionHash || 
                (receipt.claims && receipt.claims[0]?.claimTransactionHash);
              
              if (txHash) {
                setRhinestoneTxHash(txHash);
              }
            }

            return { success: true, provider: 'Rhinestone', hash: txHash || 'unknown' };
    } catch (error) {
            console.error("Rhinestone sponsored transaction failed:", error);
            return { success: false, provider: 'Rhinestone', error };
          }
        })(),

                // Gelato sponsored transaction
        (async () => {
          try {
            const sponsorApiKey = process.env.NEXT_PUBLIC_SPONSOR_API_KEY;
            if (!sponsorApiKey) {
              throw new Error('NEXT_PUBLIC_SPONSOR_API_KEY environment variable is required');
            }

            const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
            if (!EOA_PK) {
              throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
            }
            const owner = privateKeyToAccount(EOA_PK);

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

            const baseSepoliaPublicClient = createPublicClient({
              chain: baseSepolia,
              transport: http(),
            });

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

                                    return new Promise((resolve, reject) => {
              response.on("success", (status: GelatoTaskStatus) => {
                const endTime = Date.now();
                const latency = endTime - gelatoLocalStartTime;
                setGelatoLatency(latency);
                console.log(`Gelato transaction latency: ${(latency / 1000).toFixed(2)}s`);
                
                console.log("Gelato transaction successful:", status);
                if (status.transactionHash) {
                  setGelatoTxHash(status.transactionHash);
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
  }, [publicClient]);

  const handleCombinedErc20Transaction = useCallback(async () => {
    setEoaFunded("idle");
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear previous transaction info
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
    setCombinedErc20Loading(true);

    try {
      // Run both ERC20 transactions in parallel
      const [rhinestoneResult, gelatoResult] = await Promise.allSettled([
        // Rhinestone ERC20 transaction
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

      const rhinestoneAccount = await createRhinestoneAccount({
        owners: {
          type: 'ecdsa',
          accounts: [account],
        },
        rhinestoneApiKey,
      });
      
      const address = await rhinestoneAccount.getAddress();
      console.log(`Smart account address: ${address}`);

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

      const result = await rhinestoneAccount.sendTransaction({
        chain: sepolia,
        calls: [],     
              tokenRequests: [], // Noop transaction
            });

            // Start timing AFTER transaction has been sent
            const startTime = Date.now();
            setRhinestoneStartTime(startTime);
            console.log('Starting Rhinestone ERC20 transaction timing (after submission)...');

            const receipt2 = await rhinestoneAccount.waitForExecution(result, false);
            
            const endTime = Date.now();
            const latency = endTime - startTime;
            setRhinestoneLatency(latency);
            console.log(`Rhinestone ERC20 transaction latency (excluding funding): ${(latency / 1000).toFixed(2)}s`);
            
            let txHash: string | undefined;
            if (receipt2 && typeof receipt2 === 'object' && receipt2 !== null) {
              const receipt = receipt2 as { 
                fillTransactionHash?: string; 
                claims?: Array<{ claimTransactionHash?: string }>;
              };
              
              txHash = receipt.fillTransactionHash || 
                (receipt.claims && receipt.claims[0]?.claimTransactionHash);
              
              if (txHash) {
                setRhinestoneTxHash(txHash);
              }
            }

            return { success: true, provider: 'Rhinestone', hash: txHash || 'unknown' };
    } catch (error) {
            console.error("Rhinestone ERC20 transaction failed:", error);
            return { success: false, provider: 'Rhinestone', error };
          }
        })(),

                // Gelato ERC20 transaction
        (async () => {
          try {
      const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
      if (!EOA_PK) {
        throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
      }
      const owner = privateKeyToAccount(EOA_PK);

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

      const baseSepoliaPublicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

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

            const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;

      const response = await swc.execute({
        payment: erc20(usdcAddress),
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

                                    return new Promise((resolve, reject) => {
      response.on("success", (status: GelatoTaskStatus) => {
                const endTime = Date.now();
                const latency = endTime - gelatoLocalStartTime;
                setGelatoLatency(latency);
                console.log(`Gelato ERC20 transaction latency: ${(latency / 1000).toFixed(2)}s`);
                
                console.log(`Gelato ERC20 Transaction successful: https://sepolia.basescan.org/tx/${status.transactionHash}`);
                if (status.transactionHash) {
                  setGelatoTxHash(status.transactionHash);
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
      paymaster: pimlicoClient,
      chain: sepolia,
      userOperation: {
        estimateFeesPerGas: async () =>
          (await pimlicoClient.getUserOperationGasPrice()).fast,
      },
      bundlerTransport: http(pimlicoSepoliaUrl),
    }).extend(erc7579Actions());

    setSmartAccountClient(_smartAccountClient as any); // eslint-disable-line
  }, [account, publicClient, safeOwner]);

  useEffect(() => {
    const fetchInitialAccountState = async () => {
      if (!account || !publicClient) {
        return;
      }

      if (
        !smartAccountClient ||
        smartAccountClient.account.address !== account.address
      ) {
        // Removed setCount and count usage to fix ESLint error

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

  // Gelato addresses are static for this demo
  const gelatoOwner = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";
  const gelatoSmartWallet = "0x17a8d10B832d69a8c1389F686E7795ec8409F264";

  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)] flex flex-col items-center justify-center">
      <div className="flex flex-col lg:flex-row max-w-6xl w-full">
        {/* Rhinestone Section - Left Side */}
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
            
            {/* Funding status indicator for EOA, only show if eoaFunded is not 'idle' */}
            {eoaFunded !== "idle" && (
              <div className="mt-4">
                <strong>EOA funded:</strong> {eoaFunded === "yes" ? "yes" : "no"}
              </div>
            )}
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
                {rhinestoneLatency && (
                  <div className="mt-2">
                    <strong>Latency:</strong> {(rhinestoneLatency / 1000).toFixed(2)}s
                  </div>
                )}
              </div>
            )}
          </div>


        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-gray-300 dark:bg-gray-700 mx-4 flex-shrink-0 self-stretch"></div>

        {/* Gelato Section - Right Side */}
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
            {/* Gelato account info */}
            <div className="font-[family-name:var(--font-geist-mono)] text-sm break-words mb-2">
              <div>Owner: <span className="break-all">{gelatoOwner}</span></div>
              <div>Smart Wallet: <span className="break-all">{gelatoSmartWallet}</span></div>
            </div>
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
                                {gelatoLatency && (
                  <div className="mt-2">
                    <strong>Latency:</strong> {(gelatoLatency / 1000).toFixed(2)}s
                  </div>
                )}
              </div>
            )}
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
      
            
      
      {/* Buttons at the bottom center */}
      <div className="flex justify-center mt-8">
          <div className="flex gap-4 items-center flex-col sm:flex-row">
          <div className="w-64">
            <Button
              buttonText="Run Sponsored TXs (Parallel)"
              onClick={handleCombinedSponsoredTransaction}
              isLoading={combinedSponsoredLoading}
            />
          </div>
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