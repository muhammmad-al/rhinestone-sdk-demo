"use client";
import { Button } from "@/components/Button";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  encodeFunctionData,
  Hex,
  http,
} from "viem";
import {
  createGelatoSmartWalletClient,
  type GelatoTaskStatus,
  sponsored,
  erc20,
} from "@gelatonetwork/smartwallet";
import { gelato } from "@gelatonetwork/smartwallet/accounts";
import { baseSepolia } from "viem/chains";
import { Footer } from "@/components/Footer";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient } from 'viem';

export default function Home() {
  // Create public client for Base Sepolia
  const baseSepoliaPublicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // State management for accounts
  const [account, setAccount] = useState<any>();

  // Loading states for transaction operations
  const [sponsoredLoading, setSponsoredLoading] = useState(false);
  const [erc20Loading, setErc20Loading] = useState(false);
  
  // Transaction tracking state
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [gelatoTxHash, setGelatoTxHash] = useState<string>("");
  const [gelatoTaskId, setGelatoTaskId] = useState<string>("");
  const [gelatoErc20TaskId, setGelatoErc20TaskId] = useState<string>("");
  
  // Latency tracking state - measures transaction confirmation time
  const [gelatoLatency, setGelatoLatency] = useState<number | null>(null);
  const [gelatoStartTime, setGelatoStartTime] = useState<number | null>(null);

  // Gas usage tracking state - measures how much gas each transaction consumes
  const [gelatoGasUsed, setGelatoGasUsed] = useState<string | null>(null);

  // Load saved accounts from localStorage on component mount
  useEffect(() => {
    const localAccount = localStorage.getItem("7702-account") || "";
    if (localAccount) {
      setAccount(privateKeyToAccount(localAccount as Hex));
    }
  }, []);

  /**
   * Handles sponsored transactions using Gelato Smart Wallet SDK
   * This function executes transactions with gas paid by Gelato
   */
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

  /**
   * Handles ERC20 transactions using Gelato Smart Wallet SDK
   * This function executes transactions using ERC20 tokens for gas payment
   */
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
            <div>Rhinestone SDK removed</div>
            <div>Focusing on Gelato Smart Wallet SDK</div>
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
            <span className="text-2xl font-bold ml-2">Gelato Smart Wallet SDK</span>
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
          <div className="flex-1 flex flex-col justify-end">
            <div className="flex gap-4 items-center flex-col sm:flex-row">
              {/* Sponsored Transaction Button */}
              <div className="w-64">
                <Button
                  buttonText="Basic sponsored transactions"
                  onClick={handleSponsoredTransaction}
                  isLoading={sponsoredLoading}
                />
              </div>
              {/* ERC20 Transaction Button */}
              <div className="w-64">
                <Button
                  buttonText="ERC-20 gas payments"
                  onClick={handleErc20Transaction}
                  isLoading={erc20Loading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}