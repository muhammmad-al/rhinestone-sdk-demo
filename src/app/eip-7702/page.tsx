"use client";
import { Button } from "@/components/Button";
import { getCount, getIncrementCalldata } from "@/components/Counter";
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

  const [userOpLoading, setUserOpLoading] = useState(false);
  const [erc20Loading, setErc20Loading] = useState(false);
  const [gelatoLoading, setGelatoLoading] = useState(false);
  const [gelatoErc20Loading, setGelatoErc20Loading] = useState(false);
  const [count, setCount] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [lastTxChain, setLastTxChain] = useState<string>("sepolia");
  const [userOpReceipt, setUserOpReceipt] = useState<any>(null);
  const [gelatoTaskId, setGelatoTaskId] = useState<string>("");
  const [gelatoErc20TaskId, setGelatoErc20TaskId] = useState<string>("");

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



  const handleSendUserOp = useCallback(async () => {
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear previous transaction info
    setLastTxHash("");
    setUserOpReceipt(null);
    setUserOpLoading(true);

    try {
      // Step 1: Create EOA if not exists
      let _account = account;
      let _safeOwner = safeOwner;
      
      if (!_account) {
        const accountKey = generatePrivateKey();
        _account = privateKeyToAccount(accountKey);
        setAccount(_account);
        localStorage.setItem("7702-account", accountKey);
      }

      if (!_safeOwner) {
        const ownerKey = generatePrivateKey();
        _safeOwner = privateKeyToAccount(ownerKey);
        setSafeOwner(_safeOwner);
        localStorage.setItem("7702-owner", ownerKey);
      }

      // Step 2: Delegate to smart account if not already delegated
      if (!accountIsDelegated) {
        console.log("Delegating account to smart account...");
        
        const smartSessions = getSmartSessionsValidator({
          sessions: [session],
        });

        const sponsorAccount = privateKeyToAccount(
          process.env.NEXT_PUBLIC_SPONSOR_PK! as Hex,
        );

        const authorization = await signAuthorization(publicClient, {
          account: _account,
          contractAddress: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
          executor: sponsorAccount,
        });

        const txHash = await writeContract(publicClient, {
          address: _account.address,
          abi: parseAbi([
            "function setup(address[] calldata _owners,uint256 _threshold,address to,bytes calldata data,address fallbackHandler,address paymentToken,uint256 payment, address paymentReceiver) external",
          ]),
          functionName: "setup",
          args: [
            [_safeOwner.address],
            BigInt(1),
            "0x7579011aB74c46090561ea277Ba79D510c6C00ff",
            encodeFunctionData({
              abi: parseAbi([
                "struct ModuleInit {address module;bytes initData;}",
                "function addSafe7579(address safe7579,ModuleInit[] calldata validators,ModuleInit[] calldata executors,ModuleInit[] calldata fallbacks, ModuleInit[] calldata hooks,address[] calldata attesters,uint8 threshold) external",
              ]),
              functionName: "addSafe7579",
              args: [
                "0x7579EE8307284F293B1927136486880611F20002",
                [
                  {
                    module: smartSessions.address,
                    initData: smartSessions.initData,
                  },
                ],
                [],
                [],
                [],
                [
                  RHINESTONE_ATTESTER_ADDRESS,
                  MOCK_ATTESTER_ADDRESS,
                ],
                1,
              ],
            }),
            "0x7579EE8307284F293B1927136486880611F20002",
            zeroAddress,
            BigInt(0),
            zeroAddress,
          ],
          account: sponsorAccount,
          authorizationList: [authorization],
        });

        await publicClient.waitForTransactionReceipt({
          hash: txHash,
        });

        setAccountIsDelegated(true);
        console.log("Account delegated successfully");
      }

      // Step 3: Get or create smart account client
      let _smartAccountClient = smartAccountClient;
      if (!_smartAccountClient || _smartAccountClient.account.address !== _account.address) {
        const safeAccount = await toSafeSmartAccount({
          address: _account.address,
          client: publicClient,
          owners: [_safeOwner],
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

        _smartAccountClient = createSmartAccountClient({
          account: safeAccount,
          paymaster: pimlicoClient,
          chain: sepolia,
          userOperation: {
            estimateFeesPerGas: async () =>
              (await pimlicoClient.getUserOperationGasPrice()).fast,
          },
          bundlerTransport: http(pimlicoSepoliaUrl),
        }).extend(erc7579Actions());

        setSmartAccountClient(_smartAccountClient as any);
      }

      // Step 4: Send UserOp
      console.log("Sending UserOp...");
      
      const nonce = await getAccountNonce(publicClient, {
        address: _smartAccountClient.account.address,
        entryPointAddress: entryPoint07Address,
        key: encodeValidatorNonce({
          account: getAccount({
            address: _smartAccountClient.account.address,
            type: "safe",
          }),
          validator: SMART_SESSIONS_ADDRESS,
        }),
      });

      const sessionDetails = {
        mode: SmartSessionMode.USE,
        permissionId: getPermissionId({ session }),
        signature: getOwnableValidatorMockSignature({
          threshold: 1,
        }),
      };

      const userOperation = await _smartAccountClient.prepareUserOperation({
        account: _smartAccountClient.account,
        calls: [getIncrementCalldata()],
        nonce,
        signature: encodeSmartSessionSignature(sessionDetails),
      });

      const userOpHashToSign = getUserOperationHash({
        chainId: sepolia.id,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        userOperation,
      });

      const sessionOwner = privateKeyToAccount(
        process.env.NEXT_PUBLIC_SESSION_OWNER_PK! as Hex,
      );

      sessionDetails.signature = await sessionOwner.signMessage({
        message: { raw: userOpHashToSign },
      });

      userOperation.signature = encodeSmartSessionSignature(sessionDetails);

      const userOpHash =
        await _smartAccountClient.sendUserOperation(userOperation);

      const receipt = await _smartAccountClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      console.log("UserOp receipt: ", receipt);
      
      // Extract and store the transaction hash
      if (receipt.receipt && receipt.receipt.transactionHash) {
        setLastTxHash(receipt.receipt.transactionHash);
      }

      setCount(
        await getCount({
          publicClient,
          account: _smartAccountClient.account.address,
        }),
      );

      console.log("Complete flow executed successfully!");
    } catch (error) {
      console.error("Error in complete flow:", error);
    }

    setUserOpLoading(false);
  }, [publicClient, smartAccountClient, account, safeOwner, accountIsDelegated]);

  const handleSendERC20Transaction = useCallback(async () => {
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    // Clear previous transaction info
    setLastTxHash("");
    setUserOpReceipt(null);
    setErc20Loading(true);

    try {
      const rhinestoneApiKey = process.env.NEXT_PUBLIC_RHINESTONE_API_KEY;
      if (!rhinestoneApiKey) {
        throw new Error('NEXT_PUBLIC_RHINESTONE_API_KEY environment variable is required');
      }

      // Use your own private key for the smart account owner
      const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
      if (!EOA_PK) {
        throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
      }
      const account = privateKeyToAccount(EOA_PK);
      console.log(`Owner private key: ${EOA_PK}`);

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

      const result = await rhinestoneAccount.sendTransaction({
        chain: sepolia,
        calls: [],     
        tokenRequests: [],              // <-- the noop
      });

      const receipt2 = await rhinestoneAccount.waitForExecution(result);
      console.log('UserOp receipt / hash', receipt2);

      // Store the UserOp receipt
      setUserOpReceipt(receipt2);

      // Update the last transaction hash if available
      if (receipt2 && typeof receipt2 === 'object' && 'hash' in receipt2) {
        setLastTxHash(receipt2.hash);
      }

      console.log('ERC20 transaction completed successfully!');
    } catch (error) {
      console.error("Error in ERC20 transaction:", error);
    }

    setErc20Loading(false);
  }, [publicClient]);

  const handleSendGelatoTransaction = useCallback(async () => {
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    setGelatoLoading(true);

    try {
      const sponsorApiKey = process.env.NEXT_PUBLIC_SPONSOR_API_KEY;
      if (!sponsorApiKey) {
        throw new Error('NEXT_PUBLIC_SPONSOR_API_KEY environment variable is required');
      }

      // Use your own private key for the smart account owner
      const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
      if (!EOA_PK) {
        throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
      }
      const owner = privateKeyToAccount(EOA_PK);
      console.log(`Owner private key: ${EOA_PK}`);
      console.log(`Owner address: ${owner.address}`);

      // Example of creating a payload for increment() function
      const incrementAbi = [
        {
          name: "increment",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [],
          outputs: [],
        },
      ] as const;

      // Create the encoded function data
      const incrementData = encodeFunctionData({
        abi: incrementAbi,
        functionName: "increment",
      });

      console.log("Encoded increment() function data:", incrementData);

      const baseSepoliaPublicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const account = await gelato({
        owner,
        client: baseSepoliaPublicClient,
      });

      console.log("Account address:", account.address);
      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const swc = await createGelatoSmartWalletClient(client, {
        apiKey: sponsorApiKey,
      });

      console.log("Preparing transaction...");
      const preparedCalls = await swc.prepare({
        payment: sponsored(sponsorApiKey),
        calls: [
          {
            to: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as `0x${string}`, // Using the same target contract as Rhinestone
            data: incrementData,
            value: 0n,
          },
        ],
      });

      const response = await swc.send({
        preparedCalls,
      });

      console.log(`Your Gelato id is: ${response.id}`);
      setGelatoTaskId(response.id);

      console.log(
        `Check the status of your request here: https://api.gelato.digital/tasks/status/${response.id}`
      );
      console.log("Waiting for transaction to be confirmed...");

      // Listen for events
      response.on("success", (status: GelatoTaskStatus) => {
        console.log(`Transaction successful: https://sepolia.basescan.org/tx/${status.transactionHash}`);
        setLastTxHash(status.transactionHash);
        setLastTxChain("base-sepolia");
        setGelatoLoading(false);
      });
      response.on("error", (error: Error) => {
        console.error(`Transaction failed: ${error.message}`);
        setGelatoLoading(false);
      });

    } catch (error) {
      console.error("Error in Gelato transaction:", error);
      setGelatoLoading(false);
    }
  }, [publicClient]);

  const handleSendGelatoERC20Transaction = useCallback(async () => {
    if (!publicClient) {
      console.error("No public client");
      return;
    }

    setGelatoErc20Loading(true);

    try {
      // Use your own private key for the smart account owner
      const EOA_PK = process.env.NEXT_PUBLIC_EOA_PK as `0x${string}` | undefined;
      if (!EOA_PK) {
        throw new Error('NEXT_PUBLIC_EOA_PK environment variable is required');
      }
      const owner = privateKeyToAccount(EOA_PK);
      console.log(`Owner private key: ${EOA_PK}`);
      console.log(`Owner address: ${owner.address}`);

      // Example of creating a payload for increment() function
      const incrementAbi = [{
        name: "increment",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
        outputs: []
      }] as const;

      // Create the encoded function data
      const incrementData = encodeFunctionData({
        abi: incrementAbi,
        functionName: "increment"
      });

      console.log("Encoded increment() function data:", incrementData);

      const baseSepoliaPublicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });

      const account = await gelato({
        owner,
        client: baseSepoliaPublicClient,
      });

      console.log("Account address:", account.address);
      const client = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const swc = await createGelatoSmartWalletClient(client);

      // Using USDC on Base Sepolia for ERC20 payment
      const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`; // Base Sepolia USDC

      const response = await swc.execute({
        payment: erc20(usdcAddress),
        calls: [
          {
            to: "0x19575934a9542be941d3206f3ecff4a5ffb9af88" as `0x${string}`, // Using the same target contract
            data: incrementData,
            value: 0n,
          },
        ],
      });

      console.log(`Your Gelato ERC20 id is: ${response.id}`);
      setGelatoErc20TaskId(response.id);

      console.log(
        `Check the status of your request here: https://api.gelato.digital/tasks/status/${response.id}`
      );
      console.log("Waiting for transaction to be confirmed...");

      // Listen for events
      response.on("success", (status: GelatoTaskStatus) => {
        console.log(`ERC20 Transaction successful: https://sepolia.basescan.org/tx/${status.transactionHash}`);
        setLastTxHash(status.transactionHash);
        setLastTxChain("base-sepolia");
        setGelatoErc20Loading(false);
      });
      response.on("error", (error: Error) => {
        console.error(`ERC20 Transaction failed: ${error.message}`);
        setGelatoErc20Loading(false);
      });

    } catch (error) {
      console.error("Error in Gelato ERC20 transaction:", error);
      setGelatoErc20Loading(false);
    }
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
        setCount(
          await getCount({
            publicClient,
            account: account.address,
          }),
        );

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

  return (
    <div className="min-h-screen p-8 pb-20 font-[family-name:var(--font-geist-sans)] flex items-center justify-center">
      <div className="flex flex-col lg:flex-row gap-8 max-w-6xl">
        {/* Rhinestone Section - Left Side */}
        <div className="flex-1 flex flex-col gap-8">
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
          <ol className="list-inside list-decimal text-sm font-[family-name:var(--font-geist-mono)]">
            <li className="mb-2">Create an EOA.</li>
            <li className="mb-2">Delegate to a smart account.</li>
            <li className="mb-2">
              Use the session key to send UserOperations without a user signature.
            </li>
          </ol>
          <div className="font-[family-name:var(--font-geist-mono)] text-sm">
            <div>{account && <>Account: {account.address}</>}</div>
            <div>
              {sessionOwner && <>Session owner: {sessionOwner.address}</>}
            </div>
                      <div>
            {account && <>Account {!accountIsDelegated && "not"} delegated</>}
          </div>
            {userOpReceipt && (
              <div className="mt-4">
                <div className="font-bold mb-2">UserOp Receipt:</div>
                <div className="text-sm font-mono">
                  {userOpReceipt.bundleEvent?.bundleId && (
                    <div><strong>Bundle ID:</strong> {userOpReceipt.bundleEvent.bundleId}</div>
                  )}
                  {userOpReceipt.userAddress && (
                    <div><strong>User Address:</strong> {userOpReceipt.userAddress}</div>
                  )}
                  {userOpReceipt.targetChainId && (
                    <div><strong>Target Chain ID:</strong> {userOpReceipt.targetChainId}</div>
                  )}
                  {userOpReceipt.hash && (
                    <div><strong>Hash:</strong> {userOpReceipt.hash}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 items-center flex-col sm:flex-row">
            <Button
              buttonText="Send UserOp"
              onClick={handleSendUserOp}
              isLoading={userOpLoading}
            />
            <Button
              buttonText="Send ERC20 Transaction"
              onClick={handleSendERC20Transaction}
              isLoading={erc20Loading}
            />
          </div>
        </div>

        {/* Gelato Section - Right Side */}
        <div className="flex-1 flex flex-col gap-8 border-l border-gray-300 dark:border-gray-700 pl-8">
          <div className="flex flex-row items-center align-center">
            <div className="text-2xl font-bold">Gelato Smart Wallet</div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>Gelato Smart Wallet implementation will be added here for benchmarking comparison.</p>
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
                    Check ERC20 Status
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-4 items-center flex-col sm:flex-row">
            <Button
              buttonText="Send Sponsored Transaction"
              onClick={handleSendGelatoTransaction}
              isLoading={gelatoLoading}
            />
            <Button
              buttonText="Send ERC20 Transaction"
              onClick={handleSendGelatoERC20Transaction}
              isLoading={gelatoErc20Loading}
            />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}