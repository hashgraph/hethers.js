"use strict";

import {
    BlockTag, EventType, Filter, FilterByBlockHash,
    Listener, Log, Provider, TransactionReceipt, TransactionRequest, TransactionResponse
} from "@ethersproject/abstract-provider";
import { Base58 } from "@ethersproject/basex";
import { BigNumber } from "@ethersproject/bignumber";
import { arrayify, concat, hexDataLength, hexDataSlice, hexlify, hexZeroPad, isHexString } from "@ethersproject/bytes";
import { getNetwork, Network, Networkish, HederaNetworkConfigLike } from "@ethersproject/networks";
import { Deferrable, defineReadOnly, getStatic, resolveProperties } from "@ethersproject/properties";
import { Transaction } from "@ethersproject/transactions";
import { sha256 } from "@ethersproject/sha2";
import { toUtf8Bytes, toUtf8String } from "@ethersproject/strings";
import { poll } from "@ethersproject/web";
import { TransactionReceipt as HederaTransactionReceipt } from '@hashgraph/sdk';
import bech32 from "bech32";

import { Logger } from "@ethersproject/logger";
import { version } from "./_version";
const logger = new Logger(version);

import { Formatter } from "./formatter";
import { AccountLike, asAccountString } from "@ethersproject/address";
import { AccountBalanceQuery, AccountId, Client, NetworkName, Transaction as HederaTransaction } from "@hashgraph/sdk";
import axios from "axios";

//////////////////////////////
// Event Serializeing
// @ts-ignore
function checkTopic(topic: string): string {
    if (topic == null) { return "null"; }
    if (hexDataLength(topic) !== 32) {
        logger.throwArgumentError("invalid topic", "topic", topic);
    }
    return topic.toLowerCase();
}

// @ts-ignore
function serializeTopics(topics: Array<string | Array<string>>): string {
    // Remove trailing null AND-topics; they are redundant
    topics = topics.slice();
    while (topics.length > 0 && topics[topics.length - 1] == null) { topics.pop(); }

    return topics.map((topic) => {
        if (Array.isArray(topic)) {

            // Only track unique OR-topics
            const unique: { [ topic: string ]: boolean } = { }
            topic.forEach((topic) => {
                unique[checkTopic(topic)] = true;
            });

            // The order of OR-topics does not matter
            const sorted = Object.keys(unique);
            sorted.sort();

            return sorted.join("|");

        } else {
            return checkTopic(topic);
        }
    }).join("&");
}

function deserializeTopics(data: string): Array<string | Array<string>> {
    if (data === "") { return [ ]; }

    return data.split(/&/g).map((topic) => {
        if (topic === "") { return [ ]; }

        const comps = topic.split("|").map((topic) => {
            return ((topic === "null") ? null: topic);
        });

        return ((comps.length === 1) ? comps[0]: comps);
    });
}


//////////////////////////////
// Helper Object


