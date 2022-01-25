import { BlockTag, EventType, Filter, FilterByBlockHash, Listener, Log, Provider, TransactionReceipt, TransactionRequest, TransactionResponse } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Network, Networkish, HederaNetworkConfigLike } from "@ethersproject/networks";
import { Deferrable } from "@ethersproject/properties";
import { Transaction } from "@ethersproject/transactions";
import { TransactionReceipt as HederaTransactionReceipt } from '@hashgraph/sdk';
import { Formatter } from "./formatter";
import { AccountLike } from "@ethersproject/address";
import { AccountId, Client } from "@hashgraph/sdk";
export declare class Event {
    readonly listener: Listener;
    readonly once: boolean;
    readonly tag: string;
    constructor(tag: string, listener: Listener, once: boolean);
    get event(): EventType;
    get type(): string;
    get hash(): string;
    get filter(): Filter;
    pollable(): boolean;
}
export interface EnsResolver {
    readonly name: string;
    readonly address: string;
    getAddress(coinType?: 60): Promise<null | string>;
    getContentHash(): Promise<null | string>;
    getText(key: string): Promise<null | string>;
}
export interface EnsProvider {
    resolveName(name: string): Promise<null | string>;
    lookupAddress(address: string): Promise<null | string>;
    getResolver(name: string): Promise<null | EnsResolver>;
}
export interface Avatar {
    url: string;
    linkage: Array<{
        type: string;
        content: string;
    }>;
}
export declare class Resolver implements EnsResolver {
    readonly provider: BaseProvider;
    readonly name: string;
    readonly address: string;
    readonly _resolvedAddress: null | string;
    constructor(provider: BaseProvider, address: string, name: string, resolvedAddress?: string);
    _fetchBytes(selector: string, parameters?: string): Promise<null | string>;
    _getAddress(coinType: number, hexBytes: string): string;
    getAddress(coinType?: number): Promise<string>;
    getContentHash(): Promise<string>;
    getText(key: string): Promise<string>;
}
export declare class BaseProvider extends Provider {
    _networkPromise: Promise<Network>;
    _network: Network;
    _events: Array<Event>;
    formatter: Formatter;
    readonly anyNetwork: boolean;
    private readonly hederaClient;
    private readonly _mirrorNodeUrl;
    /**
     *  ready
     *
     *  A Promise<Network> that resolves only once the provider is ready.
     *
     *  Sub-classes that call the super with a network without a chainId
     *  MUST set this. Standard named networks have a known chainId.
     *
     */
    constructor(network: Networkish | Promise<Network> | HederaNetworkConfigLike);
    _ready(): Promise<Network>;
    static getFormatter(): Formatter;
    static getNetwork(network: Networkish): Network;
    get network(): Network;
    detectNetwork(): Promise<Network>;
    getNetwork(): Promise<Network>;
    waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number): Promise<TransactionReceipt>;
    _waitForTransaction(transactionHash: string, confirmations: number, timeout: number, replaceable: {
        data: string;
        from: string;
        nonce: number;
        to: string;
        value: BigNumber;
        startBlock: number;
    }): Promise<TransactionReceipt>;
    /**
     *  AccountBalance query implementation, using the hashgraph sdk.
     *  It returns the tinybar balance of the given address.
     *
     * @param accountLike The address to check balance of
     */
    getBalance(accountLike: AccountLike | Promise<AccountLike>): Promise<BigNumber>;
    getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string>;
    _wrapTransaction(tx: Transaction, hash?: string, receipt?: HederaTransactionReceipt): TransactionResponse;
    getHederaClient(): Client;
    getHederaNetworkConfig(): AccountId[];
    sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse>;
    _getFilter(filter: Filter | FilterByBlockHash | Promise<Filter | FilterByBlockHash>): Promise<Filter | FilterByBlockHash>;
    estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber>;
    _getAddress(addressOrName: string | Promise<string>): Promise<string>;
    /**
     * Transaction record query implementation using the mirror node REST API.
     *
     * @param txId - id of the transaction to search for
     */
    getTransaction(txId: string | Promise<string>): Promise<TransactionResponse>;
    getTransactionReceipt(transactionHash: string | Promise<string>): Promise<TransactionReceipt>;
    getLogs(filter: Filter | FilterByBlockHash | Promise<Filter | FilterByBlockHash>): Promise<Array<Log>>;
    getHbarPrice(): Promise<number>;
    getResolver(name: string): Promise<null | Resolver>;
    _getResolver(name: string): Promise<string>;
    resolveName(name: string | Promise<string>): Promise<null | string>;
    lookupAddress(address: string | Promise<string>): Promise<null | string>;
    perform(method: string, params: any): Promise<any>;
    _addEventListener(eventName: EventType, listener: Listener, once: boolean): this;
    on(eventName: EventType, listener: Listener): this;
    once(eventName: EventType, listener: Listener): this;
    emit(eventName: EventType, ...args: Array<any>): boolean;
    listenerCount(eventName?: EventType): number;
    listeners(eventName?: EventType): Array<Listener>;
    off(eventName: EventType, listener?: Listener): this;
    removeAllListeners(eventName?: EventType): this;
}
//# sourceMappingURL=base-provider.d.ts.map