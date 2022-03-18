// import {AccountBalanceQuery, Client, Hbar, HbarUnit, TransferTransaction} from "@hashgraph/sdk";
//
// const account = {
//     "operator": {
//         "accountId": "0.0.28542425",
//         "publicKey": "302a300506032b6570032100a997b103c3e0c12d80179ee3b5f1c7ffe37e0a779fd5bc1bc14e6cc27321c6ee",
//         "privateKey": "302e020100300506032b65700422042077d69b53642df4e59215da8f5f10c97f6a6214b6c8de46940d394da21d30e7cc"
//     },
//     "network": {
//         "0.testnet.hedera.com:50211": "0.0.3",
//         "1.testnet.hedera.com:50211": "0.0.4",
//         "2.testnet.hedera.com:50211": "0.0.5",
//         "3.testnet.hedera.com:50211": "0.0.6"
//     }
// };
//
// (async () => {
//
//     const client = Client.forNetwork(account.network).setOperator(account.operator.accountId, account.operator.privateKey);
//     // accounts which have ECDSA keys are not topped-up with 10k hbars automatically.
//     // This script will top up this account with another testnet account
//     const testAccount = '0.0.29631749';
//     const amount = 1000;
//     const transfer = await new TransferTransaction()
//         .addHbarTransfer(account.operator.accountId, new Hbar(amount).negated())
//         .addHbarTransfer(testAccount, new Hbar(amount));
//     await transfer.execute(client);
//     const testAccountBalance = await new AccountBalanceQuery().setAccountId(testAccount).execute(client);
//     console.log(testAccountBalance.hbars.toString(HbarUnit.Hbar));
// })();

import {BigNumber, hethers} from "@hashgraph/hethers";
// import {readFileSync} from "fs";
//
// const abiTokenWithArgs = JSON.parse(readFileSync('packages/tests/contracts/TokenWithArgs.json').toString());
// const bytecodeTokenWithArgs = readFileSync('packages/tests/contracts/TokenWithArgs.bin').toString();
// const hederaEoa = {
//     account: '0.0.29562194',
//     privateKey: '0x3b6cd41ded6986add931390d5d3efa0bb2b311a8415cfe66716cac0234de035d'
// };
// const sleep = async (timeout: number) => {
//     await new Promise(resolve => {
//         setTimeout(resolve, timeout);
//     });
// };
//

