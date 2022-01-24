"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { defineReadOnly, resolveProperties, shallowCopy } from "@ethersproject/properties";
import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
import { getAddressFromAccount, getChecksumAddress } from "@ethersproject/address";
import { PublicKey as HederaPubKey } from "@hashgraph/sdk";
const logger = new Logger(version);
const allowedTransactionKeys = [
    "accessList", "chainId", "customData", "data", "from", "gasLimit", "maxFeePerGas", "maxPriorityFeePerGas", "to", "type", "value",
    "nodeId"
];
;
;
export class Signer {
    ///////////////////
    // Sub-classes MUST call super
    constructor() {
        logger.checkAbstract(new.target, Signer);
        defineReadOnly(this, "_isSigner", true);
    }
    getGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            this._checkProvider("getGasPrice");
            return yield this.provider.getGasPrice();
        });
    }
    ///////////////////
    // Sub-classes MAY override these
    getBalance(blockTag) {
        return __awaiter(this, void 0, void 0, function* () {
            this._checkProvider("getBalance");
            return yield this.provider.getBalance(this.getAddress(), blockTag);
        });
    }
    // Populates "from" if unspecified, and estimates the gas for the transaction
    estimateGas(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            this._checkProvider("estimateGas");
            const tx = yield resolveProperties(this.checkTransaction(transaction));
            // cost-answer query on hedera
            return yield this.provider.estimateGas(tx);
        });
    }
    // TODO: this should perform a LocalCall, sign and submit with provider.sendTransaction
    call(transaction, blockTag) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.resolve("");
        });
    }
    /**
     * Composes a transaction which is signed and sent to the provider's network.
     * @param transaction - the actual tx
     */
    sendTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield resolveProperties(transaction);
            if (tx.to) {
                const signed = yield this.signTransaction(tx);
                return yield this.provider.sendTransaction(signed);
            }
            else {
                const contractByteCode = tx.data;
                let chunks = splitInChunks(Buffer.from(contractByteCode).toString(), 4096);
                const fileCreate = {
                    customData: {
                        fileChunk: chunks[0],
                        fileKey: HederaPubKey.fromString(this._signingKey().compressedPublicKey)
                    }
                };
                const signedFileCreate = yield this.signTransaction(fileCreate);
                const resp = yield this.provider.sendTransaction(signedFileCreate);
                for (let chunk of chunks.slice(1)) {
                    const fileAppend = {
                        customData: {
                            fileId: resp.customData.fileId.toString(),
                            fileChunk: chunk
                        }
                    };
                    const signedFileAppend = yield this.signTransaction(fileAppend);
                    yield this.provider.sendTransaction(signedFileAppend);
                }
                const contractCreate = {
                    gasLimit: tx.gasLimit,
                    customData: {
                        bytecodeFileId: resp.customData.fileId.toString()
                    }
                };
                const signedContractCreate = yield this.signTransaction(contractCreate);
                return yield this.provider.sendTransaction(signedContractCreate);
            }
        });
    }
    getChainId() {
        return __awaiter(this, void 0, void 0, function* () {
            this._checkProvider("getChainId");
            const network = yield this.provider.getNetwork();
            return network.chainId;
        });
    }
    /**
     * Checks if the given transaction is usable.
     * Properties - `from`, `nodeId`, `gasLimit`
     * @param transaction - the tx to be checked
     */
    checkTransaction(transaction) {
        for (const key in transaction) {
            if (allowedTransactionKeys.indexOf(key) === -1) {
                logger.throwArgumentError("invalid transaction key: " + key, "transaction", transaction);
            }
        }
        const tx = shallowCopy(transaction);
        if (!tx.nodeId) {
            this._checkProvider();
            // provider present, we can go on
            const submittableNodeIDs = this.provider.getHederaNetworkConfig();
            if (submittableNodeIDs.length > 0) {
                tx.nodeId = submittableNodeIDs[randomNumBetween(0, submittableNodeIDs.length - 1)].toString();
            }
            else {
                logger.throwError("Unable to find submittable node ID. The signer's provider is not connected to any usable network");
            }
        }
        if (tx.from == null) {
            tx.from = this.getAddress();
        }
        else {
            // Make sure any provided address matches this signer
            tx.from = Promise.all([
                Promise.resolve(tx.from),
                this.getAddress()
            ]).then((result) => {
                if (result[0].toString().toLowerCase() !== result[1].toLowerCase()) {
                    logger.throwArgumentError("from address mismatch", "transaction", transaction);
                }
                return result[0];
            });
        }
        tx.gasLimit = transaction.gasLimit;
        return tx;
    }
    /**
     * Populates any missing properties in a transaction request.
     * Properties affected - `to`, `chainId`
     * @param transaction
     */
    populateTransaction(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield resolveProperties(this.checkTransaction(transaction));
            if (tx.to != null) {
                tx.to = Promise.resolve(tx.to).then((to) => __awaiter(this, void 0, void 0, function* () {
                    if (to == null) {
                        return null;
                    }
                    return getChecksumAddress(getAddressFromAccount(to));
                }));
                // Prevent this error from causing an UnhandledPromiseException
                tx.to.catch((error) => { });
            }
            const customData = yield tx.customData;
            // FileCreate and FileAppend always carry a customData.fileChunk object
            if (!(customData && customData.fileChunk) && tx.gasLimit == null) {
                return logger.throwError("cannot estimate gas; transaction requires manual gas limit", Logger.errors.UNPREDICTABLE_GAS_LIMIT, { tx: tx });
            }
            return yield resolveProperties(tx);
        });
    }
    ///////////////////
    // Sub-classes SHOULD leave these alone
    _checkProvider(operation) {
        if (!this.provider) {
            logger.throwError("missing provider", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: (operation || "_checkProvider")
            });
        }
    }
    static isSigner(value) {
        return !!(value && value._isSigner);
    }
}
export class VoidSigner extends Signer {
    constructor(address, provider) {
        logger.checkNew(new.target, VoidSigner);
        super();
        defineReadOnly(this, "address", address);
        defineReadOnly(this, "provider", provider || null);
    }
    getAddress() {
        return Promise.resolve(this.address);
    }
    _fail(message, operation) {
        return Promise.resolve().then(() => {
            logger.throwError(message, Logger.errors.UNSUPPORTED_OPERATION, { operation: operation });
        });
    }
    signMessage(message) {
        return this._fail("VoidSigner cannot sign messages", "signMessage");
    }
    signTransaction(transaction) {
        return this._fail("VoidSigner cannot sign transactions", "signTransaction");
    }
    createAccount(pubKey, initialBalance) {
        return this._fail("VoidSigner cannot create accounts", "createAccount");
    }
    _signTypedData(domain, types, value) {
        return this._fail("VoidSigner cannot sign typed data", "signTypedData");
    }
    connect(provider) {
        return new VoidSigner(this.address, provider);
    }
}
function splitInChunks(data, chunkSize) {
    const chunks = [];
    let num = 0;
    while (num <= data.length) {
        const slice = data.slice(num, chunkSize + num);
        num += chunkSize;
        chunks.push(slice);
    }
    return chunks;
}
/**
 * Generates a random integer in the given range
 * @param min - range start
 * @param max - range end
 */
export function randomNumBetween(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
//# sourceMappingURL=index.js.map