"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.serializeHederaTransaction = exports.serialize = exports.accessListify = exports.recoverAddress = exports.computeAliasFromPubKey = exports.computeAlias = exports.computeAddress = exports.TransactionTypes = void 0;
var address_1 = require("@ethersproject/address");
var bignumber_1 = require("@ethersproject/bignumber");
var bytes_1 = require("@ethersproject/bytes");
var constants_1 = require("@ethersproject/constants");
var keccak256_1 = require("@ethersproject/keccak256");
var properties_1 = require("@ethersproject/properties");
var RLP = __importStar(require("@ethersproject/rlp"));
var signing_key_1 = require("@ethersproject/signing-key");
var logger_1 = require("@ethersproject/logger");
var _version_1 = require("./_version");
var utils_1 = require("ethers/lib/utils");
var sdk_1 = require("@hashgraph/sdk");
var logger = new logger_1.Logger(_version_1.version);
var TransactionTypes;
(function (TransactionTypes) {
    TransactionTypes[TransactionTypes["legacy"] = 0] = "legacy";
    TransactionTypes[TransactionTypes["eip2930"] = 1] = "eip2930";
    TransactionTypes[TransactionTypes["eip1559"] = 2] = "eip1559";
})(TransactionTypes = exports.TransactionTypes || (exports.TransactionTypes = {}));
///////////////////////////////
function handleNumber(value) {
    if (value === "0x") {
        return constants_1.Zero;
    }
    return bignumber_1.BigNumber.from(value);
}
// Legacy Transaction Fields
var transactionFields = [
    { name: "nonce", maxLength: 32, numeric: true },
    { name: "gasPrice", maxLength: 32, numeric: true },
    { name: "gasLimit", maxLength: 32, numeric: true },
    { name: "to", length: 20 },
    { name: "value", maxLength: 32, numeric: true },
    { name: "data" },
];
var allowedTransactionKeys = {
    chainId: true, data: true, gasLimit: true, gasPrice: true, nonce: true, to: true, type: true, value: true
};
function computeAddress(key) {
    var publicKey = (0, signing_key_1.computePublicKey)(key);
    return (0, address_1.getAddress)((0, bytes_1.hexDataSlice)((0, keccak256_1.keccak256)((0, bytes_1.hexDataSlice)(publicKey, 1)), 12));
}
exports.computeAddress = computeAddress;
function computeAlias(key) {
    var publicKey = (0, signing_key_1.computePublicKey)(key);
    return computeAliasFromPubKey(publicKey);
}
exports.computeAlias = computeAlias;
function computeAliasFromPubKey(pubKey) {
    return "0.0." + utils_1.base64.encode(pubKey);
}
exports.computeAliasFromPubKey = computeAliasFromPubKey;
function recoverAddress(digest, signature) {
    return computeAddress((0, signing_key_1.recoverPublicKey)((0, bytes_1.arrayify)(digest), signature));
}
exports.recoverAddress = recoverAddress;
function formatNumber(value, name) {
    var result = (0, bytes_1.stripZeros)(bignumber_1.BigNumber.from(value).toHexString());
    if (result.length > 32) {
        logger.throwArgumentError("invalid length for " + name, ("transaction:" + name), value);
    }
    return result;
}
function accessSetify(addr, storageKeys) {
    return {
        address: (0, address_1.getAddress)(addr),
        storageKeys: (storageKeys || []).map(function (storageKey, index) {
            if ((0, bytes_1.hexDataLength)(storageKey) !== 32) {
                logger.throwArgumentError("invalid access list storageKey", "accessList[" + addr + ":" + index + "]", storageKey);
            }
            return storageKey.toLowerCase();
        })
    };
}
function accessListify(value) {
    if (Array.isArray(value)) {
        return value.map(function (set, index) {
            if (Array.isArray(set)) {
                if (set.length > 2) {
                    logger.throwArgumentError("access list expected to be [ address, storageKeys[] ]", "value[" + index + "]", set);
                }
                return accessSetify(set[0], set[1]);
            }
            return accessSetify(set.address, set.storageKeys);
        });
    }
    var result = Object.keys(value).map(function (addr) {
        var storageKeys = value[addr].reduce(function (accum, storageKey) {
            accum[storageKey] = true;
            return accum;
        }, {});
        return accessSetify(addr, Object.keys(storageKeys).sort());
    });
    result.sort(function (a, b) { return (a.address.localeCompare(b.address)); });
    return result;
}
exports.accessListify = accessListify;
function formatAccessList(value) {
    return accessListify(value).map(function (set) { return [set.address, set.storageKeys]; });
}
function _serializeEip1559(transaction, signature) {
    // If there is an explicit gasPrice, make sure it matches the
    // EIP-1559 fees; otherwise they may not understand what they
    // think they are setting in terms of fee.
    if (transaction.gasPrice != null) {
        var gasPrice = bignumber_1.BigNumber.from(transaction.gasPrice);
        var maxFeePerGas = bignumber_1.BigNumber.from(transaction.maxFeePerGas || 0);
        if (!gasPrice.eq(maxFeePerGas)) {
            logger.throwArgumentError("mismatch EIP-1559 gasPrice != maxFeePerGas", "tx", {
                gasPrice: gasPrice,
                maxFeePerGas: maxFeePerGas
            });
        }
    }
    var fields = [
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
        var sig = (0, bytes_1.splitSignature)(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push((0, bytes_1.stripZeros)(sig.r));
        fields.push((0, bytes_1.stripZeros)(sig.s));
    }
    return (0, bytes_1.hexConcat)(["0x02", RLP.encode(fields)]);
}
function _serializeEip2930(transaction, signature) {
    var fields = [
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
        var sig = (0, bytes_1.splitSignature)(signature);
        fields.push(formatNumber(sig.recoveryParam, "recoveryParam"));
        fields.push((0, bytes_1.stripZeros)(sig.r));
        fields.push((0, bytes_1.stripZeros)(sig.s));
    }
    return (0, bytes_1.hexConcat)(["0x01", RLP.encode(fields)]);
}
// Legacy Transactions and EIP-155
function _serialize(transaction, signature) {
    (0, properties_1.checkProperties)(transaction, allowedTransactionKeys);
    var raw = [];
    transactionFields.forEach(function (fieldInfo) {
        var value = transaction[fieldInfo.name] || ([]);
        var options = {};
        if (fieldInfo.numeric) {
            options.hexPad = "left";
        }
        value = (0, bytes_1.arrayify)((0, bytes_1.hexlify)(value, options));
        // Fixed-width field
        if (fieldInfo.length && value.length !== fieldInfo.length && value.length > 0) {
            logger.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value);
        }
        // Variable-width (with a maximum)
        if (fieldInfo.maxLength) {
            value = (0, bytes_1.stripZeros)(value);
            if (value.length > fieldInfo.maxLength) {
                logger.throwArgumentError("invalid length for " + fieldInfo.name, ("transaction:" + fieldInfo.name), value);
            }
        }
        raw.push((0, bytes_1.hexlify)(value));
    });
    var chainId = 0;
    if (transaction.chainId != null) {
        // A chainId was provided; if non-zero we'll use EIP-155
        chainId = transaction.chainId;
        if (typeof (chainId) !== "number") {
            logger.throwArgumentError("invalid transaction.chainId", "transaction", transaction);
        }
    }
    else if (signature && !(0, bytes_1.isBytesLike)(signature) && signature.v > 28) {
        // No chainId provided, but the signature is signing with EIP-155; derive chainId
        chainId = Math.floor((signature.v - 35) / 2);
    }
    // We have an EIP-155 transaction (chainId was specified and non-zero)
    if (chainId !== 0) {
        raw.push((0, bytes_1.hexlify)(chainId)); // @TODO: hexValue?
        raw.push("0x");
        raw.push("0x");
    }
    // Requesting an unsigned transaction
    if (!signature) {
        return RLP.encode(raw);
    }
    // The splitSignature will ensure the transaction has a recoveryParam in the
    // case that the signTransaction function only adds a v.
    var sig = (0, bytes_1.splitSignature)(signature);
    // We pushed a chainId and null r, s on for hashing only; remove those
    var v = 27 + sig.recoveryParam;
    if (chainId !== 0) {
        raw.pop();
        raw.pop();
        raw.pop();
        v += chainId * 2 + 8;
        // If an EIP-155 v (directly or indirectly; maybe _vs) was provided, check it!
        if (sig.v > 28 && sig.v !== v) {
            logger.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
        }
    }
    else if (sig.v !== v) {
        logger.throwArgumentError("transaction.chainId/signature.v mismatch", "signature", signature);
    }
    raw.push((0, bytes_1.hexlify)(v));
    raw.push((0, bytes_1.stripZeros)((0, bytes_1.arrayify)(sig.r)));
    raw.push((0, bytes_1.stripZeros)((0, bytes_1.arrayify)(sig.s)));
    return RLP.encode(raw);
}
function serialize(transaction, signature) {
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
    return logger.throwError("unsupported transaction type: " + transaction.type, logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "serializeTransaction",
        transactionType: transaction.type
    });
}
exports.serialize = serialize;
function serializeHederaTransaction(transaction) {
    var _a, _b;
    var tx;
    var arrayifiedData = transaction.data ? (0, bytes_1.arrayify)(transaction.data) : new Uint8Array();
    var gas = (0, bignumber_1.numberify)(transaction.gasLimit ? transaction.gasLimit : 0);
    if (transaction.to) {
        tx = new sdk_1.ContractExecuteTransaction()
            .setContractId(sdk_1.ContractId.fromSolidityAddress((0, utils_1.getAddressFromAccount)(transaction.to)))
            .setFunctionParameters(arrayifiedData)
            .setGas(gas);
        if (transaction.value) {
            tx.setPayableAmount((_a = transaction.value) === null || _a === void 0 ? void 0 : _a.toString());
        }
    }
    else {
        if (transaction.customData.bytecodeFileId) {
            tx = new sdk_1.ContractCreateTransaction()
                .setBytecodeFileId(transaction.customData.bytecodeFileId)
                .setConstructorParameters(arrayifiedData)
                .setInitialBalance((_b = transaction.value) === null || _b === void 0 ? void 0 : _b.toString())
                .setGas(gas);
        }
        else {
            if (transaction.customData.fileChunk && transaction.customData.fileId) {
                tx = new sdk_1.FileAppendTransaction()
                    .setContents(transaction.customData.fileChunk)
                    .setFileId(transaction.customData.fileId);
            }
            else if (!transaction.customData.fileId && transaction.customData.fileChunk) {
                // only a chunk, thus the first one
                tx = new sdk_1.FileCreateTransaction()
                    .setContents(transaction.customData.fileChunk)
                    .setKeys([transaction.customData.fileKey ?
                        transaction.customData.fileKey :
                        sdk_1.PublicKey.fromString(this._signingKey().compressedPublicKey)]);
            }
            else if (transaction.customData.publicKey) {
                var _c = transaction.customData, publicKey = _c.publicKey, initialBalance = _c.initialBalance;
                tx = new sdk_1.AccountCreateTransaction()
                    .setKey(sdk_1.PublicKey.fromString(publicKey.toString()))
                    .setInitialBalance(sdk_1.Hbar.fromTinybars(initialBalance.toString()));
            }
            else {
                logger.throwArgumentError("Cannot determine transaction type from given custom data. Need either `to`, `fileChunk`, `fileId` or `bytecodeFileId`", logger_1.Logger.errors.INVALID_ARGUMENT, transaction);
            }
        }
    }
    var account = (0, address_1.getAccountFromAddress)(transaction.from.toString());
    tx.setTransactionId(sdk_1.TransactionId.generate(new sdk_1.AccountId({
        shard: (0, bignumber_1.numberify)(account.shard),
        realm: (0, bignumber_1.numberify)(account.realm),
        num: (0, bignumber_1.numberify)(account.num)
    })))
        .setNodeAccountIds([sdk_1.AccountId.fromString(transaction.nodeId.toString())])
        .freeze();
    return tx;
}
exports.serializeHederaTransaction = serializeHederaTransaction;
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
function parse(rawTransaction) {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
        var payload, parsed, contents, _b;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    payload = (0, bytes_1.arrayify)(rawTransaction);
                    try {
                        parsed = sdk_1.Transaction.fromBytes(payload);
                    }
                    catch (error) {
                        logger.throwArgumentError(error.message, "rawTransaction", rawTransaction);
                    }
                    _c = {};
                    _b = bytes_1.hexlify;
                    return [4 /*yield*/, parsed.getTransactionHash()];
                case 1:
                    contents = (_c.hash = _b.apply(void 0, [_d.sent()]),
                        _c.from = (0, utils_1.getAddressFromAccount)(parsed.transactionId.accountId.toString()),
                        _c);
                    if (parsed instanceof sdk_1.ContractExecuteTransaction) {
                        parsed = parsed;
                        contents.to = (0, utils_1.getAddressFromAccount)((_a = parsed.contractId) === null || _a === void 0 ? void 0 : _a.toString());
                        contents.gasLimit = handleNumber(parsed.gas.toString());
                        contents.value = parsed.payableAmount ?
                            handleNumber(parsed.payableAmount.toBigNumber().toString()) : handleNumber('0');
                        contents.data = parsed.functionParameters ? (0, bytes_1.hexlify)(parsed.functionParameters) : '0x';
                    }
                    else if (parsed instanceof sdk_1.ContractCreateTransaction) {
                        parsed = parsed;
                        contents.gasLimit = handleNumber(parsed.gas.toString());
                        contents.value = parsed.initialBalance ?
                            handleNumber(parsed.initialBalance.toBigNumber().toString()) : handleNumber('0');
                        // TODO IMPORTANT! We are setting only the constructor arguments and not the whole bytecode + constructor args
                        contents.data = parsed.constructorParameters ? (0, bytes_1.hexlify)(parsed.constructorParameters) : '0x';
                    }
                    else if (parsed instanceof sdk_1.FileCreateTransaction) {
                        parsed = parsed;
                        contents.data = (0, bytes_1.hexlify)(Buffer.from(parsed.contents));
                    }
                    else if (parsed instanceof sdk_1.FileAppendTransaction) {
                        parsed = parsed;
                        contents.data = (0, bytes_1.hexlify)(Buffer.from(parsed.contents));
                    }
                    else if (parsed instanceof sdk_1.TransferTransaction) {
                        // TODO populate value / to?
                    }
                    else if (parsed instanceof sdk_1.AccountCreateTransaction) {
                        parsed = parsed;
                        contents.value = parsed.initialBalance ?
                            handleNumber(parsed.initialBalance.toBigNumber().toString()) : handleNumber('0');
                    }
                    else {
                        return [2 /*return*/, logger.throwError("unsupported transaction", logger_1.Logger.errors.UNSUPPORTED_OPERATION, { operation: "parse" })];
                    }
                    // TODO populate r, s ,v
                    return [2 /*return*/, __assign(__assign({}, contents), { nonce: 0, gasPrice: handleNumber('0'), chainId: 0, r: '', s: '', v: 0, type: null })];
            }
        });
    });
}
exports.parse = parse;
//# sourceMappingURL=index.js.map