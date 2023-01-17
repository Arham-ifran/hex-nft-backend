const { nftImgPlaceholder } = require('../../config/vars')

exports.ipfsToUrl = async (str) => {
    if (!!str && typeof (str) === 'object') {
        return str
    }
    if (!str || str?.trim() === '') {
        return nftImgPlaceholder
    }
    if (str.includes('ipfs://')) {
        str = str.replace('ipfs://', '')
        return `https://ipfs.io/ipfs/${str}`
    }
    return str
}