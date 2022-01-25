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
import { Provider } from "@ethersproject/abstract-provider";
import { Base58 } from "@ethersproject/basex";
import { BigNumber } from "@ethersproject/bignumber";
import { arrayify, concat, hexDataLength, hexDataSlice, hexlify, hexZeroPad, isHexString } from "@ethersproject/bytes";
import { getNetwork } from "@ethersproject/networks";
import { defineReadOnly, getStatic, resolveProperties } from "@ethersproject/properties";
import { sha256 } from "@ethersproject/sha2";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { poll } from "@ethersproject/web";
import bech32 from "bech32";
import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
const logger = new Logger(version);
import { Formatter } from "./formatter";
import { asAccountString } from "@ethersproject/address";
import { AccountBalanceQuery, AccountId, Client, NetworkName, Transaction as HederaTransaction } from "@hashgraph/sdk";
import axios from "axios";
//////////////////////////////
// Event Serializeing
// @ts-ignore
function checkTopic(topic) {
    if (topic == null) {
        return "null";
    }
    if (hexDataLength(topic) !== 32) {
        logger.throwArgumentError("invalid topic", "topic", topic);
    }
    return topic.toLowerCase();
}
// @ts-ignore
function serializeTopics(topics) {
    // Remove trailing null AND-topics; they are redundant
    topics = topics.slice();
    while (topics.length > 0 && topics[topics.length - 1] == null) {
        topics.pop();
    }
    return topics.map((topic) => {
        if (Array.isArray(topic)) {
            // Only track unique OR-topics
            const unique = {};
            topic.forEach((topic) => {
                unique[checkTopic(topic)] = true;
            });
            // The order of OR-topics does not matter
            const sorted = Object.keys(unique);
            sorted.sort();
            return sorted.join("|");
        }
        else {
            return checkTopic(topic);
        }
    }).join("&");
}
function deserializeTopics(data) {
    if (data === "") {
        return [];
    }
    return data.split(/&/g).map((topic) => {
        if (topic === "") {
            return [];
        }
        const comps = topic.split("|").map((topic) => {
            return ((topic === "null") ? null : topic);
        });
        return ((comps.length === 1) ? comps[0] : comps);
    });
}
//////////////////////////////
// Helper Object
function stall(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}
//////////////////////////////
// Provider Object
/**
 *  EventType
 *   - "block"
 *   - "poll"
 *   - "didPoll"
 *   - "pending"
 *   - "error"
 *   - "network"
 *   - filter
 *   - topics array
 *   - transaction hash
 */