import {
    AccountBalanceQuery, AccountCreateTransaction,
    Client,
    Hbar,  PublicKey as HederaPubKey,
    HbarUnit,
    TransferTransaction
} from "@hashgraph/sdk";
import {readFileSync} from "fs";
async function init() {
    const provider = new hethers.providers.BaseProvider({
        network: {
            '127.0.0.1:50211': '0.0.3',
        },
        mirrorNodeUrl: '127.0.0.1:5600'
    });
    provider._network.chainId = 0;

    const hederaEoa = {
        account: '0.0.1001',
        privateKey: '0x2f08daf9e3c1efc2a0cc9d016a79ef80e9af44193966ea8fde32c032ade894c7'
    };
    // @ts-ignore
    const wallet3 = new hethers.Wallet(hederaEoa, provider);

    const abiTokenWithArgs = JSON.parse(readFileSync('packages/tests/contracts/TokenWithArgs.json').toString());
    const bytecodeTokenWithArgs = readFileSync('packages/tests/contracts/TokenWithArgs.bin').toString();

    const contractFactory = new hethers.ContractFactory(abiTokenWithArgs, bytecodeTokenWithArgs, wallet3);
    const contract = await contractFactory.deploy(hethers.BigNumber.from('10000'), {gasLimit: 3000000});

    console.log(contract.address);
    await contract.deployed();
    console.log(contract.address);

    const tx = await wallet3.sendTransaction({
        to: '0.0.1002',
        value: 100
    });
    await tx.wait();
    console.log(tx);

    console.log(1)
    return;


    // 0.0.1032
    // 0x95350ed7dab6756847738b20f82623298976e7338477fc1c375dfe89d7935995
    //
    // 1==1;

    // // const test = hethers.getDefaultProvider('testnet');
    // // const test = new hethers.providers.HederaProvider('0.0.3', '127.0.0.1:50211', config.mirrorNodeUrl);
    // const provider = new hethers.providers.BaseProvider({
    //     network: {
    //         '127.0.0.1:50211': '0.0.3',
    //     },
    //     mirrorNodeUrl: '127.0.0.1:5600'
    // });
    // // 0x00000000000000000000000000000000000003fd
    // // 0x00000000000000000000000000000000000003ff
    // const hprovider2 = new hethers.providers.HederaProvider('0.0.3', '127.0.0.1:50211', '127.0.0.1:5600');
    //
    // const abiToken = JSON.parse(readFileSync('packages/tests/contracts/Token.json').toString());
    // const abiTokenWithArgs = JSON.parse(readFileSync('packages/tests/contracts/TokenWithArgs.json').toString());
    // const bytecodeToken = readFileSync('packages/tests/contracts/Token.bin').toString();
    // const bytecodeTokenWithArgs = readFileSync('packages/tests/contracts/TokenWithArgs.bin').toString();
    //
    // // @ts-ignore
    // const wallet2 = new hethers.Wallet({
    //     // @ts-ignore
    //     account: '0.0.1001',
    //     // @ts-ignore
    //     privateKey: '0x2b46b79899798419facd917cbff0924d02f3a803f86dcd50bdc06faf9c3f64b4'
    // }, provider);
    //
    // const contract3 = hethers.ContractFactory.getContract('0x00000000000000000000000000000000000003fd', abiTokenWithArgs, wallet2);
    // const addr = await wallet2.getAddress();
    // console.log(await contract3.balanceOf(addr, {gasLimit: 30000}   ));
    // const mint = await contract3.mint(BigNumber.from(`1`), { gasLimit: 300000 });
    // await mint.wait();
    // console.log(mint);return;
    //
    // const contractFactory = new hethers.ContractFactory(abiTokenWithArgs, bytecodeTokenWithArgs, wallet2);
    // const contract = await contractFactory.deploy(hethers.BigNumber.from('10000'), {gasLimit: 3000000});
    // console.log(contract.address);
    // await contract.deployed();
    //
    // console.log(contract.address);
    // return;

    // console.log((await provider.getBalance('0.0.3')).toString());
    // console.log((await provider.getBalance('0.0.4')).toString());
    // console.log((await provider.getBalance('0.0.5')).toString());
    // console.log((await provider.getBalance('0.0.6')).toString());
    // console.log((await provider.getBalance('0.0.7')).toString());
    // console.log((await provider.getBalance('0.0.8')).toString());
    // console.log((await provider.getBalance('0.0.9')).toString());
    // console.log((await provider.getBalance('0.0.10')).toString());
    // console.log((await provider.getBalance('0.0.11')).toString());
    // console.log((await provider.getBalance('0.0.12444')).toString());
    // return;



    const client = Client.forNetwork({
        '127.0.0.1:50211': '0.0.3'
    }).setOperator('0.0.2', '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137');

    for(let i=0; i<5; i++) {
        const randomWallet = hethers.Wallet.createRandom();
        const tx = await new AccountCreateTransaction()
            .setKey(HederaPubKey.fromString(randomWallet._signingKey().compressedPublicKey))
            .setInitialBalance(Hbar.fromTinybars(100000000000))
            .execute(client);
        const getReceipt = await tx.getReceipt(client);
        // @ts-ignore
        console.log(getReceipt.accountId.toString());
        console.log(randomWallet._signingKey().privateKey);
    }
    return;

    const hprovider = new hethers.providers.HederaProvider('0.0.3', '127.0.0.1:50211', '127.0.0.1:5600');
    const balance = await hprovider.getBalance('0.0.1');
    console.log(balance);

    const genesisCredentials = {
        account: '0.0.1003',
        privateKey: "0xc5bb7745013741ae976e2084c4ae3d6365653e722de05df4e0d8a4b1c3b89b2a",
    }

    // @ts-ignore
    const wallet =  new hethers.Wallet(genesisCredentials, hprovider);
    console.log((await wallet.getBalance()).toString());
    1 == 1;
    // const start = (new Date()).getTime();
    // const provider = hethers.providers.getDefaultProvider('testnet');
    // const customProvider = new hethers.providers.HederaProvider('0.0.3', '0.testnet.hedera.com:50211', 'hcs.testnet.mirrornode.hedera.com:5600');
    // console.log(customProvider);

    // const contract = hethers.ContractFactory.getContract('0x0000000000000000000000000000000001c42805', abiTokenWithArgs, wallet);
    // @ts-ignore
    // const signer = new hethers.Wallet(hederaEoa, provider);
    // const factory = new hethers.ContractFactory(abiTokenWithArgs, bytecodeTokenWithArgs, signer);
    // const contract = await factory.deploy(hethers.BigNumber.from("1000000"), {gasLimit: 300000});
    // const connectedSigner = signer.connect(provider);
    //
    // const random = hethers.Wallet.createRandom();
    // await connectedSigner.createAccount(random._signingKey().compressedPublicKey);
}

init();