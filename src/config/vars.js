const path = require('path');
// import .env variables
require('dotenv').config();
module.exports = {
  jwtExpirationInterval: process.env.JWT_EXPIRATION_MINUTES,
  encryptionKey: process.env.ENCRYPTION_KEY,
  env: process.env.NODE_ENV,
  port: process.env.PORT,
  frontEncSecret: process.env.FRONT_ENC_SECRET,
  ipfsBaseUrl: process.env.IPFS_BASE_URL,
  ipfsServerUrl: process.env.IPFS_SERVER_URL,
  adminUrl: process.env.ADMIN_URL,
  emailAdd: process.env.EMAIL,
  mongo: {
    uri: process.env.MONGO_URI,
  },
  mailgunPrivateKey: process.env.MAILGUN_PRIVATE_KEY,
  providerAddress: process.env.PROVIDER_ADDRESS,
  mailgunDomain: process.env.MAILGUN_DOMAIN,
  pwEncryptionKey: process.env.PW_ENCRYPTION_KEY,
  pwdSaltRounds: process.env.PWD_SALT_ROUNDS,
  USDtoBNBLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=2781&convert_id=1839',
  USDtoMYNTLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=2781&convert_id=11583',
  WBNBtoUSDLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=7192&convert_id=2781',
  MYNTtoUSDLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=11583&convert_id=2781',
  WBNBtoBNBLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=7192&convert_id=1839',
  MYNTtoBNBLink: 'https://api.coinmarketcap.com/data-api/v3/tools/price-conversion?amount=1&id=11583&convert_id=1839',
  appName: process.env.APP_NAME,
  contractAddress: process.env.NFT_CONTRACT_ADDRESS,
  myntContractAddress: process.env.MYNT_CONTRACT_ADDRESS,
  baseUrl: process.env.BASE_URL,
  walletAccount: process.env.WALLET_ACCOUNT,
  walletPK: process.env.WALLET_PRIVATE_KEY,
  tokenNameToValue: {
    'MYNT': 1,
    'WBNB': 2
  },
  extendAuctionTimeBy: 10, // in minutes
  adminPasswordKey: process.env.ADMIN_PASSWORD_KEY,
  paypalMode: process.env.PAYPAL_MODE,
  supportedTypes: ['ai', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'ps', 'psd', 'svg', 'tif', 'tiff', 'mp3', 'ogg', 'wav', 'arj', '7z',
    'deb', 'pkg', 'rar', 'rpm', 'tar.gz', 'z', 'zip', 'bin', 'dmg', 'iso', 'toast', 'vcd', 'csv', 'dat', 'db', 'dbf', 'log', 'mdb', 'sav', 'sql', 'tar', 'xml', 'email', 'eml',
    'emlx', 'msg', 'oft', 'ost', 'pst', 'vcf', 'apk', 'bat', 'com', 'exe', 'gadget', 'jar', 'msi', 'wsf', 'key', 'odp', 'pps', 'ppt', 'pptx',
    'asp', 'aspx', 'cer', 'crt', 'cfm', 'css', 'html', 'htm', 'js', 'jsp', 'part', 'php', 'rss', 'xhtml', 'key', 'odp', 'pps', 'ppt', 'pptx', 'fnt', 'fon', 'otf', 'ttf',
    'c', 'cgi', 'pl', 'class', 'cpp', 'cs', 'h', 'java', 'py', 'sh', 'swift', 'vb', 'ods', 'xls', 'xlsm', 'xlsx', 'bak', 'cab', 'cfg', 'cpl', 'cur', 'dll',
    'dmp', 'drv', 'icns', 'ini', 'lnk', 'sys', 'tmp', '3g2', '3gp', 'm4v', 'mkv', 'mov', 'mp4',
    'doc', 'docx', 'odt', 'pdf', 'rtf', 'tex', 'txt', 'wpd'],
  // compress images API key
  tinifyAPIKey: process.env.TINIFY_API_KEY,
  // static assets CDN links
  nftImgPlaceholder: `${process.env.CDN_BASE_URL}v1652166290/hex-nft/assets/transparent-placeholder_wrydvd.png`,
  colLogoPlaceholder: `${process.env.CDN_BASE_URL}v1652166289/hex-nft/assets/logo-placeholder_jsvyst.jpg`,
  colFeaturedPlaceholder: `${process.env.CDN_BASE_URL}v1652166289/hex-nft/assets/feature-placeholder_xqd6qk.svg`,
  userDefaultImage: `${process.env.CDN_BASE_URL}v1652166289/hex-nft/assets/image-placeholder_qva6dx.png`,
  categoryDefaultImage: `${process.env.CDN_BASE_URL}v1652166290/hex-nft/assets/transparent-placeholder_wrydvd.png`,
  gamificationPlaceholder: `${process.env.CDN_BASE_URL}v1652166290/hex-nft/assets/transparent-placeholder_wrydvd.png`,

  myntMaxDecimals: 100000000
}
