"use strict";

import { AccountLike, getAccountFromAddress, getAddress } from "@ethersproject/address";
import { BigNumber, BigNumberish, numberify } from "@ethersproject/bignumber";
import {
    arrayify,
    BytesLike,
    DataOptions,
    hexConcat,
    hexDataLength,
    hexDataSlice,
    hexlify,
    // hexZeroPad,
    isBytesLike,
    SignatureLike,
    splitSignature,
    stripZeros,
} from "@ethersproject/bytes";
import {Zero} from "@ethersproject/constants";
import {keccak256} from "@ethersproject/keccak256";
import {checkProperties} from "@ethersproject/properties";
import * as RLP from "@ethersproject/rlp";
import {computePublicKey, recoverPublicKey} from "@ethersproject/signing-key";

import {Logger} from "@ethersproject/logger";
import {version} from "./_version";
import {base64, getAddressFromAccount} from "ethers/lib/utils";
import {
    ContractCreateTransaction,
    ContractExecuteTransaction, ContractId, FileAppendTransaction,
    FileCreateTransaction,
    Transaction as HederaTransaction,
    PublicKey as HederaPubKey, TransactionId, AccountId, TransferTransaction, AccountCreateTransaction, Hbar
} from "@hashgraph/sdk";
import { TransactionRequest } from "@ethersproject/abstract-provider";

const logger = new Logger(version);

///////////////////////////////
// Exported Types

export type AccessList = Array<{ address: string, storageKeys: Array<string> }>;

// Input allows flexibility in describing an access list
export type AccessListish = AccessList |
                            Array<[ string, Array<string> ]> |
                            Record<string, Array<string>>;

export enum TransactionTypes {
    legacy = 0,
    eip2930 = 1,
    eip1559 = 2,
}

export type UnsignedTransaction = {
    to?: AccountLike;
    nonce?: number;

    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;

    data?: BytesLike;
    value?: BigNumberish;
    chainId?: number;

    // Typed-Transaction features
    type?: number | null;

    // EIP-2930; Type 1 & EIP-1559; Type 2
    accessList?: AccessListish;

    // EIP-1559; Type 2
    maxPriorityFeePerGas?: BigNumberish;
    maxFeePerGas?: BigNumberish;
}

export interface Transaction {
    hash?: string;

    to?: string;
    from?: string;
    nonce: number; // TODO remove

    gasLimit: BigNumber;
    gasPrice?: BigNumber; // TODO remove

    data: string;
    value: BigNumber;
    chainId: number;

    r?: string;
    s?: string;
    v?: number;

    // Typed-Transaction features
    type?: number | null;

    // EIP-2930; Type 1 & EIP-1559; Type 2
    accessList?: AccessList;

    // EIP-1559; Type 2
    maxPriorityFeePerGas?: BigNumber;
    maxFeePerGas?: BigNumber;
}

type HederaTransactionContents = {
    hash: string,
    to?: string,
    from: string,
    gasLimit: BigNumber,
    value: BigNumber,
    data: string
}

///////////////////////////////

function handleNumber(value: string): BigNumber {
    if (value === "0x") { return Zero; }
    return BigNumber.from(value);
}

// Legacy Transaction Fields
const transactionFields = [
    { name: "nonce",    maxLength: 32, numeric: true },
    { name: "gasPrice", maxLength: 32, numeric: true },
    { name: "gasLimit", maxLength: 32, numeric: true },
    { name: "to",          length: 20 },
    { name: "value",    maxLength: 32, numeric: true },
    { name: "data" },
];

const allowedTransactionKeys: { [ key: string ]: boolean } = {
    chainId: true, data: true, gasLimit: true, gasPrice:true, nonce: true, to: true, type: true, value: true
}

export function computeAddress(key: BytesLike | string): string {
    const publicKey = computePublicKey(key);
    return getAddress(hexDataSlice(keccak256(hexDataSlice(publicKey, 1)), 12));
}

export function computeAlias(key: BytesLike | string): string {
    const publicKey = computePublicKey(key);
    return computeAliasFromPubKey(publicKey);
}

