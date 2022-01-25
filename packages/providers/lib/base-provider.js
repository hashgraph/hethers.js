"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = exports.Resolver = exports.Event = void 0;
var abstract_provider_1 = require("@ethersproject/abstract-provider");
var basex_1 = require("@ethersproject/basex");
var bignumber_1 = require("@ethersproject/bignumber");
var bytes_1 = require("@ethersproject/bytes");
var networks_1 = require("@ethersproject/networks");
var properties_1 = require("@ethersproject/properties");
var sha2_1 = require("@ethersproject/sha2");
var strings_1 = require("@ethersproject/strings");
var web_1 = require("@ethersproject/web");
var bech32_1 = __importDefault(require("bech32"));
var logger_1 = require("@ethersproject/logger");
var _version_1 = require("./_version");
var logger = new logger_1.Logger(_version_1.version);
var formatter_1 = require("./formatter");
var address_1 = require("@ethersproject/address");
var sdk_1 = require("@hashgraph/sdk");
var axios_1 = __importDefault(require("axios"));
//////////////////////////////
// Event Serializeing
// @ts-ignore
function checkTopic(topic) {
    if (topic == null) {
        return "null";
    }
    if ((0, bytes_1.hexDataLength)(topic) !== 32) {
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
    return topics.map(function (topic) {
        if (Array.isArray(topic)) {
            // Only track unique OR-topics
            var unique_1 = {};
            topic.forEach(function (topic) {
                unique_1[checkTopic(topic)] = true;
            });
            // The order of OR-topics does not matter
            var sorted = Object.keys(unique_1);
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
    return data.split(/&/g).map(function (topic) {
        if (topic === "") {
            return [];
        }
        var comps = topic.split("|").map(function (topic) {
            return ((topic === "null") ? null : topic);
        });
        return ((comps.length === 1) ? comps[0] : comps);
    });
}
//////////////////////////////
// Helper Object
function stall(duration) {
    return new Promise(function (resolve) {
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
var PollableEvents = ["block", "network", "pending", "poll"];
var Event = /** @class */ (function () {
    function Event(tag, listener, once) {
        (0, properties_1.defineReadOnly)(this, "tag", tag);
        (0, properties_1.defineReadOnly)(this, "listener", listener);
        (0, properties_1.defineReadOnly)(this, "once", once);
    }
    Object.defineProperty(Event.prototype, "event", {
        get: function () {
            switch (this.type) {
                case "tx":
                    return this.hash;
                case "filter":
                    return this.filter;
            }
            return this.tag;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Event.prototype, "type", {
        get: function () {
            return this.tag.split(":")[0];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Event.prototype, "hash", {
        get: function () {
            var comps = this.tag.split(":");
            if (comps[0] !== "tx") {
                return null;
            }
            return comps[1];
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Event.prototype, "filter", {
        get: function () {
            var comps = this.tag.split(":");
            if (comps[0] !== "filter") {
                return null;
            }
            var address = comps[1];
            var topics = deserializeTopics(comps[2]);
            var filter = {};
            if (topics.length > 0) {
                filter.topics = topics;
            }
            if (address && address !== "*") {
                filter.address = address;
            }
            return filter;
        },
        enumerable: false,
        configurable: true
    });
    Event.prototype.pollable = function () {
        return (this.tag.indexOf(":") >= 0 || PollableEvents.indexOf(this.tag) >= 0);
    };
    return Event;
}());
exports.Event = Event;
;
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
var coinInfos = {
    "0": { symbol: "btc", p2pkh: 0x00, p2sh: 0x05, prefix: "bc" },
    "2": { symbol: "ltc", p2pkh: 0x30, p2sh: 0x32, prefix: "ltc" },
    "3": { symbol: "doge", p2pkh: 0x1e, p2sh: 0x16 },
    "60": { symbol: "eth", ilk: "eth" },
    "61": { symbol: "etc", ilk: "eth" },
    "700": { symbol: "xdai", ilk: "eth" },
};
function bytes32ify(value) {
    return (0, bytes_1.hexZeroPad)(bignumber_1.BigNumber.from(value).toHexString(), 32);
}
// Compute the Base58Check encoded data (checksum is first 4 bytes of sha256d)
function base58Encode(data) {
    return basex_1.Base58.encode((0, bytes_1.concat)([data, (0, bytes_1.hexDataSlice)((0, sha2_1.sha256)((0, sha2_1.sha256)(data)), 0, 4)]));
}
var Resolver = /** @class */ (function () {
    // The resolvedAddress is only for creating a ReverseLookup resolver
    function Resolver(provider, address, name, resolvedAddress) {
        (0, properties_1.defineReadOnly)(this, "provider", provider);
        (0, properties_1.defineReadOnly)(this, "name", name);
        (0, properties_1.defineReadOnly)(this, "address", provider.formatter.address(address));
        (0, properties_1.defineReadOnly)(this, "_resolvedAddress", resolvedAddress);
    }
    Resolver.prototype._fetchBytes = function (selector, parameters) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // e.g. keccak256("addr(bytes32,uint256)")
                // const tx = {
                //     to: this.address,
                //     data: hexConcat([ selector, namehash(this.name), (parameters || "0x") ])
                // };
                try {
                    // return _parseBytes(await this.provider.call(tx));
                    return [2 /*return*/, null];
                }
                catch (error) {
                    if (error.code === logger_1.Logger.errors.CALL_EXCEPTION) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, null];
                }
                return [2 /*return*/];
            });
        });
    };
    Resolver.prototype._getAddress = function (coinType, hexBytes) {
        var coinInfo = coinInfos[String(coinType)];
        if (coinInfo == null) {
            logger.throwError("unsupported coin type: " + coinType, logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                operation: "getAddress(" + coinType + ")"
            });
        }
        if (coinInfo.ilk === "eth") {
            return this.provider.formatter.address(hexBytes);
        }
        var bytes = (0, bytes_1.arrayify)(hexBytes);
        // P2PKH: OP_DUP OP_HASH160 <pubKeyHash> OP_EQUALVERIFY OP_CHECKSIG
        if (coinInfo.p2pkh != null) {
            var p2pkh = hexBytes.match(/^0x76a9([0-9a-f][0-9a-f])([0-9a-f]*)88ac$/);
            if (p2pkh) {
                var length_1 = parseInt(p2pkh[1], 16);
                if (p2pkh[2].length === length_1 * 2 && length_1 >= 1 && length_1 <= 75) {
                    return base58Encode((0, bytes_1.concat)([[coinInfo.p2pkh], ("0x" + p2pkh[2])]));
                }
            }
        }
        // P2SH: OP_HASH160 <scriptHash> OP_EQUAL
        if (coinInfo.p2sh != null) {
            var p2sh = hexBytes.match(/^0xa9([0-9a-f][0-9a-f])([0-9a-f]*)87$/);
            if (p2sh) {
                var length_2 = parseInt(p2sh[1], 16);
                if (p2sh[2].length === length_2 * 2 && length_2 >= 1 && length_2 <= 75) {
                    return base58Encode((0, bytes_1.concat)([[coinInfo.p2sh], ("0x" + p2sh[2])]));
                }
            }
        }
        // Bech32
        if (coinInfo.prefix != null) {
            var length_3 = bytes[1];
            // https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki#witness-program
            var version_1 = bytes[0];
            if (version_1 === 0x00) {
                if (length_3 !== 20 && length_3 !== 32) {
                    version_1 = -1;
                }
            }
            else {
                version_1 = -1;
            }
            if (version_1 >= 0 && bytes.length === 2 + length_3 && length_3 >= 1 && length_3 <= 75) {
                var words = bech32_1.default.toWords(bytes.slice(2));
                words.unshift(version_1);
                return bech32_1.default.encode(coinInfo.prefix, words);
            }
        }
        return null;
    };
    Resolver.prototype.getAddress = function (coinType) {
        return __awaiter(this, void 0, void 0, function () {
            var hexBytes, address;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (coinType == null) {
                            coinType = 60;
                        }
                        // If Ethereum, use the standard `addr(bytes32)`
                        if (coinType === 60) {
                            try {
                                return [2 /*return*/, null];
                            }
                            catch (error) {
                                if (error.code === logger_1.Logger.errors.CALL_EXCEPTION) {
                                    return [2 /*return*/, null];
                                }
                                throw error;
                            }
                        }
                        return [4 /*yield*/, this._fetchBytes("0xf1cb7e06", bytes32ify(coinType))];
                    case 1:
                        hexBytes = _a.sent();
                        // No address
                        if (hexBytes == null || hexBytes === "0x") {
                            return [2 /*return*/, null];
                        }
                        address = this._getAddress(coinType, hexBytes);
                        if (address == null) {
                            logger.throwError("invalid or unsupported coin data", logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                                operation: "getAddress(" + coinType + ")",
                                coinType: coinType,
                                data: hexBytes
                            });
                        }
                        return [2 /*return*/, address];
                }
            });
        });
    };
    Resolver.prototype.getContentHash = function () {
        return __awaiter(this, void 0, void 0, function () {
            var hexBytes, ipfs, length_4, swarm;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._fetchBytes("0xbc1c58d1")];
                    case 1:
                        hexBytes = _a.sent();
                        // No contenthash
                        if (hexBytes == null || hexBytes === "0x") {
                            return [2 /*return*/, null];
                        }
                        ipfs = hexBytes.match(/^0xe3010170(([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f]*))$/);
                        if (ipfs) {
                            length_4 = parseInt(ipfs[3], 16);
                            if (ipfs[4].length === length_4 * 2) {
                                return [2 /*return*/, "ipfs:/\/" + basex_1.Base58.encode("0x" + ipfs[1])];
                            }
                        }
                        swarm = hexBytes.match(/^0xe40101fa011b20([0-9a-f]*)$/);
                        if (swarm) {
                            if (swarm[1].length === (32 * 2)) {
                                return [2 /*return*/, "bzz:/\/" + swarm[1]];
                            }
                        }
                        return [2 /*return*/, logger.throwError("invalid or unsupported content hash data", logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                                operation: "getContentHash()",
                                data: hexBytes
                            })];
                }
            });
        });
    };
    Resolver.prototype.getText = function (key) {
        return __awaiter(this, void 0, void 0, function () {
            var keyBytes, hexBytes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        keyBytes = (0, strings_1.toUtf8Bytes)(key);
                        // The nodehash consumes the first slot, so the string pointer targets
                        // offset 64, with the length at offset 64 and data starting at offset 96
                        keyBytes = (0, bytes_1.concat)([bytes32ify(64), bytes32ify(keyBytes.length), keyBytes]);
                        // Pad to word-size (32 bytes)
                        if ((keyBytes.length % 32) !== 0) {
                            keyBytes = (0, bytes_1.concat)([keyBytes, (0, bytes_1.hexZeroPad)("0x", 32 - (key.length % 32))]);
                        }
                        return [4 /*yield*/, this._fetchBytes("0x59d1d43c", (0, bytes_1.hexlify)(keyBytes))];
                    case 1:
                        hexBytes = _a.sent();
                        if (hexBytes == null || hexBytes === "0x") {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, (0, strings_1.toUtf8String)(hexBytes)];
                }
            });
        });
    };
    return Resolver;
}());
exports.Resolver = Resolver;
var defaultFormatter = null;
var BaseProvider = /** @class */ (function (_super) {
    __extends(BaseProvider, _super);
    /**
     *  ready
     *
     *  A Promise<Network> that resolves only once the provider is ready.
     *
     *  Sub-classes that call the super with a network without a chainId
     *  MUST set this. Standard named networks have a known chainId.
     *
     */
    function BaseProvider(network) {
        var _newTarget = this.constructor;
        var _this = this;
        logger.checkNew(_newTarget, abstract_provider_1.Provider);
        _this = _super.call(this) || this;
        _this.formatter = _newTarget.getFormatter();
        // If network is any, this Provider allows the underlying
        // network to change dynamically, and we auto-detect the
        // current network
        (0, properties_1.defineReadOnly)(_this, "anyNetwork", (network === "any"));
        if (_this.anyNetwork) {
            network = _this.detectNetwork();
        }
        if (network instanceof Promise) {
            _this._networkPromise = network;
            // Squash any "unhandled promise" errors; that do not need to be handled
            network.catch(function (error) { });
            // Trigger initial network setting (async)
            _this._ready().catch(function (error) { });
        }
        else {
            if (!isHederaNetworkConfigLike(network)) {
                var asDefaultNetwork = network;
                // defineReadOnly(this, "_network", getNetwork(network));
                _this._network = (0, networks_1.getNetwork)(asDefaultNetwork);
                _this._networkPromise = Promise.resolve(_this._network);
                var knownNetwork = (0, properties_1.getStatic)(_newTarget, "getNetwork")(asDefaultNetwork);
                if (knownNetwork) {
                    (0, properties_1.defineReadOnly)(_this, "_network", knownNetwork);
                    _this.emit("network", knownNetwork, null);
                }
                else {
                    logger.throwArgumentError("invalid network", "network", network);
                }
                _this.hederaClient = sdk_1.Client.forName(mapNetworkToHederaNetworkName(asDefaultNetwork));
                _this._mirrorNodeUrl = resolveMirrorNetworkUrl(_this._network);
            }
            else {
                var asHederaNetwork = network;
                _this.hederaClient = sdk_1.Client.forNetwork(asHederaNetwork.network);
                _this._mirrorNodeUrl = asHederaNetwork.mirrorNodeUrl;
                (0, properties_1.defineReadOnly)(_this, "_network", {
                    // FIXME: chainId
                    chainId: 0,
                    name: _this.hederaClient.networkName
                });
            }
        }
        return _this;
    }
    BaseProvider.prototype._ready = function () {
        return __awaiter(this, void 0, void 0, function () {
            var network, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(this._network == null)) return [3 /*break*/, 7];
                        network = null;
                        if (!this._networkPromise) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this._networkPromise];
                    case 2:
                        network = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        if (!(network == null)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.detectNetwork()];
                    case 5:
                        network = _a.sent();
                        _a.label = 6;
                    case 6:
                        // This should never happen; every Provider sub-class should have
                        // suggested a network by here (or have thrown).
                        // if (!network) {
                        //     logger.throwError("no network detected", Logger.errors.UNKNOWN_ERROR, { });
                        // }
                        // Possible this call stacked so do not call defineReadOnly again
                        if (this._network == null) {
                            if (this.anyNetwork) {
                                // this._network = network;
                                (0, properties_1.defineReadOnly)(this, "_network", network);
                            }
                            else {
                                this._network = network;
                            }
                            this.emit("network", network, null);
                        }
                        _a.label = 7;
                    case 7: return [2 /*return*/, this._network];
                }
            });
        });
    };
    // @TODO: Remove this and just create a singleton formatter
    BaseProvider.getFormatter = function () {
        if (defaultFormatter == null) {
            defaultFormatter = new formatter_1.Formatter();
        }
        return defaultFormatter;
    };
    // @TODO: Remove this and just use getNetwork
    BaseProvider.getNetwork = function (network) {
        return (0, networks_1.getNetwork)((network == null) ? "mainnet" : network);
    };
    Object.defineProperty(BaseProvider.prototype, "network", {
        get: function () {
            return this._network;
        },
        enumerable: false,
        configurable: true
    });
    // This method should query the network if the underlying network
    // can change, such as when connected to a JSON-RPC backend
    // With the current hedera implementation, we do not support a changeable networks,
    // thus we do not need to query at this level
    BaseProvider.prototype.detectNetwork = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this._networkPromise = Promise.resolve(this._network);
                return [2 /*return*/, this._networkPromise];
            });
        });
    };
    BaseProvider.prototype.getNetwork = function () {
        return __awaiter(this, void 0, void 0, function () {
            var network, currentNetwork, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._ready()];
                    case 1:
                        network = _a.sent();
                        return [4 /*yield*/, this.detectNetwork()];
                    case 2:
                        currentNetwork = _a.sent();
                        if (!(network.chainId !== currentNetwork.chainId)) return [3 /*break*/, 5];
                        if (!this.anyNetwork) return [3 /*break*/, 4];
                        this._network = currentNetwork;
                        // The "network" event MUST happen before this method resolves
                        // so any events have a chance to unregister, so we stall an
                        // additional event loop before returning from /this/ call
                        this.emit("network", currentNetwork, network);
                        return [4 /*yield*/, stall(0)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, this._network];
                    case 4:
                        error = logger.makeError("underlying network changed", logger_1.Logger.errors.NETWORK_ERROR, {
                            event: "changed",
                            network: network,
                            detectedNetwork: currentNetwork
                        });
                        this.emit("error", error);
                        throw error;
                    case 5: return [2 /*return*/, network];
                }
            });
        });
    };
    BaseProvider.prototype.waitForTransaction = function (transactionHash, confirmations, timeout) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this._waitForTransaction(transactionHash, (confirmations == null) ? 1 : confirmations, timeout || 0, null)];
            });
        });
    };
    BaseProvider.prototype._waitForTransaction = function (transactionHash, confirmations, timeout, replaceable) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, logger.throwError("NOT_SUPPORTED", logger_1.Logger.errors.UNSUPPORTED_OPERATION)];
            });
        });
    };
    /**
     *  AccountBalance query implementation, using the hashgraph sdk.
     *  It returns the tinybar balance of the given address.
     *
     * @param accountLike The address to check balance of
     */
    BaseProvider.prototype.getBalance = function (accountLike) {
        return __awaiter(this, void 0, void 0, function () {
            var account, balance, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, accountLike];
                    case 1:
                        accountLike = _a.sent();
                        account = (0, address_1.asAccountString)(accountLike);
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, new sdk_1.AccountBalanceQuery()
                                .setAccountId(sdk_1.AccountId.fromString(account))
                                .execute(this.hederaClient)];
                    case 3:
                        balance = _a.sent();
                        return [2 /*return*/, bignumber_1.BigNumber.from(balance.hbars.toTinybars().toNumber())];
                    case 4:
                        error_2 = _a.sent();
                        return [2 /*return*/, logger.throwError("bad result from backend", logger_1.Logger.errors.SERVER_ERROR, {
                                method: "AccountBalanceQuery",
                                params: { address: accountLike },
                                error: error_2
                            })];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    BaseProvider.prototype.getCode = function (addressOrName, blockTag) {
        return __awaiter(this, void 0, void 0, function () {
            var params, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNetwork()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, properties_1.resolveProperties)({
                                address: this._getAddress(addressOrName),
                            })];
                    case 2:
                        params = _a.sent();
                        return [4 /*yield*/, this.perform("getCode", params)];
                    case 3:
                        result = _a.sent();
                        try {
                            return [2 /*return*/, (0, bytes_1.hexlify)(result)];
                        }
                        catch (error) {
                            return [2 /*return*/, logger.throwError("bad result from backend", logger_1.Logger.errors.SERVER_ERROR, {
                                    method: "getCode",
                                    params: params,
                                    result: result,
                                    error: error
                                })];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // This should be called by any subclass wrapping a TransactionResponse
    BaseProvider.prototype._wrapTransaction = function (tx, hash, receipt) {
        var _this = this;
        if (hash != null && (0, bytes_1.hexDataLength)(hash) !== 48) {
            throw new Error("invalid response - sendTransaction");
        }
        var result = tx;
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
            logger.throwError("Transaction hash mismatch from Provider.sendTransaction.", logger_1.Logger.errors.UNKNOWN_ERROR, { expectedHash: tx.hash, returnedHash: hash });
        }
        result.wait = function (confirms, timeout) { return __awaiter(_this, void 0, void 0, function () {
            var replacement, receipt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (confirms == null) {
                            confirms = 1;
                        }
                        if (timeout == null) {
                            timeout = 0;
                        }
                        replacement = undefined;
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
                        return [4 /*yield*/, this._waitForTransaction(tx.hash, confirms, timeout, replacement)];
                    case 1:
                        receipt = _a.sent();
                        if (receipt == null && confirms === 0) {
                            return [2 /*return*/, null];
                        }
                        if (receipt.status === 0) {
                            logger.throwError("transaction failed", logger_1.Logger.errors.CALL_EXCEPTION, {
                                transactionHash: tx.hash,
                                transaction: tx,
                                receipt: receipt
                            });
                        }
                        return [2 /*return*/, receipt];
                }
            });
        }); };
        return result;
    };
    BaseProvider.prototype.getHederaClient = function () {
        return this.hederaClient;
    };
    BaseProvider.prototype.getHederaNetworkConfig = function () {
        return this.hederaClient._network.getNodeAccountIdsForExecute();
    };
    BaseProvider.prototype.sendTransaction = function (signedTransaction) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var txBytes, hederaTx, ethersTx, txHash, _b, resp, receipt, error_3, err;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, signedTransaction];
                    case 1:
                        signedTransaction = _c.sent();
                        txBytes = (0, bytes_1.arrayify)(signedTransaction);
                        hederaTx = sdk_1.Transaction.fromBytes(txBytes);
                        return [4 /*yield*/, this.formatter.transaction(signedTransaction)];
                    case 2:
                        ethersTx = _c.sent();
                        _b = bytes_1.hexlify;
                        return [4 /*yield*/, hederaTx.getTransactionHash()];
                    case 3:
                        txHash = _b.apply(void 0, [_c.sent()]);
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 7, , 8]);
                        return [4 /*yield*/, hederaTx.execute(this.hederaClient)];
                    case 5:
                        resp = _c.sent();
                        return [4 /*yield*/, resp.getReceipt(this.hederaClient)];
                    case 6:
                        receipt = _c.sent();
                        return [2 /*return*/, this._wrapTransaction(ethersTx, txHash, receipt)];
                    case 7:
                        error_3 = _c.sent();
                        err = logger.makeError(error_3.message, (_a = error_3.status) === null || _a === void 0 ? void 0 : _a.toString());
                        err.transaction = ethersTx;
                        err.transactionHash = txHash;
                        throw err;
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    BaseProvider.prototype._getFilter = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, filter];
                    case 1:
                        filter = _c.sent();
                        result = {};
                        if (filter.address != null) {
                            result.address = this._getAddress(filter.address);
                        }
                        ["blockHash", "topics"].forEach(function (key) {
                            if (filter[key] == null) {
                                return;
                            }
                            result[key] = filter[key];
                        });
                        ["fromBlock", "toBlock"].forEach(function (key) {
                            if (filter[key] == null) {
                                return;
                            }
                        });
                        _b = (_a = this.formatter).filter;
                        return [4 /*yield*/, (0, properties_1.resolveProperties)(result)];
                    case 2: return [2 /*return*/, _b.apply(_a, [_c.sent()])];
                }
            });
        });
    };
    BaseProvider.prototype.estimateGas = function (transaction) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, logger.throwArgumentError("estimateGas not implemented", logger_1.Logger.errors.NOT_IMPLEMENTED, {
                        operation: "estimateGas"
                    })];
            });
        });
    };
    // TODO FIX ME
    BaseProvider.prototype._getAddress = function (addressOrName) {
        return __awaiter(this, void 0, void 0, function () {
            var address;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, addressOrName];
                    case 1:
                        addressOrName = _a.sent();
                        if (typeof (addressOrName) !== "string") {
                            logger.throwArgumentError("invalid address or ENS name", "name", addressOrName);
                        }
                        return [4 /*yield*/, this.resolveName(addressOrName)];
                    case 2:
                        address = _a.sent();
                        if (address == null) {
                            logger.throwError("ENS name not configured", logger_1.Logger.errors.UNSUPPORTED_OPERATION, {
                                operation: "resolveName(" + JSON.stringify(addressOrName) + ")"
                            });
                        }
                        return [2 /*return*/, address];
                }
            });
        });
    };
    /**
     * Transaction record query implementation using the mirror node REST API.
     *
     * @param txId - id of the transaction to search for
     */
    BaseProvider.prototype.getTransaction = function (txId) {
        return __awaiter(this, void 0, void 0, function () {
            var ep, data, filtered;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNetwork()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, txId];
                    case 2:
                        txId = _a.sent();
                        ep = '/api/v1/transactions/' + txId;
                        return [4 /*yield*/, axios_1.default.get(this._mirrorNodeUrl + ep)];
                    case 3:
                        data = (_a.sent()).data;
                        filtered = data.transactions
                            .filter(function (e) { return e.result === "SUCCESS"; });
                        return [2 /*return*/, filtered.length > 0 ? filtered[0] : null];
                }
            });
        });
    };
    BaseProvider.prototype.getTransactionReceipt = function (transactionHash) {
        return __awaiter(this, void 0, void 0, function () {
            var params;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNetwork()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, transactionHash];
                    case 2:
                        transactionHash = _a.sent();
                        params = { transactionHash: this.formatter.hash(transactionHash, true) };
                        return [2 /*return*/, (0, web_1.poll)(function () { return __awaiter(_this, void 0, void 0, function () {
                                var result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.perform("getTransactionReceipt", params)];
                                        case 1:
                                            result = _a.sent();
                                            if (result == null) {
                                                return [2 /*return*/, undefined];
                                            }
                                            // "geth-etc" returns receipts before they are ready
                                            if (result.blockHash == null) {
                                                return [2 /*return*/, undefined];
                                            }
                                            return [2 /*return*/, this.formatter.receipt(result)];
                                    }
                                });
                            }); }, { oncePoll: this })];
                }
            });
        });
    };
    BaseProvider.prototype.getLogs = function (filter) {
        return __awaiter(this, void 0, void 0, function () {
            var params, logs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNetwork()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, (0, properties_1.resolveProperties)({ filter: this._getFilter(filter) })];
                    case 2:
                        params = _a.sent();
                        return [4 /*yield*/, this.perform("getLogs", params)];
                    case 3:
                        logs = _a.sent();
                        logs.forEach(function (log) {
                            if (log.removed == null) {
                                log.removed = false;
                            }
                        });
                        return [2 /*return*/, formatter_1.Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs)];
                }
            });
        });
    };
    BaseProvider.prototype.getHbarPrice = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, logger.throwError("NOT_IMPLEMENTED", logger_1.Logger.errors.NOT_IMPLEMENTED)];
            });
        });
    };
    // TODO FIXME
    BaseProvider.prototype.getResolver = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var address, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this._getResolver(name)];
                    case 1:
                        address = _a.sent();
                        if (address == null) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, new Resolver(this, address, name)];
                    case 2:
                        error_4 = _a.sent();
                        if (error_4.code === logger_1.Logger.errors.CALL_EXCEPTION) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // TODO FIXME
    BaseProvider.prototype._getResolver = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var network;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getNetwork()];
                    case 1:
                        network = _a.sent();
                        // No ENS...
                        if (!network.ensAddress) {
                            logger.throwError("network does not support ENS", logger_1.Logger.errors.UNSUPPORTED_OPERATION, { operation: "ENS", network: network.name });
                        }
                        // keccak256("resolver(bytes32)")
                        // const transaction = {
                        //     to: network.ensAddress,
                        //     data: ("0x0178b8bf" + namehash(name).substring(2))
                        // };
                        try {
                            return [2 /*return*/, null];
                            // return this.formatter.callAddress(await this.call(transaction));
                        }
                        catch (error) {
                            if (error.code === logger_1.Logger.errors.CALL_EXCEPTION) {
                                return [2 /*return*/, null];
                            }
                            throw error;
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // TODO FIXME
    BaseProvider.prototype.resolveName = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            var resolver;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, name];
                    case 1:
                        name = _a.sent();
                        // If it is already an address, nothing to resolve
                        try {
                            return [2 /*return*/, Promise.resolve(this.formatter.address(name))];
                        }
                        catch (error) {
                            // If is is a hexstring, the address is bad (See #694)
                            if ((0, bytes_1.isHexString)(name)) {
                                throw error;
                            }
                        }
                        if (typeof (name) !== "string") {
                            logger.throwArgumentError("invalid ENS name", "name", name);
                        }
                        return [4 /*yield*/, this.getResolver(name)];
                    case 2:
                        resolver = _a.sent();
                        if (!resolver) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, resolver.getAddress()];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // TODO FIXME
    BaseProvider.prototype.lookupAddress = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, address];
                    case 1:
                        address = _a.sent();
                        address = this.formatter.address(address);
                        return [2 /*return*/, null];
                }
            });
        });
    };
    BaseProvider.prototype.perform = function (method, params) {
        return logger.throwError(method + " not implemented", logger_1.Logger.errors.NOT_IMPLEMENTED, { operation: method });
    };
    BaseProvider.prototype._addEventListener = function (eventName, listener, once) {
        return this;
    };
    BaseProvider.prototype.on = function (eventName, listener) {
        return this._addEventListener(eventName, listener, false);
    };
    BaseProvider.prototype.once = function (eventName, listener) {
        return this._addEventListener(eventName, listener, true);
    };
    BaseProvider.prototype.emit = function (eventName) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return false;
    };
    BaseProvider.prototype.listenerCount = function (eventName) {
        return 0;
    };
    BaseProvider.prototype.listeners = function (eventName) {
        return null;
    };
    BaseProvider.prototype.off = function (eventName, listener) {
        return this;
    };
    BaseProvider.prototype.removeAllListeners = function (eventName) {
        return this;
    };
    return BaseProvider;
}(abstract_provider_1.Provider));
exports.BaseProvider = BaseProvider;
// resolves network string to a hedera network name
function mapNetworkToHederaNetworkName(net) {
    switch (net) {
        case 'mainnet':
            return sdk_1.NetworkName.Mainnet;
        case 'previewnet':
            return sdk_1.NetworkName.Previewnet;
        case 'testnet':
            return sdk_1.NetworkName.Testnet;
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