function stall(duration: number): Promise<void> {
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

const PollableEvents = [ "block", "network", "pending", "poll" ];

export class Event {
    readonly listener: Listener;
    readonly once: boolean;
    readonly tag: string;

    constructor(tag: string, listener: Listener, once: boolean) {
        defineReadOnly(this, "tag", tag);
        defineReadOnly(this, "listener", listener);
        defineReadOnly(this, "once", once);
    }

    get event(): EventType {
        switch (this.type) {
            case "tx":
                return this.hash;
            case "filter":
                return this.filter;
        }
        return this.tag;
    }

    get type(): string {
        return this.tag.split(":")[0]
    }

    get hash(): string {
        const comps = this.tag.split(":");
        if (comps[0] !== "tx") { return null; }
        return comps[1];
    }

    get filter(): Filter {
        const comps = this.tag.split(":");
        if (comps[0] !== "filter") { return null; }
        const address = comps[1];

        const topics = deserializeTopics(comps[2]);
        const filter: Filter = { };

        if (topics.length > 0) { filter.topics = topics; }
        if (address && address !== "*") { filter.address = address; }

        return filter;
    }

    pollable(): boolean {
        return (this.tag.indexOf(":") >= 0 || PollableEvents.indexOf(this.tag) >= 0);
    }
}

export interface EnsResolver {

    // Name this Resolver is associated with
    readonly name: string;

    // The address of the resolver
    readonly address: string;

    // Multichain address resolution (also normal address resolution)
    // See: https://eips.ethereum.org/EIPS/eip-2304
    getAddress(coinType?: 60): Promise<null | string>

    // Contenthash field
    // See: https://eips.ethereum.org/EIPS/eip-1577
    getContentHash(): Promise<null | string>;

    // Storage of text records
    // See: https://eips.ethereum.org/EIPS/eip-634
    getText(key: string): Promise<null | string>;
};

export interface EnsProvider {
    resolveName(name: string): Promise<null | string>;
    lookupAddress(address: string): Promise<null | string>;
    getResolver(name: string): Promise<null | EnsResolver>;
}

type CoinInfo = {
    symbol: string,
    ilk?: string,     // General family
    prefix?: string,  // Bech32 prefix
    p2pkh?: number,   // Pay-to-Public-Key-Hash Version
    p2sh?: number,    // Pay-to-Script-Hash Version
};

// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
const coinInfos: { [ coinType: string ]: CoinInfo } = {
    "0":   { symbol: "btc",  p2pkh: 0x00, p2sh: 0x05, prefix: "bc" },
    "2":   { symbol: "ltc",  p2pkh: 0x30, p2sh: 0x32, prefix: "ltc" },
    "3":   { symbol: "doge", p2pkh: 0x1e, p2sh: 0x16 },
    "60":  { symbol: "eth",  ilk: "eth" },
    "61":  { symbol: "etc",  ilk: "eth" },
    "700": { symbol: "xdai", ilk: "eth" },
};

function bytes32ify(value: number): string {
    return hexZeroPad(BigNumber.from(value).toHexString(), 32);
}

// Compute the Base58Check encoded data (checksum is first 4 bytes of sha256d)
function base58Encode(data: Uint8Array): string {
    return Base58.encode(concat([ data, hexDataSlice(sha256(sha256(data)), 0, 4) ]));
}

export interface Avatar {
    url: string;
    linkage: Array<{ type: string, content: string }>;
}

export class Resolver implements EnsResolver {
    readonly provider: BaseProvider;

    readonly name: string;
    readonly address: string;

    readonly _resolvedAddress: null | string;

    // The resolvedAddress is only for creating a ReverseLookup resolver
    constructor(provider: BaseProvider, address: string, name: string, resolvedAddress?: string) {
        defineReadOnly(this, "provider", provider);
        defineReadOnly(this, "name", name);
        defineReadOnly(this, "address", provider.formatter.address(address));
        defineReadOnly(this, "_resolvedAddress", resolvedAddress);
    }

    async _fetchBytes(selector: string, parameters?: string): Promise<null | string> {
        // e.g. keccak256("addr(bytes32,uint256)")
        // const tx = {
        //     to: this.address,
        //     data: hexConcat([ selector, namehash(this.name), (parameters || "0x") ])
        // };

        try {
            // return _parseBytes(await this.provider.call(tx));
            return null;
        } catch (error) {
            if (error.code === Logger.errors.CALL_EXCEPTION) { return null; }
            return null;
        }
    }

    _getAddress(coinType: number, hexBytes: string): string {
        const coinInfo = coinInfos[String(coinType)];

        if (coinInfo == null) {
            logger.throwError(`unsupported coin type: ${ coinType }`, Logger.errors.UNSUPPORTED_OPERATION, {
                operation: `getAddress(${ coinType })`
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
                    return base58Encode(concat([ [ coinInfo.p2pkh ], ("0x" + p2pkh[2]) ]));
                }
            }
        }

        // P2SH: OP_HASH160 <scriptHash> OP_EQUAL
        if (coinInfo.p2sh != null) {
            const p2sh = hexBytes.match(/^0xa9([0-9a-f][0-9a-f])([0-9a-f]*)87$/);
            if (p2sh) {
                const length = parseInt(p2sh[1], 16);
                if (p2sh[2].length === length * 2 && length >= 1 && length <= 75) {
                    return base58Encode(concat([ [ coinInfo.p2sh ], ("0x" + p2sh[2]) ]));
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
            } else {
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


    async getAddress(coinType?: number): Promise<string> {
        if (coinType == null) { coinType = 60; }

        // If Ethereum, use the standard `addr(bytes32)`
        if (coinType === 60) {
            try {
                return null;
            } catch (error) {
                if (error.code === Logger.errors.CALL_EXCEPTION) { return null; }
                throw error;
            }
        }

        // keccak256("addr(bytes32,uint256")
        const hexBytes = await this._fetchBytes("0xf1cb7e06", bytes32ify(coinType));

        // No address
        if (hexBytes == null || hexBytes === "0x") { return null; }

        // Compute the address
        const address = this._getAddress(coinType, hexBytes);

        if (address == null) {
            logger.throwError(`invalid or unsupported coin data`, Logger.errors.UNSUPPORTED_OPERATION, {
                operation: `getAddress(${ coinType })`,
                coinType: coinType,
                data: hexBytes
            });
        }

        return address;
    }

    async getContentHash(): Promise<string> {

        // keccak256("contenthash()")
        const hexBytes = await this._fetchBytes("0xbc1c58d1");

        // No contenthash
        if (hexBytes == null || hexBytes === "0x") { return null; }

        // IPFS (CID: 1, Type: DAG-PB)
        const ipfs = hexBytes.match(/^0xe3010170(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
        if (ipfs) {
            const length = parseInt(ipfs[3], 16);
            if (ipfs[4].length === length * 2) {
                return "ipfs:/\/" + Base58.encode("0x" + ipfs[1]);
            }
        }

        // Swarm (CID: 1, Type: swarm-manifest; hash/length hard-coded to keccak256/32)
        const swarm = hexBytes.match(/^0xe40101fa011b20([0-9a-f]*)$/)
        if (swarm) {
            if (swarm[1].length === (32 * 2)) {
                return "bzz:/\/" + swarm[1]
            }
        }

        return logger.throwError(`invalid or unsupported content hash data`, Logger.errors.UNSUPPORTED_OPERATION, {
            operation: "getContentHash()",
            data: hexBytes
        });
    }

    async getText(key: string): Promise<string> {

        // The key encoded as parameter to fetchBytes
        let keyBytes = toUtf8Bytes(key);

        // The nodehash consumes the first slot, so the string pointer targets
        // offset 64, with the length at offset 64 and data starting at offset 96
        keyBytes = concat([ bytes32ify(64), bytes32ify(keyBytes.length), keyBytes ]);

        // Pad to word-size (32 bytes)
        if ((keyBytes.length % 32) !== 0) {
            keyBytes = concat([ keyBytes, hexZeroPad("0x", 32 - (key.length % 32)) ])
        }

        const hexBytes = await this._fetchBytes("0x59d1d43c", hexlify(keyBytes));
        if (hexBytes == null || hexBytes === "0x") { return null; }

        return toUtf8String(hexBytes);
    }
}

let defaultFormatter: Formatter = null;

export class BaseProvider extends Provider {
    _networkPromise: Promise<Network>;
    _network: Network;

    _events: Array<Event>;

    formatter: Formatter;

    readonly anyNetwork: boolean;
    private readonly hederaClient: Client;
    private readonly _mirrorNodeUrl: string; // initial mirror node URL, which is resolved from the provider's network

    /**
     *  ready
     *
     *  A Promise<Network> that resolves only once the provider is ready.
     *
     *  Sub-classes that call the super with a network without a chainId
     *  MUST set this. Standard named networks have a known chainId.
     *
     */

    constructor(network: Networkish | Promise<Network> | HederaNetworkConfigLike) {
        logger.checkNew(new.target, Provider);
        super();

        this.formatter = new.target.getFormatter();
        // If network is any, this Provider allows the underlying
        // network to change dynamically, and we auto-detect the
        // current network
        defineReadOnly(this, "anyNetwork", (network === "any"));
        if (this.anyNetwork) { network = this.detectNetwork(); }

        if (network instanceof Promise) {
            this._networkPromise = network;
            // Squash any "unhandled promise" errors; that do not need to be handled
            network.catch((error) => { });

            // Trigger initial network setting (async)
            this._ready().catch((error) => { });

        } else {
            if (!isHederaNetworkConfigLike(network)) {
                const asDefaultNetwork = network as Network;
                // defineReadOnly(this, "_network", getNetwork(network));
                this._network = getNetwork(asDefaultNetwork);
                this._networkPromise = Promise.resolve(this._network);
                const knownNetwork = getStatic<(network: Networkish) => Network>(new.target, "getNetwork")(asDefaultNetwork);
                if (knownNetwork) {
                    defineReadOnly(this, "_network", knownNetwork);
                    this.emit("network", knownNetwork, null);
                } else {
                    logger.throwArgumentError("invalid network", "network", network);
                }
                this.hederaClient = Client.forName(mapNetworkToHederaNetworkName(asDefaultNetwork));
                this._mirrorNodeUrl = resolveMirrorNetworkUrl(this._network);
            } else {
                const asHederaNetwork = network as HederaNetworkConfigLike;
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

    async _ready(): Promise<Network> {
        if (this._network == null) {
            let network: Network = null;
            if (this._networkPromise) {
                try {
                    network = await this._networkPromise;
                } catch (error) { }
            }

            // Try the Provider's network detection (this MUST throw if it cannot)
            if (network == null) {
                network = await this.detectNetwork();
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
                } else {
                    this._network = network;
                }
                this.emit("network", network, null);
            }
        }

        return this._network;
    }

    // @TODO: Remove this and just create a singleton formatter
    static getFormatter(): Formatter {
        if (defaultFormatter == null) {
            defaultFormatter = new Formatter();
        }
        return defaultFormatter;
    }

    // @TODO: Remove this and just use getNetwork
    static getNetwork(network: Networkish): Network {
        return getNetwork((network == null) ? "mainnet": network);
    }

    get network(): Network {
        return this._network;
    }

    // This method should query the network if the underlying network
    // can change, such as when connected to a JSON-RPC backend
    // With the current hedera implementation, we do not support a changeable networks,
    // thus we do not need to query at this level
    async detectNetwork(): Promise<Network> {
        this._networkPromise = Promise.resolve(this._network);
        return this._networkPromise;
    }

    async getNetwork(): Promise<Network> {
        const network = await this._ready();

        // Make sure we are still connected to the same network; this is
        // only an external call for backends which can have the underlying
        // network change spontaneously
        const currentNetwork = await this.detectNetwork();
        if (network.chainId !== currentNetwork.chainId) {

            // We are allowing network changes, things can get complex fast;
            // make sure you know what you are doing if you use "any"
            if (this.anyNetwork) {
                this._network = currentNetwork;
                // The "network" event MUST happen before this method resolves
                // so any events have a chance to unregister, so we stall an
                // additional event loop before returning from /this/ call
                this.emit("network", currentNetwork, network);
                await stall(0);

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
    }

    async waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number): Promise<TransactionReceipt> {
        return this._waitForTransaction(transactionHash, (confirmations == null) ? 1: confirmations, timeout || 0, null);
    }

    async _waitForTransaction(transactionHash: string, confirmations: number, timeout: number, replaceable: { data: string, from: string, nonce: number, to: string, value: BigNumber, startBlock: number }): Promise<TransactionReceipt> {
        return logger.throwError("NOT_SUPPORTED", Logger.errors.UNSUPPORTED_OPERATION);
    }

    /**
     *  AccountBalance query implementation, using the hashgraph sdk.
     *  It returns the tinybar balance of the given address.
     *
     * @param accountLike The address to check balance of
     */
    async getBalance(accountLike: AccountLike | Promise<AccountLike>): Promise<BigNumber> {
        accountLike = await accountLike;
        const account = asAccountString(accountLike);
        try {
            const balance = await new AccountBalanceQuery()
                .setAccountId(AccountId.fromString(account))
                .execute(this.hederaClient);
            return BigNumber.from(balance.hbars.toTinybars().toNumber());
        } catch (error) {
            return logger.throwError("bad result from backend", Logger.errors.SERVER_ERROR, {
                method: "AccountBalanceQuery",
                params: {address: accountLike},
                error
            });
        }
    }

    async getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string> {
        await this.getNetwork();
        const params = await resolveProperties({
            address: this._getAddress(addressOrName),
        });

        const result = await this.perform("getCode", params);
        try {
            return hexlify(result);
        } catch (error) {
            return logger.throwError("bad result from backend", Logger.errors.SERVER_ERROR, {
                method: "getCode",
                params, result, error
            });
        }
    }

    // This should be called by any subclass wrapping a TransactionResponse
    _wrapTransaction(tx: Transaction, hash?: string, receipt?: HederaTransactionReceipt): TransactionResponse {
        if (hash != null && hexDataLength(hash) !== 48) { throw new Error("invalid response - sendTransaction"); }

        const result = <TransactionResponse>tx;
        if (!result.customData) result.customData = {};
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

        result.wait = async (confirms?: number, timeout?: number) => {
            if (confirms == null) { confirms = 1; }
            if (timeout == null) { timeout = 0; }

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

            const receipt = await this._waitForTransaction(tx.hash, confirms, timeout, replacement);
            if (receipt == null && confirms === 0) { return null; }

            if (receipt.status === 0) {
                logger.throwError("transaction failed", Logger.errors.CALL_EXCEPTION, {
                    transactionHash: tx.hash,
                    transaction: tx,
                    receipt: receipt
                });
            }
            return receipt;
        };

        return result;
    }

    public getHederaClient() : Client {
        return this.hederaClient;
    }

    public getHederaNetworkConfig(): AccountId[] {
        return this.hederaClient._network.getNodeAccountIdsForExecute();
    }

    async sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse> {
        signedTransaction = await signedTransaction;
        const txBytes = arrayify(signedTransaction);
        const hederaTx = HederaTransaction.fromBytes(txBytes);
        const ethersTx = await this.formatter.transaction(signedTransaction);
        const txHash = hexlify(await hederaTx.getTransactionHash());
        try {
            // TODO once we have fallback provider use `provider.perform("sendTransaction")`
            // TODO Before submission verify that the nodeId is the one that the provider is connected to
            const resp = await hederaTx.execute(this.hederaClient);
            const receipt = await resp.getReceipt(this.hederaClient);
            return this._wrapTransaction(ethersTx, txHash, receipt);
        } catch (error) {
            const err = logger.makeError(error.message, error.status?.toString());
            (<any>err).transaction = ethersTx;
            (<any>err).transactionHash = txHash;
            throw  err;
        }
    }

    async _getFilter(filter: Filter | FilterByBlockHash | Promise<Filter | FilterByBlockHash>): Promise<Filter | FilterByBlockHash> {
        filter = await filter;

        const result: any = { };

        if (filter.address != null) {
            result.address = this._getAddress(filter.address);
        }

        ["blockHash", "topics"].forEach((key) => {
            if ((<any>filter)[key] == null) { return; }
            result[key] = (<any>filter)[key];
        });

        ["fromBlock", "toBlock"].forEach((key) => {
            if ((<any>filter)[key] == null) { return; }
        });

        return this.formatter.filter(await resolveProperties(result));
    }

    async estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber> {
        return logger.throwArgumentError("estimateGas not implemented", Logger.errors.NOT_IMPLEMENTED, {
            operation: "estimateGas"
        });
    }

    // TODO FIX ME
    async _getAddress(addressOrName: string | Promise<string>): Promise<string> {
        addressOrName = await addressOrName;
        if (typeof(addressOrName) !== "string") {
            logger.throwArgumentError("invalid address or ENS name", "name", addressOrName);
        }

        const address = await this.resolveName(addressOrName);
        if (address == null) {
            logger.throwError("ENS name not configured", Logger.errors.UNSUPPORTED_OPERATION, {
                operation: `resolveName(${ JSON.stringify(addressOrName) })`
            });
        }
        return address;
    }

    /**
     * Transaction record query implementation using the mirror node REST API.
     *
     * @param txId - id of the transaction to search for
     */
    async getTransaction(txId: string | Promise<string>): Promise<TransactionResponse> {
        await this.getNetwork();
        txId = await txId;
        const ep = '/api/v1/transactions/'+txId;
        let { data } = await axios.get(this._mirrorNodeUrl + ep);
        const filtered = data.transactions
            .filter((e: { result: string; }) => e.result === "SUCCESS");
        return filtered.length > 0 ? filtered[0] : null;
    }

    async getTransactionReceipt(transactionHash: string | Promise<string>): Promise<TransactionReceipt> {
        await this.getNetwork();

        transactionHash = await transactionHash;

        const params = { transactionHash: this.formatter.hash(transactionHash, true) };

        return poll(async () => {
            const result = await this.perform("getTransactionReceipt", params);

            if (result == null) {
                return undefined;
            }

            // "geth-etc" returns receipts before they are ready
            if (result.blockHash == null) { return undefined; }

            return this.formatter.receipt(result);
        }, { oncePoll: this });
    }

    async getLogs(filter: Filter | FilterByBlockHash | Promise<Filter | FilterByBlockHash>): Promise<Array<Log>> {
        await this.getNetwork();
        const params = await resolveProperties({ filter: this._getFilter(filter) });
        const logs: Array<Log> = await this.perform("getLogs", params);
        logs.forEach((log) => {
            if (log.removed == null) { log.removed = false; }
        });
        return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
    }

    async getHbarPrice(): Promise<number> {
        return logger.throwError("NOT_IMPLEMENTED", Logger.errors.NOT_IMPLEMENTED);
    }

    // TODO FIXME
    async getResolver(name: string): Promise<null | Resolver> {
        try {
            const address = await this._getResolver(name);
            if (address == null) { return null; }
            return new Resolver(this, address, name);
        } catch (error) {
            if (error.code === Logger.errors.CALL_EXCEPTION) { return null; }
            return null;
        }
    }

    // TODO FIXME
    async _getResolver(name: string): Promise<string> {
        // Get the resolver from the blockchain
        const network = await this.getNetwork();

        // No ENS...
        if (!network.ensAddress) {
            logger.throwError(
                "network does not support ENS",
                Logger.errors.UNSUPPORTED_OPERATION,
                { operation: "ENS", network: network.name }
            );
        }

        // keccak256("resolver(bytes32)")
        // const transaction = {
        //     to: network.ensAddress,
        //     data: ("0x0178b8bf" + namehash(name).substring(2))
        // };

        try {
            return null;
            // return this.formatter.callAddress(await this.call(transaction));
        } catch (error) {
            if (error.code === Logger.errors.CALL_EXCEPTION) { return null; }
            throw error;
        }
    }

    // TODO FIXME
    async resolveName(name: string | Promise<string>): Promise<null | string> {
        name = await name;

        // If it is already an address, nothing to resolve
        try {
            return Promise.resolve(this.formatter.address(name));
        } catch (error) {
            // If is is a hexstring, the address is bad (See #694)
            if (isHexString(name)) { throw error; }
        }

        if (typeof(name) !== "string") {
            logger.throwArgumentError("invalid ENS name", "name", name);
        }

        // Get the addr from the resovler
        const resolver = await this.getResolver(name);
        if (!resolver) { return null; }

        return await resolver.getAddress();
    }

    // TODO FIXME
    async lookupAddress(address: string | Promise<string>): Promise<null | string> {
        address = await address;
        address = this.formatter.address(address);

        return null;
    }

    perform(method: string, params: any): Promise<any> {
        return logger.throwError(method + " not implemented", Logger.errors.NOT_IMPLEMENTED, { operation: method });
    }

    _addEventListener(eventName: EventType, listener: Listener, once: boolean): this {
        return this;
    }

    on(eventName: EventType, listener: Listener): this {
        return this._addEventListener(eventName, listener, false);
    }

    once(eventName: EventType, listener: Listener): this {
        return this._addEventListener(eventName, listener, true);
    }

    emit(eventName: EventType, ...args: Array<any>): boolean {
        return false;
    }

    listenerCount(eventName?: EventType): number {
        return 0;
    }

    listeners(eventName?: EventType): Array<Listener> {
        return null;
    }

    off(eventName: EventType, listener?: Listener): this {
        return this;
    }

    removeAllListeners(eventName?: EventType): this {
        return this;
    }
}


// resolves network string to a hedera network name
function mapNetworkToHederaNetworkName(net: Network | string | number | Promise<Network>) {
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
function resolveMirrorNetworkUrl(net: Network): string {
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

function isHederaNetworkConfigLike(cfg : HederaNetworkConfigLike | Networkish): cfg is HederaNetworkConfigLike {
    return (cfg as HederaNetworkConfigLike).network !== undefined;
}
