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
import { sepolia } from "viem/chains";
import { getAccountNonce } from "permissionless/actions";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { Footer } from "@/components/Footer";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeContract } from "viem/actions";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createRhinestoneAccount } from '@rhinestone/sdk';
import { createWalletClient, parseEther } from 'viem';

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
  const [count, setCount] = useState<number>(0);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [userOpReceipt, setUserOpReceipt] = useState<any>(null);

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
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
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
        <ol className="list-inside list-decimal text-sm text-center sm:text-left font-[family-name:var(--font-geist-mono)]">
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
          {lastTxHash && (
            <div>
              <div>Transaction Hash: <a 
                href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                {lastTxHash}
              </a></div>
            </div>
          )}
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
      </main>
      <Footer />
    </div>
  );
}