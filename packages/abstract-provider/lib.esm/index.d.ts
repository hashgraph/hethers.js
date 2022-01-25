import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { BytesLike } from "@ethersproject/bytes";
import { Network } from "@ethersproject/networks";
import { Deferrable, Description } from "@ethersproject/properties";
import { AccessListish, Transaction } from "@ethersproject/transactions";
import { AccountLike } from "@ethersproject/address";
import { AccountId, Client } from '@hashgraph/sdk';
export declare type TransactionRequest = {
    to?: AccountLike;
    from?: AccountLike;
    gasLimit?: BigNumberish;
    data?: BytesLike;
    value?: BigNumberish;
    chainId?: number;
    type?: number;
    accessList?: AccessListish;
    maxPriorityFeePerGas?: BigNumberish;
    maxFeePerGas?: BigNumberish;
    nodeId?: AccountLike;
    customData?: Record<string, any>;
};
export interface TransactionResponse extends Transaction {
    hash: string;
    blockNumber?: number;
    blockHash?: string;
    timestamp?: number;
    confirmations: number;
    from: string;
    raw?: string;
    wait: (confirmations?: number) => Promise<TransactionReceipt>;
    customData?: {
        [key: string]: any;
    };
}
export declare type BlockTag = string | number;
export interface _Block {
    hash: string;
    parentHash: string;
    number: number;
    timestamp: number;
    nonce: string;
    difficulty: number;
    _difficulty: BigNumber;
    gasLimit: BigNumber;
    gasUsed: BigNumber;
    miner: string;
    extraData: string;
    baseFeePerGas?: null | BigNumber;
}
export interface Block extends _Block {
    transactions: Array<string>;
}
export interface BlockWithTransactions extends _Block {
    transactions: Array<TransactionResponse>;
}
export interface Log {
    blockNumber: number;
    blockHash: string;
    transactionIndex: number;
    removed: boolean;
    address: string;
    data: string;
    topics: Array<string>;
    transactionHash: string;
    logIndex: number;
}
export interface TransactionReceipt {
    to: string;
    from: string;
    contractAddress: string;
    transactionIndex: number;
    root?: string;
    gasUsed: BigNumber;
    logsBloom: string;
    blockHash: string;
    transactionHash: string;
    logs: Array<Log>;
    blockNumber: number;
    confirmations: number;
    cumulativeGasUsed: BigNumber;
    effectiveGasPrice: BigNumber;
    byzantium: boolean;
    type: number;
    status?: number;
}
export interface FeeData {
    maxFeePerGas: null | BigNumber;
    maxPriorityFeePerGas: null | BigNumber;
    gasPrice: null | BigNumber;
}
export interface EventFilter {
    address?: string;
    topics?: Array<string | Array<string> | null>;
}
export interface Filter extends EventFilter {
    fromBlock?: BlockTag;
    toBlock?: BlockTag;
}
export interface FilterByBlockHash extends EventFilter {
    blockHash?: string;
}
export declare abstract class ForkEvent extends Description {
    readonly expiry: number;
    readonly _isForkEvent?: boolean;
    static isForkEvent(value: any): value is ForkEvent;
}
export declare class BlockForkEvent extends ForkEvent {
    readonly blockHash: string;
    readonly _isBlockForkEvent?: boolean;
    constructor(blockHash: string, expiry?: number);
}
export declare class TransactionForkEvent extends ForkEvent {
    readonly hash: string;
    readonly _isTransactionOrderForkEvent?: boolean;
    constructor(hash: string, expiry?: number);
}
export declare class TransactionOrderForkEvent extends ForkEvent {
    readonly beforeHash: string;
    readonly afterHash: string;
    constructor(beforeHash: string, afterHash: string, expiry?: number);
}
export declare type EventType = string | Array<string | Array<string>> | EventFilter | ForkEvent;
export declare type Listener = (...args: Array<any>) => void;
export declare abstract class Provider {
    abstract getNetwork(): Promise<Network>;
    getHederaClient(): Client;
    getHederaNetworkConfig(): AccountId[];
    getGasPrice(): Promise<BigNumber>;
    abstract getBalance(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<BigNumber>;
    abstract getCode(addressOrName: string | Promise<string>, blockTag?: BlockTag | Promise<BlockTag>): Promise<string>;
    abstract sendTransaction(signedTransaction: string | Promise<string>): Promise<TransactionResponse>;
    abstract estimateGas(transaction: Deferrable<TransactionRequest>): Promise<BigNumber>;
    abstract getTransaction(transactionHash: string): Promise<TransactionResponse>;
    abstract getTransactionReceipt(transactionHash: string): Promise<TransactionReceipt>;
    abstract getLogs(filter: Filter): Promise<Array<Log>>;
    abstract on(eventName: EventType, listener: Listener): Provider;
    abstract once(eventName: EventType, listener: Listener): Provider;
    abstract emit(eventName: EventType, ...args: Array<any>): boolean;
    abstract listenerCount(eventName?: EventType): number;
    abstract listeners(eventName?: EventType): Array<Listener>;
    abstract off(eventName: EventType, listener?: Listener): Provider;
    abstract removeAllListeners(eventName?: EventType): Provider;
    addListener(eventName: EventType, listener: Listener): Provider;
    removeListener(eventName: EventType, listener: Listener): Provider;
    abstract waitForTransaction(transactionHash: string, confirmations?: number, timeout?: number): Promise<TransactionReceipt>;
    readonly _isProvider: boolean;
    constructor();
    static isProvider(value: any): value is Provider;
}
//# sourceMappingURL=index.d.ts.map