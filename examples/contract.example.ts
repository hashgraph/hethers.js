import * as hethers from "ethers";
import { arrayify, getAddressFromAccount } from "ethers/lib/utils";
import {
	AccountCreateTransaction,
	PrivateKey,
	Hbar,
	Client,
	Key as HederaKey, AccountId, TransactionId,
} from "@hashgraph/sdk";
import { readFileSync } from "fs";
import { Key } from "@hashgraph/proto";

const account = {
	"operator": {
		"accountId": "0.0.19041642",
		"publicKey": "302a300506032b6570032100049d07fb89aa8f5e54eccd7b92846d9839404e8c0af8489a9a511422be958b2f",
		"privateKey": "302e020100300506032b6570042204207ef3437273a5146e4e504a6e22c5caedf07cb0821f01bc05d18e8e716f77f66c"
	},
	"network": {
		"0.testnet.hedera.com:50211": "0.0.3",
		"1.testnet.hedera.com:50211": "0.0.4",
		"2.testnet.hedera.com:50211": "0.0.5",
		"3.testnet.hedera.com:50211": "0.0.6"
	}
};

// main
(async () => {
	const edPrivateKey = PrivateKey.fromString(account.operator.privateKey);
	const client = Client.forNetwork(account.network);
	const generatedWallet = hethers.Wallet.createRandom();
	const provider = hethers.providers.getDefaultProvider('testnet');
	const protoKey = Key.create({
		ECDSASecp256k1: arrayify(generatedWallet._signingKey().compressedPublicKey)
	});
	const newAccountKey = HederaKey._fromProtobufKey(protoKey);
	const accountCreate = await (await new AccountCreateTransaction()
		.setKey(newAccountKey)
		.setTransactionId(TransactionId.generate(account.operator.accountId))
		.setInitialBalance(new Hbar(10))
		.setNodeAccountIds([new AccountId(0,0,3)])
		.freeze()
		.sign(edPrivateKey))
		.execute(client);
	const receipt = await accountCreate.getReceipt(client);
	console.log('New account', receipt);
	// @ts-ignore
	const newAccountId = receipt.accountId.toString();
	const hederaEoa = {
		account: newAccountId,
		privateKey: generatedWallet.privateKey
	};
	// @ts-ignore
	const wallet = new hethers.Wallet(hederaEoa, provider);
	// const walletPrivateKey = PrivateKey.fromBytes(arrayify(wallet._signingKey().privateKey));

	const contractByteCode = readFileSync('examples/assets/bytecode/GLDToken.bin').toString();
	const contractCreateResponse = await wallet.sendTransaction({
		data: contractByteCode,
		gasLimit: 300000
	});
	console.log(contractCreateResponse);
	const abi = JSON.parse(readFileSync('examples/assets/abi/GLDToken_abi.json').toString());
	// @ts-ignore
	const contract = hethers.ContractFactory.getContract(contractCreateResponse.customData.contractId, abi, wallet);
	const params = contract.interface.encodeFunctionData('approve', [
		getAddressFromAccount(account.operator.accountId),
		1000
	]);
	const approveResponse = await wallet.sendTransaction({
		to: contract.address,
		data: params,
		gasLimit: 100000
	});
	console.log(approveResponse);
})();