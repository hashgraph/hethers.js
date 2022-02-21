const hethers = require("hethers");

// 0x0000000000000000000000000000000000000001 -> 0.0.1
const address = `0x0000000000000000000000000000000000000001`;
const convertedAccount = hethers.utils.getAccountFromAddress(address);
console.log(convertedAccount);

// 0.0.1 -> 0x0000000000000000000000000000000000000001
const account = {shard: BigInt(0), realm: BigInt(0), num: BigInt(1)}
const convertedAddress = hethers.utils.getAddressFromAccount(account);
console.log(`Account: 0.0.1 converted to Address: ${convertedAddress}`);