export function computeAliasFromPubKey(pubKey: string): string {
    return `0.0.${base64.encode(pubKey)}`;
}

export function recoverAddress(digest: BytesLike, signature: SignatureLike): string {
    return computeAddress(recoverPublicKey(arrayify(digest), signature));
}

function formatNumber(value: BigNumberish, name: string): Uint8Array {
    const result = stripZeros(BigNumber.from(value).toHexString());
    if (result.length > 32) {
        logger.throwArgumentError("invalid length for " + name, ("transaction:" + name), value);
    }
    return result;
}

function accessSetify(addr: string, storageKeys: Array<string>): { address: string,storageKeys: Array<string> } {
    return {
        address: getAddress(addr),
        storageKeys: (storageKeys || []).map((storageKey, index) => {
            if (hexDataLength(storageKey) !== 32) {
                logger.throwArgumentError("invalid access list storageKey", `accessList[${ addr }:${ index }]`, storageKey)
            }
            return storageKey.toLowerCase();
        })
    };
}

export function accessListify(value: AccessListish): AccessList {
    if (Array.isArray(value)) {
        return (<Array<[ string, Array<string>] | { address: string, storageKeys: Array<string>}>>value).map((set, index) => {
            if (Array.isArray(set)) {
                if (set.length > 2) {
                    logger.throwArgumentError("access list expected to be [ address, storageKeys[] ]", `value[${ index }]`, set);
                }
                return accessSetify(set[0], set[1])
            }
            return accessSetify(set.address, set.storageKeys);
        });
    }

    const result: Array<{ address: string, storageKeys: Array<string> }> = Object.keys(value).map((addr) => {
        const storageKeys: Record<string, true> = value[addr].reduce((accum, storageKey) => {
            accum[storageKey] = true;
            return accum;
        }, <Record<string, true>>{ });
        return accessSetify(addr, Object.keys(storageKeys).sort())
    });
    result.sort((a, b) => (a.address.localeCompare(b.address)));
    return result;
}

function formatAccessList(value: AccessListish): Array<[ string, Array<string> ]> {
    return accessListify(value).map((set) => [ set.address, set.storageKeys ]);
}