const PollableEvents = ["block", "network", "pending", "poll"];
export class Event {
    constructor(tag, listener, once) {
        defineReadOnly(this, "tag", tag);
        defineReadOnly(this, "listener", listener);
        defineReadOnly(this, "once", once);
    }
    get event() {
        switch (this.type) {
            case "tx":
                return this.hash;
            case "filter":
                return this.filter;
        }
        return this.tag;
    }
    get type() {
        return this.tag.split(":")[0];
    }
    get hash() {
        const comps = this.tag.split(":");
        if (comps[0] !== "tx") {
            return null;
        }
        return comps[1];
    }
    get filter() {
        const comps = this.tag.split(":");
        if (comps[0] !== "filter") {
            return null;
        }
        const address = comps[1];
        const topics = deserializeTopics(comps[2]);
        const filter = {};
        if (topics.length > 0) {
            filter.topics = topics;
        }
        if (address && address !== "*") {
            filter.address = address;
        }
        return filter;
    }
    pollable() {
        return (this.tag.indexOf(":") >= 0 || PollableEvents.indexOf(this.tag) >= 0);
    }
}
;
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const coinInfos = {
    "0": { symbol: "btc", p2pkh: 0x00, p2sh: 0x05, prefix: "bc" },
    "2": { symbol: "ltc", p2pkh: 0x30, p2sh: 0x32, prefix: "ltc" },
    "3": { symbol: "doge", p2pkh: 0x1e, p2sh: 0x16 },
    "60": { symbol: "eth", ilk: "eth" },
    "61": { symbol: "etc", ilk: "eth" },
    "700": { symbol: "xdai", ilk: "eth" },
};
function bytes32ify(value) {
    return hexZeroPad(BigNumber.from(value).toHexString(), 32);
}
// Compute the Base58Check encoded data (checksum is first 4 bytes of sha256d)
function base58Encode(data) {
    return Base58.encode(concat([data, hexDataSlice(sha256(sha256(data)), 0, 4)]));
}
export class Resolver {
    // The resolvedAddress is only for creating a ReverseLookup resolver
    constructor(provider, address, name, resolvedAddress) {
        defineReadOnly(this, "provider", provider);
        defineReadOnly(this, "name", name);
        defineReadOnly(this, "address", provider.formatter.address(address));
        defineReadOnly(this, "_resolvedAddress", resolvedAddress);
    }
    _fetchBytes(selector, parameters) {
        return __awaiter(this, void 0, void 0, function* () {
            // e.g. keccak256("addr(bytes32,uint256)")
            // const tx = {
            //     to: this.address,
            //     data: hexConcat([ selector, namehash(this.name), (parameters || "0x") ])
            // };
            try {
                // return _parseBytes(await this.provider.call(tx));
                return null;
            }
            catch (error) {
                if (error.code === Logger.errors.CALL_EXCEPTION) {
                    return null;
                }
                return null;
            }
        });
    }
    _getAddress(coinType, hexBytes) {
        const coinInfo = coinInfos[String(coinType)];
        if (coinInfo == null) {
            logger.throwError(`unsupported coin type: ${coinType}`, Logger.errors.UNSUPPORTED_OPERATION, {
                operation: `getAddress(${coinType})`
            });
        }
        if (coinInfo.ilk === "eth") {
            return this.provider.formatter.address(hexBytes);
        }
        const bytes = arrayify(hexBytes);
        // P2PKH: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        if (coinInfo.p2pkh != null) {
            const p2pkh = hexBytes.match(/^0x76a9([0-9a-f][0-9a-f])([0-9a-f]*)88ac$/);
            if (p2pkh) {
                const length = parseInt(p2pkh[1], 16);
                if (p2pkh[2].length === length * 2 && length >= 1 && length <= 75) {
                    return base58Encode(concat([[coinInfo.p2pkh], ("0x" + p2pkh[2])]));
                }
            }
        }
        // P2SH: OP_HASH160 <scriptHash> OP_EQUAL
        if (coinInfo.p2sh != null) {
            const p2sh = hexBytes.match(/^0xa9([0-9a-f][0-9a-f])([0-9a-f]*)87$/);
            if (p2sh) {
                const length = parseInt(p2sh[1], 16);
                if (p2sh[2].length === length * 2 && length >= 1 && length <= 75) {
                    return base58Encode(concat([[coinInfo.p2sh], ("0x" + p2sh[2])]));
                }
            }
        }
        // Bech32
        if (coinInfo.prefix != null) {
            const length = bytes[1];
            // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#witness-program
            let version = bytes[0];
            if (version === 0x00) {
                if (length !== 20 && length !== 32) {
                    version = -1;
                }
            }
            else {
                version = -1;
            }
            if (version >= 0 && bytes.length === 2 + length && length >= 1 && length <= 75) {
                const words = bech32.toWords(bytes.slice(2));
                words.unshift(version);
                return bech32.encode(coinInfo.prefix, words);
            }
        }
        return null;
    }
    getAddress(coinType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (coinType == null) {
                coinType = 60;
            }
            // If Ethereum, use the standard `addr(bytes32)`
            if (coinType === 60) {
                try {
                    return null;
                }
                catch (error) {
                    if (error.code === Logger.errors.CALL_EXCEPTION) {
                        return null;
                    }
                    throw error;
                }
            }
            // keccak256("addr(bytes32,uint256")
            const hexBytes = yield this._fetchBytes("0xf1cb7e06", bytes32ify(coinType));
            // No address
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            // Compute the address
            const address = this._getAddress(coinType, hexBytes);
            if (address == null) {
                logger.throwError(`invalid or unsupported coin data`, Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: `getAddress(${coinType})`,
                    coinType: coinType,
                    data: hexBytes
                });
            }
            return address;
        });
    }
    getContentHash() {
        return __awaiter(this, void 0, void 0, function* () {
            // keccak256("contenthash()")
            const hexBytes = yield this._fetchBytes("0xbc1c58d1");
            // No contenthash
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            // IPFS (CID: 1, Type: DAG-PB)
            const ipfs = hexBytes.match(/^0xe3010170(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
            if (ipfs) {
                const length = parseInt(ipfs[3], 16);
                if (ipfs[4].length === length * 2) {
                    return "ipfs:/\/" + Base58.encode("0x" + ipfs[1]);
                }
            }
            // Swarm (CID: 1, Type: swarm-manifest; hash/length hard-coded to keccak256/32)
            const swarm = hexBytes.match(/^0xe40101fa011b20([0-9a-f]*)$/);
            if (swarm) {
                if (swarm[1].length === (32 * 2)) {
                    return "bzz:/\/" + swarm[1];
                }
            }
            return logger.throwError(`invalid or unsupported content hash data`, Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "getContentHash()",
                data: hexBytes
            });
        });
    }
    getText(key) {
        return __awaiter(this, void 0, void 0, function* () {
            // The key encoded as parameter to fetchBytes
            let keyBytes = toUtf8Bytes(key);
            // The nodehash consumes the first slot, so the string pointer targets
            // offset 64, with the length at offset 64 and data starting at offset 96
            keyBytes = concat([bytes32ify(64), bytes32ify(keyBytes.length), keyBytes]);
            // Pad to word-size (32 bytes)
            if ((keyBytes.length % 32) !== 0) {
                keyBytes = concat([keyBytes, hexZeroPad("0x", 32 - (key.length % 32))]);
            }
            const hexBytes = yield this._fetchBytes("0x59d1d43c", hexlify(keyBytes));
            if (hexBytes == null || hexBytes === "0x") {
                return null;
            }
            return toUtf8String(hexBytes);
        });
    }
}
let defaultFormatter = null;
export class BaseProvider extends Provider {
    /**
     *  ready
     *
     *  A Promise<Network> that resolves only once the provider is ready.
     *
     *  Sub-classes that call the super with a network without a chainId
     *  MUST set this. Standard named networks have a known chainId.
     *
     */
    constructor(network) {
        logger.checkNew(new.target, Provider);
        super();
        this.formatter = new.target.getFormatter();
        // If network is any, this Provider allows the underlying
        // network to change dynamically, and we auto-detect the
        // current network
        defineReadOnly(this, "anyNetwork", (network === "any"));
        if (this.anyNetwork) {
            network = this.detectNetwork();
        }
        if (network instanceof Promise) {
            this._networkPromise = network;
            // Squash any "unhandled promise" errors; that do not need to be handled
            network.catch((error) => { });
            // Trigger initial network setting (async)
            this._ready().catch((error) => { });
        }
        else {
            if (!isHederaNetworkConfigLike(network)) {
                const asDefaultNetwork = network;
                // defineReadOnly(this, "_network", getNetwork(network));
                this._network = getNetwork(asDefaultNetwork);
                this._networkPromise = Promise.resolve(this._network);
                const knownNetwork = getStatic(new.target, "getNetwork")(asDefaultNetwork);
                if (knownNetwork) {
                    defineReadOnly(this, "_network", knownNetwork);
                    this.emit("network", knownNetwork, null);
                }
                else {
                    logger.throwArgumentError("invalid network", "network", network);
                }
                this.hederaClient = Client.forName(mapNetworkToHederaNetworkName(asDefaultNetwork));
                this._mirrorNodeUrl = resolveMirrorNetworkUrl(this._network);
            }
            else {
                const asHederaNetwork = network;
                this.hederaClient = Client.forNetwork(asHederaNetwork.network);
                this._mirrorNodeUrl = asHederaNetwork.mirrorNodeUrl;
                defineReadOnly(this, "_network", {
                    // FIXME: chainId
                    chainId: 0,
                    name: this.hederaClient.networkName
                });
            }
        }
    }
    _ready() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._network == null) {
                let network = null;
                if (this._networkPromise) {
                    try {
                        network = yield this._networkPromise;
                    }
                    catch (error) { }
                }
                // Try the Provider's network detection (this MUST throw if it cannot)
                if (network == null) {
                    network = yield this.detectNetwork();
                }
                // This should never happen; every Provider sub-class should have
                // suggested a network by here (or have thrown).
                // if (!network) {
                //     logger.throwError("no network detected", Logger.errors.UNKNOWN_ERROR, { });
                // }
                // Possible this call stacked so do not call defineReadOnly again
                if (this._network == null) {
                    if (this.anyNetwork) {
                        // this._network = network;
                        defineReadOnly(this, "_network", network);
                    }
                    else {
                        this._network = network;
                    }
                    this.emit("network", network, null);
                }
            }
            return this._network;
        });
    }
    // @TODO: Remove this and just create a singleton formatter
    static getFormatter() {
        if (defaultFormatter == null) {
            defaultFormatter = new Formatter();
        }
        return defaultFormatter;
    }
    // @TODO: Remove this and just use getNetwork
    static getNetwork(network) {
        return getNetwork((network == null) ? "mainnet" : network);
    }
    get network() {
        return this._network;
    }
    // This method should query the network if the underlying network
    // can change, such as when connected to a JSON-RPC backend
    // With the current hedera implementation, we do not support a changeable networks,
    // thus we do not need to query at this level
    detectNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            this._networkPromise = Promise.resolve(this._network);
            return this._networkPromise;
        });
    }
    getNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            const network = yield this._ready();
            // Make sure we are still connected to the same network; this is
            // only an external call for backends which can have the underlying
            // network change spontaneously
            const currentNetwork = yield this.detectNetwork();
            if (network.chainId !== currentNetwork.chainId) {
                // We are allowing network changes, things can get complex fast;
                // make sure you know what you are doing if you use "any"
                if (this.anyNetwork) {
                    this._network = currentNetwork;
                    // The "network" event MUST happen before this method resolves
                    // so any events have a chance to unregister, so we stall an
                    // additional event loop before returning from /this/ call
                    this.emit("network", currentNetwork, network);
                    yield stall(0);
                    return this._network;
                }
                const error = logger.makeError("underlying network changed", Logger.errors.NETWORK_ERROR, {
                    event: "changed",
                    network: network,
                    detectedNetwork: currentNetwork
                });
                this.emit("error", error);
                throw error;
            }
            return network;
        });
    }
    waitForTransaction(transactionHash, confirmations, timeout) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._waitForTransaction(transactionHash, (confirmations == null) ? 1 : confirmations, timeout || 0, null);
        });
    }
    _waitForTransaction(transactionHash, confirmations, timeout, replaceable) {
        return __awaiter(this, void 0, void 0, function* () {
            return logger.throwError("NOT_SUPPORTED", Logger.errors.UNSUPPORTED_OPERATION);
        });
    }
    /**
     *  AccountBalance query implementation, using the hashgraph sdk.
     *  It returns the tinybar balance of the given address.
     *
     * @param accountLike The address to check balance of
     */
    getBalance(accountLike) {
        return __awaiter(this, void 0, void 0, function* () {
            accountLike = yield accountLike;
            const account = asAccountString(accountLike);
            try {
                const balance = yield new AccountBalanceQuery()
                    .setAccountId(AccountId.fromString(account))
                    .execute(this.hederaClient);
                return BigNumber.from(balance.hbars.toTinybars().toNumber());
            }
            catch (error) {
                return logger.throwError("bad result from backend", Logger.errors.SERVER_ERROR, {
                    method: "AccountBalanceQuery",
                    params: { address: accountLike },
                    error
                });
            }
        });
    }
    getCode(addressOrName, blockTag) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({
                address: this._getAddress(addressOrName),
            });
            const result = yield this.perform("getCode", params);
            try {
                return hexlify(result);
            }
            catch (error) {
                return logger.throwError("bad result from backend", Logger.errors.SERVER_ERROR, {
                    method: "getCode",
                    params, result, error
                });
            }
        });
    }
    // This should be called by any subclass wrapping a TransactionResponse
    _wrapTransaction(tx, hash, receipt) {
        if (hash != null && hexDataLength(hash) !== 48) {
            throw new Error("invalid response - sendTransaction");
        }
        const result = tx;
        if (!result.customData)
            result.customData = {};
        if (receipt && receipt.fileId) {
            result.customData.fileId = receipt.fileId.toString();
        }
        if (receipt && receipt.contractId) {
            result.customData.contractId = receipt.contractId.toSolidityAddress();
        }
        if (receipt && receipt.accountId) {
            result.customData.accountId = receipt.accountId;
        }
        // Check the hash we expect is the same as the hash the server reported
        if (hash != null && tx.hash !== hash) {
            logger.throwError("Transaction hash mismatch from Provider.sendTransaction.", Logger.errors.UNKNOWN_ERROR, { expectedHash: tx.hash, returnedHash: hash });
        }
        result.wait = (confirms, timeout) => __awaiter(this, void 0, void 0, function* () {
            if (confirms == null) {
                confirms = 1;
            }
            if (timeout == null) {
                timeout = 0;
            }
            // Get the details to detect replacement
            let replacement = undefined;
            if (confirms !== 0) {
                replacement = {
                    data: tx.data,
                    from: tx.from,
                    nonce: tx.nonce,
                    to: tx.to,
                    value: tx.value,
                    startBlock: 0
                };
            }
            const receipt = yield this._waitForTransaction(tx.hash, confirms, timeout, replacement);
            if (receipt == null && confirms === 0) {
                return null;
            }
            if (receipt.status === 0) {
                logger.throwError("transaction failed", Logger.errors.CALL_EXCEPTION, {
                    transactionHash: tx.hash,
                    transaction: tx,
                    receipt: receipt
                });
            }
            return receipt;
        });
        return result;
    }
    getHederaClient() {
        return this.hederaClient;
    }
    getHederaNetworkConfig() {
        return this.hederaClient._network.getNodeAccountIdsForExecute();
    }
    sendTransaction(signedTransaction) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            signedTransaction = yield signedTransaction;
            const txBytes = arrayify(signedTransaction);
            const hederaTx = HederaTransaction.fromBytes(txBytes);
            const ethersTx = yield this.formatter.transaction(signedTransaction);
            const txHash = hexlify(yield hederaTx.getTransactionHash());
            try {
                // TODO once we have fallback provider use `provider.perform("sendTransaction")`
                // TODO Before submission verify that the nodeId is the one that the provider is connected to
                const resp = yield hederaTx.execute(this.hederaClient);
                const receipt = yield resp.getReceipt(this.hederaClient);
                return this._wrapTransaction(ethersTx, txHash, receipt);
            }
            catch (error) {
                const err = logger.makeError(error.message, (_a = error.status) === null || _a === void 0 ? void 0 : _a.toString());
                err.transaction = ethersTx;
                err.transactionHash = txHash;
                throw err;
            }
        });
    }
    _getFilter(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            filter = yield filter;
            const result = {};
            if (filter.address != null) {
                result.address = this._getAddress(filter.address);
            }
            ["blockHash", "topics"].forEach((key) => {
                if (filter[key] == null) {
                    return;
                }
                result[key] = filter[key];
            });
            ["fromBlock", "toBlock"].forEach((key) => {
                if (filter[key] == null) {
                    return;
                }
            });
            return this.formatter.filter(yield resolveProperties(result));
        });
    }
    estimateGas(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            return logger.throwArgumentError("estimateGas not implemented", Logger.errors.NOT_IMPLEMENTED, {
                operation: "estimateGas"
            });
        });
    }
    // TODO FIX ME
    _getAddress(addressOrName) {
        return __awaiter(this, void 0, void 0, function* () {
            addressOrName = yield addressOrName;
            if (typeof (addressOrName) !== "string") {
                logger.throwArgumentError("invalid address or ENS name", "name", addressOrName);
            }
            const address = yield this.resolveName(addressOrName);
            if (address == null) {
                logger.throwError("ENS name not configured", Logger.errors.UNSUPPORTED_OPERATION, {
                    operation: `resolveName(${JSON.stringify(addressOrName)})`
                });
            }
            return address;
        });
    }
    /**
     * Transaction record query implementation using the mirror node REST API.
     *
     * @param txId - id of the transaction to search for
     */
    getTransaction(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getNetwork();
            txId = yield txId;
            const ep = '/api/v1/transactions/' + txId;
            let { data } = yield axios.get(this._mirrorNodeUrl + ep);
            const filtered = data.transactions
                .filter((e) => e.result === "SUCCESS");
            return filtered.length > 0 ? filtered[0] : null;
        });
    }
    getTransactionReceipt(transactionHash) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getNetwork();
            transactionHash = yield transactionHash;
            const params = { transactionHash: this.formatter.hash(transactionHash, true) };
            return poll(() => __awaiter(this, void 0, void 0, function* () {
                const result = yield this.perform("getTransactionReceipt", params);
                if (result == null) {
                    return undefined;
                }
                // "geth-etc" returns receipts before they are ready
                if (result.blockHash == null) {
                    return undefined;
                }
                return this.formatter.receipt(result);
            }), { oncePoll: this });
        });
    }
    getLogs(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getNetwork();
            const params = yield resolveProperties({ filter: this._getFilter(filter) });
            const logs = yield this.perform("getLogs", params);
            logs.forEach((log) => {
                if (log.removed == null) {
                    log.removed = false;
                }
            });
            return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
        });
    }
    getHbarPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            return logger.throwError("NOT_IMPLEMENTED", Logger.errors.NOT_IMPLEMENTED);
        });
    }
    // TODO FIXME
    getResolver(name) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const address = yield this._getResolver(name);
                if (address == null) {
                    return null;
                }
                return new Resolver(this, address, name);
            }
            catch (error) {
                if (error.code === Logger.errors.CALL_EXCEPTION) {
                    return null;
                }
                return null;
            }
        });
    }
    // TODO FIXME
    _getResolver(name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the resolver from the blockchain
            const network = yield this.getNetwork();
            // No ENS...
            if (!network.ensAddress) {
                logger.throwError("network does not support ENS", Logger.errors.UNSUPPORTED_OPERATION, { operation: "ENS", network: network.name });
            }
            // keccak256("resolver(bytes32)")
            // const transaction = {
            //     to: network.ensAddress,
            //     data: ("0x0178b8bf" + namehash(name).substring(2))
            // };
            try {
                return null;
                // return this.formatter.callAddress(await this.call(transaction));
            }
            catch (error) {
                if (error.code === Logger.errors.CALL_EXCEPTION) {
                    return null;
                }
                throw error;
            }
        });
    }
    // TODO FIXME
    resolveName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            name = yield name;
            // If it is already an address, nothing to resolve
            try {
                return Promise.resolve(this.formatter.address(name));
            }
            catch (error) {
                // If is is a hexstring, the address is bad (See #694)
                if (isHexString(name)) {
                    throw error;
                }
            }
            if (typeof (name) !== "string") {
                logger.throwArgumentError("invalid ENS name", "name", name);
            }
            // Get the addr from the resovler
            const resolver = yield this.getResolver(name);
            if (!resolver) {
                return null;
            }
            return yield resolver.getAddress();
        });
    }
    // TODO FIXME
    lookupAddress(address) {
        return __awaiter(this, void 0, void 0, function* () {
            address = yield address;
            address = this.formatter.address(address);
            return null;
        });
    }
    perform(method, params) {
        return logger.throwError(method + " not implemented", Logger.errors.NOT_IMPLEMENTED, { operation: method });
    }
    _addEventListener(eventName, listener, once) {
        return this;
    }
    on(eventName, listener) {
        return this._addEventListener(eventName, listener, false);
    }
    once(eventName, listener) {
        return this._addEventListener(eventName, listener, true);
    }
    emit(eventName, ...args) {
        return false;
    }
    listenerCount(eventName) {
        return 0;
    }
    listeners(eventName) {
        return null;
    }
    off(eventName, listener) {
        return this;
    }
    removeAllListeners(eventName) {
        return this;
    }
}
// resolves network string to a hedera network name
function mapNetworkToHederaNetworkName(net) {
    switch (net) {
        case 'mainnet':
            return NetworkName.Mainnet;
        case 'previewnet':
            return NetworkName.Previewnet;
        case 'testnet':
            return NetworkName.Testnet;
        default:
            logger.throwArgumentError("Invalid network name", "network", net);
            return null;
    }
}
// resolves the mirror node url from the given provider network.
function resolveMirrorNetworkUrl(net) {
    switch (net.name) {
        case 'mainnet':
            return 'https://mainnet.mirrornode.hedera.com';
        case 'previewnet':
            return 'https://previewnet.mirrornode.hedera.com';
        case 'testnet':
            return 'https://testnet.mirrornode.hedera.com';
        default:
            logger.throwArgumentError("Invalid network name", "network", net);
            return null;
    }
}
function isHederaNetworkConfigLike(cfg) {
    return cfg.network !== undefined;
}
//# sourceMappingURL=base-provider.js.map