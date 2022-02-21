const hethers = require("hethers");
import { HederaNetworks } from "@hethers/providers/lib/default-hedera-provider";

(async () => {
    const accountNum = 98;

    const provider = hethers.providers.getDefaultProvider(HederaNetworks.TESTNET);
    const accountConfig = { shard: BigInt(0), realm: BigInt(0), num: BigInt(accountNum) };
    const solAddr = hethers.utils.getAddressFromAccount(accountConfig);

    /**
     * Example 1: Getting Balance for account
     */
    let balance = await provider.getBalance(hethers.utils.getAddressFromAccount(accountConfig));
    console.log(`Balance of 98 account: ${balance}`);

    // ensure it works with solidity addresses as well
    balance = await provider.getBalance(solAddr);
    console.log(`Balance of 98 account: ${balance}`);

    /**
     * Example 2: Getting Transaction Record
     */
    const txId = `0.0.15680048-1638189529-145876922`;
    const record = await provider.getTransaction(txId);
    console.log(`Transaction Record:`);
    console.log(record);

    /**
     * Example 3: Submitting Signed Transaction
     */
    const signedTx = "0x0aba012ab7010a4d0a1a0a0c08b2a1818e0610ca969fb10212080800100018d7ce20180012060800100018031880c2d72f220208783200721c0a1a0a0a0a0608001000186210020a0c0a080800100018d7ce20100112660a640a200ba029dd87a99c3089e0b1a062fb6c97300a1856638009345d2a40bd6cb169db1a40766dede346621caa3c19b504fbaf414a4cccff7f989915e4367621ffe04ccf8435576044ff90f2117078fcec26c82e08733c49e6099e0bc2b996ca0edeb79d06";
    await provider.sendTransaction(signedTx);

    /**
     * Example 4: Connecting to custom consensus and mirror node URLs via HederaProvider
     */
    const consensusNodeUrl = '0.testnet.hedera.com:50211';
    const consensusNodeId = '0.0.3';
    const mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
    const provider2 = new hethers.providers.HederaProvider(consensusNodeId, consensusNodeUrl, mirrorNodeUrl);

    const balance2 = await provider2.getBalance(solAddr);
    console.log(balance2);

    const record2 = await provider2.getTransaction(txId);
    console.log(record2);


    /**
     * Example 5: Filtering contract logs
     */
    const filterParams = {
        // address: "0.0.25623322",
        address: "0x000000000000000000000000000000000186fb1A",
        fromTimestamp: "1642065156.264170833",
        toTimestamp: "1642080642.176149864"
    }

    const logs = await provider.getLogs(filterParams);
    console.log(`Contract ${filterParams.address} logs:`);
    console.dir(logs, {depth: null});


    /**
     * Example 6: Getting contract bytecode
     */
    const contractNum = 16645669;
    const contractAccountConfig = { shard: BigInt(0), realm: BigInt(0), num: BigInt(contractNum) };
    const contractSolAddr = hethers.utils.getAddressFromAccount(contractAccountConfig);
    console.log(`Get bytecode for contract with num ${contractNum} <->`, contractSolAddr);
    
    let contractBytecode = await provider.getCode(hethers.utils.getAddressFromAccount(contractAccountConfig));
    console.log(contractBytecode);

    //not a contract 
    contractBytecode = await provider.getCode("0x0000000000000000000000000000000000000000");
    console.log(contractBytecode);
    contractBytecode = await provider.getCode("0x0000000000000000000000000000000000000000", true);
    console.log(contractBytecode);


    const expiredContractNum = 15067;
    const expiredContractAccountConfig = { shard: BigInt(0), realm: BigInt(0), num: BigInt(expiredContractNum) };
    const expiredContractSolAddr = hethers.utils.getAddressFromAccount(expiredContractAccountConfig);
    //contract with an empty bytecode
    contractBytecode = await provider.getCode(expiredContractSolAddr);
    console.log(contractBytecode);
})();