function _serializeEip1559(transaction: UnsignedTransaction, signature?: SignatureLike): string {
    // If there is an explicit gasPrice, make sure it matches the
    // EIP-1559 fees; otherwise they may not understand what they
    // think they are setting in terms of fee.
    if (transaction.gasPrice != null) {
        const gasPrice = BigNumber.from(transaction.gasPrice);
        const maxFeePerGas = BigNumber.from(transaction.maxFeePerGas || 0);
        if (!gasPrice.eq(maxFeePerGas)) {
            logger.throwArgumentError("mismatch EIP-1559 gasPrice != maxFeePerGas", "tx", {
                gasPrice, maxFeePerGas
            });
        }
    }

    const fields: any = [
        formatNumber(transaction.chainId || 0, "chainId"),
        formatNumber(transaction.nonce || 0, "nonce"),
        formatNumber(transaction.maxPriorityFeePerGas || 0, "maxPriorityFeePerGas"),
        formatNumber(transaction.maxFeePerGas || 0, "maxFeePerGas"),
        formatNumber(transaction.gasLimit || 0, "gasLimit"),
        // ((transaction.to != null) ? getAddress(transaction.to): "0x"),
        formatNumber(transaction.value || 0, "value"),
        (transaction.data || "0x"),
        (formatAccessList(transaction.accessList || []))
    ];

    if (signature) {
        const sig = splitSignature(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push(stripZeros(sig.r));
        fields.push(stripZeros(sig.s));
    }

    return hexConcat([ "0x02", RLP.encode(fields)]);
}

function _serializeEip2930(transaction: UnsignedTransaction, signature?: SignatureLike): string {
    const fields: any = [
        formatNumber(transaction.chainId || 0, "chainId"),
        formatNumber(transaction.nonce || 0, "nonce"),
        formatNumber(transaction.gasPrice || 0, "gasPrice"),
        formatNumber(transaction.gasLimit || 0, "gasLimit"),
        // ((transaction.to != null) ? getAddress(transaction.to): "0x"),
        formatNumber(transaction.value || 0, "value"),
        (transaction.data || "0x"),
        (formatAccessList(transaction.accessList || []))
    ];

    if (signature) {
        const sig = splitSignature(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push(stripZeros(sig.r));
        fields.push(stripZeros(sig.s));
    }

    return hexConcat([ "0x01", RLP.encode(fields)]);
}

// Legacy Transactions and EIP-155
function _serialize(transaction: UnsignedTransaction, signature?: SignatureLike): string {
    checkProperties(transaction, allowedTransactionKeys);

    const raw: Array<string | Uint8Array> = [];

    transactionFields.forEach(function(fieldInfo) {
        let value = (<any>transaction)[fieldInfo.name] || ([]);
        const options: DataOptions = { };
        if (fieldInfo.numeric) { options.hexPad = "left"; }
        value = arrayify(hexlify(value, options));

        // Fixed-width field
        if (fieldInfo.length && value.length !== fieldInfo.length && value.length > 0) {
            logger.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value);
        }

        // Variable-width (with a maximum)
        if (fieldInfo.maxLength) {
            value = stripZeros(value);
            if (value.length > fieldInfo.maxLength) {
                logger.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value );
            }
        }

        raw.push(hexlify(value));
    });

    let chainId = 0;
    if (transaction.chainId != null) {
        // A chainId was provided; if non-zero we'll use EIP-155
        chainId = transaction.chainId;

        if (typeof(chainId) !== "number") {
            logger.throwArgumentError("invalid transaction.chainId", "transaction", transaction);
        }

    } else if (signature && !isBytesLike(signature) && signature.v > 28) {
        // No chainId provided, but the signature is signing with EIP-155; derive chainId
        chainId = Math.floor((signature.v - 35) / 2);
    }

    // We have an EIP-155 transaction (chainId was specified and non-zero)
    if (chainId !== 0) {
        raw.push(hexlify(chainId)); // @TODO: hexValue?
        raw.push("0x");
        raw.push("0x");
    }

    // Requesting an unsigned transaction
    if (!signature) {
        return RLP.encode(raw);
    }

    // The splitSignature will ensure the transaction has a recoveryParam in the
    // case that the signTransaction function only adds a v.
    const sig = splitSignature(signature);

    // We pushed a chainId and null r, s on for hashing only; remove those
    let v = 27 + sig.recoveryParam
    if (chainId !== 0) {
        raw.pop();
        raw.pop();
        raw.pop();
        v += chainId * 2 + 8;

        // If an EIP-155 v (directly or indirectly; maybe _vs) was provided, check it!
        if (sig.v > 28 && sig.v !== v) {
             logger.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
        }
    } else if (sig.v !== v) {
         logger.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
    }

    raw.push(hexlify(v));
    raw.push(stripZeros(arrayify(sig.r)));
    raw.push(stripZeros(arrayify(sig.s)));

    return RLP.encode(raw);
}

export function serialize(transaction: UnsignedTransaction, signature?: SignatureLike): string {
    // Legacy and EIP-155 Transactions
    if (transaction.type == null || transaction.type === 0) {
        if (transaction.accessList != null) {
            logger.throwArgumentError("untyped transactions do not support accessList; include type: 1", "transaction", transaction);
        }
        return _serialize(transaction, signature);
    }

    // Typed Transactions (EIP-2718)
    switch (transaction.type) {
        case 1:
            return _serializeEip2930(transaction, signature);
        case 2:
            return _serializeEip1559(transaction, signature);
        default:
            break;
    }

    return logger.throwError(`unsupported transaction type: ${ transaction.type }`, Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "serializeTransaction",
        transactionType: transaction.type
    });
}

