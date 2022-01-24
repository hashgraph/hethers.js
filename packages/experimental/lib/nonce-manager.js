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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonceManager = void 0;
var ethers_1 = require("ethers");
var _version_1 = require("./_version");
var logger = new ethers_1.ethers.utils.Logger(_version_1.version);
// @TODO: Keep a per-NonceManager pool of sent but unmined transactions for
//        rebroadcasting, in case we overrun the transaction pool
/**
 * TODO: This class and it's usage in the hedera network must be explored.
 */
var NonceManager = /** @class */ (function (_super) {
    __extends(NonceManager, _super);
    function NonceManager(signer) {
        var _newTarget = this.constructor;
        var _this = this;
        logger.checkNew(_newTarget, NonceManager);
        _this = _super.call(this) || this;
        _this._deltaCount = 0;
        ethers_1.ethers.utils.defineReadOnly(_this, "signer", signer);
        ethers_1.ethers.utils.defineReadOnly(_this, "provider", signer.provider || null);
        return _this;
    }
    NonceManager.prototype.connect = function (provider) {
        return new NonceManager(this.signer.connect(provider));
    };
    NonceManager.prototype.getAddress = function () {
        return this.signer.getAddress();
    };
    NonceManager.prototype.setTransactionCount = function (transactionCount) {
        this._initialPromise = Promise.resolve(transactionCount).then(function (nonce) {
            return ethers_1.ethers.BigNumber.from(nonce).toNumber();
        });
        this._deltaCount = 0;
    };
    NonceManager.prototype.incrementTransactionCount = function (count) {
        this._deltaCount += (count ? count : 1);
    };
    NonceManager.prototype.signMessage = function (message) {
        return this.signer.signMessage(message);
        ;
    };
    NonceManager.prototype.signTransaction = function (transaction) {
        return this.signer.signTransaction(transaction);
    };
    NonceManager.prototype.sendTransaction = function (transaction) {
        return this.signer.sendTransaction(transaction).then(function (tx) {
            return tx;
        });
    };
    NonceManager.prototype.createAccount = function (pubKey, initialBalance) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // @ts-ignore
                return [2 /*return*/, logger.throwError("Unsupported operation", ethers_1.ethers.errors.UNSUPPORTED_OPERATION, {
                        operation: "createAccount"
                    })];
            });
        });
    };
    ;
    return NonceManager;
}(ethers_1.ethers.Signer));
exports.NonceManager = NonceManager;
//# sourceMappingURL=nonce-manager.js.map