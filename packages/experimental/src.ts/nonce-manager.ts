"use strict"

import { ethers } from "ethers";

import { version } from "./_version";
import { TransactionRequest, TransactionResponse } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";

const logger = new ethers.utils.Logger(version);

// @TODO: Keep a per-NonceManager pool of sent but unmined transactions for
//        rebroadcasting, in case we overrun the transaction pool

/**
 * TODO: This class and it's usage in the hedera network must be explored.
 */
export class NonceManager extends ethers.Signer {
    readonly signer: ethers.Signer;

    _initialPromise: Promise<number>;
    _deltaCount: number;

    constructor(signer: ethers.Signer) {
        logger.checkNew(new.target, NonceManager);
        super();
        this._deltaCount = 0;
        ethers.utils.defineReadOnly(this, "signer", signer);
        ethers.utils.defineReadOnly(this, "provider", signer.provider || null);
    }

    connect(provider: ethers.providers.Provider): NonceManager {
        return new NonceManager(this.signer.connect(provider));
    }

    getAddress(): Promise<string> {
        return this.signer.getAddress();
    }



    setTransactionCount(transactionCount: ethers.BigNumberish | Promise<ethers.BigNumberish>): void {
        this._initialPromise = Promise.resolve(transactionCount).then((nonce) => {
            return ethers.BigNumber.from(nonce).toNumber();
        });
        this._deltaCount = 0;
    }

    incrementTransactionCount(count?: number): void {
        this._deltaCount += (count ? count: 1);
    }

    signMessage(message: ethers.Bytes | string): Promise<string> {
        return this.signer.signMessage(message);;
    }

    signTransaction(transaction: TransactionRequest): Promise<string> {
        return this.signer.signTransaction(transaction);
    }

    sendTransaction(transaction: TransactionRequest): Promise<ethers.providers.TransactionResponse> {
        return this.signer.sendTransaction(transaction).then((tx) => {
            return tx;
        });
    }

    async createAccount(pubKey: BytesLike, initialBalance?: BigInt): Promise<TransactionResponse> {
        // @ts-ignore
        return logger.throwError("Unsupported operation", ethers.errors.UNSUPPORTED_OPERATION, {
            operation: "createAccount"
        });
    };
}
