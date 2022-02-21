const hethers = require("hethers");

(async () => {
	/**
	 * Example 1: Instantiation of Wallet using EOA
	 */
	const eoa = {
		address: "0x0000000000000000000000000000000000000001",
		privateKey: "0x074cc0bd198d1bc91f668c59b46a1e74fd13215661e5a7bd42ad0d324476295d"
	}
	const wallet1 = new hethers.Wallet(eoa);
	console.log(wallet1);

	/**
	 * Example 2: Instantiation of Wallet using Hedera Account
	 */
	const hederaAcc = {
		account: "0.0.2",
		privateKey: "0x074cc0bd198d1bc91f668c59b46a1e74fd13215661e5a7bd42ad0d324476295d"
	}
	const wallet2 = new hethers.Wallet(hederaAcc);
	console.log(wallet2);

	/**
	 * Example 3: Instantiation of Wallet using Hedera Alias
	 */
	const hederaAlias = {
		alias: "0.0.BMAiA3xjpm4sULCFp5YuREmQDwJ7bbjrvFhi/ZnWaFNrRFGTh330h4aPqg8zZkJh7qzVjaNOWy1qpdt8bRbDFlc=",
		privateKey: "0xc59f86eef3511f27450d3baf2139ae535061c4743a7f02a6e89fed014d551b4a"
	}
	const wallet3 = new hethers.Wallet(hederaAlias);
	console.log(wallet3);

	/**
	 * Example 4: Instantiation of random Wallet
	 */
	const newWallet = hethers.Wallet.createRandom();
	console.log(newWallet);

	/**
	 * Example 5: Instantiation of Wallet from mnemonic
	 */
	const mnemonic = "bullet network weekend dash ahead kick donkey require blame ability punch surprise";
	const mnemonicWallet1 = hethers.Wallet.fromMnemonic(mnemonic);
	console.log(mnemonicWallet1);

	/**
	 * Example 6: Instantiation of Wallet using SigningKey
	 */
	const fromSigningKey = new hethers.Wallet(wallet1._signingKey());
	console.log(fromSigningKey);

	/**
	 * Example 7: Instantiation of Wallet using Private Key
	 */
	const fromPk = new hethers.Wallet("0xc59f86eef3511f27450d3baf2139ae535061c4743a7f02a6e89fed014d551b4a");
	console.log(fromPk);

	/**
	 * Example 8: Connecting Wallet to Account
	 */
	const connected1 = fromPk.connectAccount("0.0.1")
	const connected2 = fromPk.connectAccount("0x0000000000000000000000000000000000000001")
	const connected3 = fromPk.connectAccount({ shard: BigInt(0), realm: BigInt(0), num: BigInt(1) })
	console.log(connected1);
	console.log(connected2);
	console.log(connected3);

	/**
	 * Example 9: Encryption of Wallet
	 */
	const encryptedJson = await wallet1.encrypt("asd");
	console.log(`Encrypted JSON: ${encryptedJson}`);

	/**
	 * Example 10: Decrypt Wallet Async
	 */
	const decryptedWallet = await hethers.Wallet.fromEncryptedJson(encryptedJson, "asd");
	console.log(`Decrypted Wallet:`);
	console.log(decryptedWallet);

	/**
	 * Example 11: Decrypt Wallet Sync
	 */
	const decryptedWalletSync = hethers.Wallet.fromEncryptedJsonSync(encryptedJson, "asd");
	console.log(`Decrypted Wallet Sync:`);
	console.log(decryptedWalletSync);

	let wallet = hethers.Wallet.createRandom();
	wallet = wallet.connectAccount("0.0.98");
	const data = Buffer.from(`"abi":{},"values":{}`).toString('hex');
	const tx = {
		to: hethers.utils.getAddressFromAccount("0.0.12999"),
		from: wallet.address,
		data: '0x'+data,
		gasLimit: 100000,
		nodeId: "0.0.1"
	};
	const signed = await wallet.signTransaction(tx);
	console.log(signed);

	/**
	 * Example 12: Send hbars between wallets
	 */
	const acc1Eoa = {"account":"0.0.29631749","privateKey":"0x18a2ac384f3fa3670f71fc37e2efbf4879a90051bb0d437dd8cbd77077b24d9b"};
	const acc2Eoa = {"account":"0.0.29631750","privateKey":"0x6357b34b94fe53ded45ebe4c22b9c1175634d3f7a8a568079c2cb93bba0e3aee"};
	const providerTestnet = hethers.providers.getDefaultProvider('testnet');
	// @ts-ignore
	const acc1Wallet = new hethers.Wallet(acc1Eoa, providerTestnet);
	// @ts-ignore
	const acc2Wallet = new hethers.Wallet(acc2Eoa, providerTestnet);
	console.log(`Acc1 balance: ${(await acc1Wallet.getBalance()).toString()}`);
	console.log(`Acc2 balance: ${(await acc2Wallet.getBalance()).toString()}\n\n`);
	await acc1Wallet.sendTransaction({
		to: acc2Wallet.account,
		value: 1
	});
	console.log(`Acc1 balance: ${(await acc1Wallet.getBalance()).toString()}`);
	console.log(`Acc2 balance: ${(await acc2Wallet.getBalance()).toString()}\n\n`);
})()
