import * as hethers from "ethers";
import { arrayify, getAddressFromAccount } from "ethers/lib/utils";
import {
	AccountCreateTransaction,
	PrivateKey,
	Hbar,
	Client,
	Key as HederaKey, TransactionId
} from "@hashgraph/sdk";
import { readFileSync } from "fs";
import { Key } from "@hashgraph/proto";

const account = {
	"operator": {
		"accountId": "0.0.1365",
		"publicKey": "302a300506032b65700321004aed2e9e0cb6cbcd12b58476a2c39875d27e2a856444173830cc1618d32ca2f0",
		"privateKey": "302e020100300506032b65700422042072874996deabc69bde7287a496295295b8129551903a79b895a9fd5ed025ece8"
	}
};

(async () => {
	/**
	 * Start the client
	 */
	const edPrivateKey = PrivateKey.fromString(account.operator.privateKey);
	const client = Client.forName("previewnet");
	const nodeIds = client._network.getNodeAccountIdsForExecute();
	let wallet = hethers.Wallet.createRandom();

	/**
	 * Create an ECDSA key protobuf from the generated wallet
	 */
	const protoKey = Key.create({
		ECDSASecp256k1: arrayify(wallet._signingKey().compressedPublicKey)
	});
	/**
	 * Create the new account with the ECDSA key
	 */
	const newAccountKey = HederaKey._fromProtobufKey(protoKey);
	const accountCreate = await (await new AccountCreateTransaction()
		.setKey(newAccountKey)
		.setTransactionId(TransactionId.generate(account.operator.accountId))
		.setInitialBalance(new Hbar(100))
		.setNodeAccountIds([ nodeIds[0] ])
		.freeze()
		.sign(edPrivateKey))
		.execute(client);
	const receipt = await accountCreate.getReceipt(client);
	const createdAcc = receipt.accountId || "0.0.0";

	/**
	 * Connect account
	 */
	wallet = wallet.connect(hethers.providers.getDefaultProvider('previewnet'))
		.connectAccount(createdAcc.toString());

	/**
	 * Deploy a contract - OZ ERC20
	 */
	const contractByteCode = readFileSync('examples/assets/bytecode/GLDToken.bin').toString();
	const contractCreateResponse = await wallet.sendTransaction({
		data: contractByteCode,
		gasLimit: 300000
	});
	console.log('contractCreate response:', contractCreateResponse);

	/**
	 * Instantiate the contract locally in order to interact with it
	 */
	const abi = JSON.parse(readFileSync('examples/assets/abi/GLDToken_abi.json').toString());
	const contract = hethers.ContractFactory.getContract(contractCreateResponse.customData?.contractId, abi, wallet);

	/**
	 * The following lines call:
	 * - approve function for 1000 tokens
	 * - mint function for 1000 tokens
	 * - balanceOf function for the wallet's address
	 */
	const approveParams = contract.interface.encodeFunctionData('approve', [
		getAddressFromAccount(account.operator.accountId),
		1000
	]);
	const approveResponse = await wallet.sendTransaction({
		to: contract.address,
		data: approveParams,
		gasLimit: 100000
	});
	console.log('approve response: ', approveResponse);

	const mintParams = contract.interface.encodeFunctionData('mint', [
		1000
	]);
	const mintResponse = await wallet.sendTransaction({
		to: contract.address,
		data: mintParams,
		gasLimit: 100000
	});
	console.log('mint response:', mintResponse);

	const balanceOfParams = contract.interface.encodeFunctionData('balanceOf', [
		await wallet.getAddress()
	]);

	const balanceOfTx = {
		to: contract.address,
		gasLimit: 30000,
		data: arrayify(balanceOfParams)
	};
	const balanceOfResponse = await wallet.call(balanceOfTx);
	console.log('balanceOf response: ', balanceOfResponse);
	console.log(hethers.BigNumber.from(balanceOfResponse).toNumber());
})();

// testnet
// account: 0.0.18394, | private key:  0x40717ff6dc7a38f19c3a21c5727dd273e6744c8e78942881bfd6f1526c0a17cb
// contract addr 0000000000000000000000000000000001b34cbb
// wallet addr 0x0000000000000000000000000000000001b34cb9 - for balanceOf query

// previewnet
// contractID (erc20) 000000000000000000000000000000000000484f