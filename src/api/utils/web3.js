const Web3 = require('web3')
const { providerAddress, appName } = require('../../config/vars');

exports.verifySign = async (address, signature) => {
    return new Promise(async (resolve, reject) => {
        try {
            const web3 = await new Web3(providerAddress)
            const msg = (`${appName} uses this cryptographic signature in place of a password, verifying that you are the owner of this address.`)
            const recoveredAddress = await web3.eth.accounts.recover(
                web3.utils.fromUtf8(msg),
                signature
            )

            // if recovered address is equal to given address then user has valid signature
            if (recoveredAddress === address)
                return resolve(true)
            else
                return resolve(false)
        }
        catch (e) {
            console.log(e)
            resolve(false)
        }
    });
};