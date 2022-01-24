import { ethers } from "ethers";
import { TransactionRequest, TransactionResponse } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
/**
 * TODO: This class and it's usage in the hedera network must be explored.
 */
export declare class NonceManager extends ethers.Signer {
    readonly signer: ethers.Signer;
    _initialPromise: Promise<number>;
    _deltaCount: number;
    constructor(signer: ethers.Signer);
    connect(provider: ethers.providers.Provider): NonceManager;
    getAddress(): Promise<string>;
    setTransactionCount(transactionCount: ethers.BigNumberish | Promise<ethers.BigNumberish>): void;
    incrementTransactionCount(count?: number): void;
    signMessage(message: ethers.Bytes | string): Promise<string>;
    signTransaction(transaction: TransactionRequest): Promise<string>;
    sendTransaction(transaction: TransactionRequest): Promise<ethers.providers.TransactionResponse>;
    createAccount(pubKey: BytesLike, initialBalance?: BigInt): Promise<TransactionResponse>;
}
//# sourceMappingURL=nonce-manager.d.ts.map