export function serializeHederaTransaction(transaction: TransactionRequest) : HederaTransaction {
    let tx: HederaTransaction;
    const arrayifiedData = transaction.data ? arrayify(transaction.data) : new Uint8Array();
    const gas = numberify(transaction.gasLimit ? transaction.gasLimit : 0);
    if (transaction.to) {
        tx = new ContractExecuteTransaction()
            .setContractId(ContractId.fromSolidityAddress(getAddressFromAccount(transaction.to)))
            .setFunctionParameters(arrayifiedData)
            .setGas(gas);
        if (transaction.value) {
            (tx as ContractExecuteTransaction).setPayableAmount(transaction.value?.toString())
        }
    } else {
        if (transaction.customData.bytecodeFileId) {
            tx = new ContractCreateTransaction()
                .setBytecodeFileId(transaction.customData.bytecodeFileId)
                .setConstructorParameters(arrayifiedData)
                .setInitialBalance(transaction.value?.toString())
                .setGas(gas);
        } else {
            if (transaction.customData.fileChunk && transaction.customData.fileId) {
                tx = new FileAppendTransaction()
                    .setContents(transaction.customData.fileChunk)
                    .setFileId(transaction.customData.fileId)
            } else if (!transaction.customData.fileId && transaction.customData.fileChunk) {
                // only a chunk, thus the first one
                tx = new FileCreateTransaction()
                    .setContents(transaction.customData.fileChunk)
                    .setKeys([ transaction.customData.fileKey ?
                        transaction.customData.fileKey :
                        HederaPubKey.fromString(this._signingKey().compressedPublicKey) ])
            } else if (transaction.customData.publicKey) {
                const {publicKey, initialBalance} = transaction.customData;
                tx = new AccountCreateTransaction()
                    .setKey(HederaPubKey.fromString(publicKey.toString()))
                    .setInitialBalance(Hbar.fromTinybars(initialBalance.toString()));
            }
            else {
                logger.throwArgumentError(
                    "Cannot determine transaction type from given custom data. Need either `to`, `fileChunk`, `fileId` or `bytecodeFileId`",
                    Logger.errors.INVALID_ARGUMENT,
                    transaction);
            }
        }
    }
    const account = getAccountFromAddress(transaction.from.toString());
    tx.setTransactionId(
        TransactionId.generate(new AccountId({
            shard: numberify(account.shard),
            realm: numberify(account.realm),
            num: numberify(account.num)
        })))
    .setNodeAccountIds([AccountId.fromString(transaction.nodeId.toString())])
    .freeze();
    return tx;
}

// function _parseEipSignature(tx: Transaction, fields: Array<string>, serialize: (tx: UnsignedTransaction) => string): void {
//     try {
//         const recid = handleNumber(fields[0]).toNumber();
//         if (recid !== 0 && recid !== 1) { throw new Error("bad recid"); }
//         tx.v = recid;
//     } catch (error) {
//         logger.throwArgumentError("invalid v for transaction type: 1", "v", fields[0]);
//     }
//
//     tx.r = hexZeroPad(fields[1], 32);
//     tx.s = hexZeroPad(fields[2], 32);
//
//     try {
//         const digest = keccak256(serialize(tx));
//         tx.from = recoverAddress(digest, { r: tx.r, s: tx.s, recoveryParam: tx.v });
//     } catch (error) {
//         console.log(error);
//     }
// }

//

// // Legacy Transactions and EIP-155
// function _parse(rawTransaction: Uint8Array): Transaction {
//     const transaction = RLP.decode(rawTransaction);
//
//     if (transaction.length !== 9 && transaction.length !== 6) {
//         logger.throwArgumentError("invalid raw transaction", "rawTransaction", rawTransaction);
//     }
//
//     const tx: Transaction = {
//         nonce:    handleNumber(transaction[0]).toNumber(),
//         gasPrice: handleNumber(transaction[1]),
//         gasLimit: handleNumber(transaction[2]),
//         to:       handleAddress(transaction[3]),
//         value:    handleNumber(transaction[4]),
//         data:     transaction[5],
//         chainId:  0
//     };
//
//     // Legacy unsigned transaction
//     if (transaction.length === 6) { return tx; }
//
//     try {
//         tx.v = BigNumber.from(transaction[6]).toNumber();
//
//     } catch (error) {
//         console.log(error);
//         return tx;
//     }
//
//     tx.r = hexZeroPad(transaction[7], 32);
//     tx.s = hexZeroPad(transaction[8], 32);
//
//     if (BigNumber.from(tx.r).isZero() && BigNumber.from(tx.s).isZero()) {
//         // EIP-155 unsigned transaction
//         tx.chainId = tx.v;
//         tx.v = 0;
//
//     } else {
//         // Signed Transaction
//
//         tx.chainId = Math.floor((tx.v - 35) / 2);
//         if (tx.chainId < 0) { tx.chainId = 0; }
//
//         let recoveryParam = tx.v - 27;
//
//         const raw = transaction.slice(0, 6);
//
//         if (tx.chainId !== 0) {
//             raw.push(hexlify(tx.chainId));
//             raw.push("0x");
//             raw.push("0x");
//             recoveryParam -= tx.chainId * 2 + 8;
//         }
//
//         const digest = keccak256(RLP.encode(raw));
//         try {
//             tx.from = recoverAddress(digest, { r: hexlify(tx.r), s: hexlify(tx.s), recoveryParam: recoveryParam });
//         } catch (error) {
//             console.log(error);
//         }
//
//         tx.hash = keccak256(rawTransaction);
//     }
//
//     tx.type = null;
//
//     return tx;
// }


export async function parse(rawTransaction: BytesLike): Promise<Transaction> {
    const payload = arrayify(rawTransaction);

    let parsed;
    try {
        parsed = HederaTransaction.fromBytes(payload);
    } catch (error) {
        logger.throwArgumentError(error.message, "rawTransaction", rawTransaction);
    }

    let contents = {
        hash: hexlify(await parsed.getTransactionHash()),
        from: getAddressFromAccount(parsed.transactionId.accountId.toString()),
    } as HederaTransactionContents;

    if (parsed instanceof ContractExecuteTransaction) {
        parsed = parsed as ContractExecuteTransaction;
        contents.to = getAddressFromAccount(parsed.contractId?.toString());
        contents.gasLimit = handleNumber(parsed.gas.toString());
        contents.value = parsed.payableAmount ?
            handleNumber(parsed.payableAmount.toBigNumber().toString()) : handleNumber('0');
        contents.data = parsed.functionParameters ? hexlify(parsed.functionParameters) : '0x';
    } else if (parsed instanceof ContractCreateTransaction) {
        parsed = parsed as ContractCreateTransaction;
        contents.gasLimit = handleNumber(parsed.gas.toString());
        contents.value = parsed.initialBalance ?
            handleNumber(parsed.initialBalance.toBigNumber().toString()) : handleNumber('0');
        // TODO IMPORTANT! We are setting only the constructor arguments and not the whole bytecode + constructor args
        contents.data = parsed.constructorParameters ? hexlify(parsed.constructorParameters) : '0x';
    } else if (parsed instanceof FileCreateTransaction) {
        parsed = parsed as FileCreateTransaction;
        contents.data = hexlify(Buffer.from(parsed.contents));
    } else if (parsed instanceof FileAppendTransaction) {
        parsed = parsed as FileAppendTransaction;
        contents.data = hexlify(Buffer.from(parsed.contents));
    } else if (parsed instanceof TransferTransaction) {
        // TODO populate value / to?
    } else if (parsed instanceof AccountCreateTransaction) {
        parsed = parsed as AccountCreateTransaction;
        contents.value = parsed.initialBalance ?
            handleNumber(parsed.initialBalance.toBigNumber().toString()) : handleNumber('0');
    } else {
        return logger.throwError(`unsupported transaction`, Logger.errors.UNSUPPORTED_OPERATION, {operation: "parse"});
    }

    // TODO populate r, s ,v

    return {
        ...contents,
        nonce: 0,
        gasPrice: handleNumber('0'),
        chainId: 0,
        r: '',
        s: '',
        v: 0,
        type: null,
    };
}

