// multer
const fs = require('fs')
const multer = require('multer')
const { supportedTypes } = require('../../config/vars')
const uploadsDir = './src/uploads/'

const imagesDir = `${uploadsDir}images/`
const audiosDir = `${uploadsDir}audios/`
const compressedDir = `${uploadsDir}compressed/`
const discDir = `${uploadsDir}discs/`
const databasesDir = `${uploadsDir}databases/`
const emailsDir = `${uploadsDir}emails/`
const execDir = `${uploadsDir}exec/`
const pptsDir = `${uploadsDir}ppts/`
const webDir = `${uploadsDir}web/`
const fontsDir = `${uploadsDir}fonts/`
const codesDir = `${uploadsDir}codes/`
const spreadsheetsDir = `${uploadsDir}spreadsheets/`
const systemDir = `${uploadsDir}system/`
const videosDir = `${uploadsDir}videos/`
const docsDir = `${uploadsDir}docs/`
const miscellaneousDir = `${uploadsDir}others/`

// const directories = [imagesDir, audiosDir, compressedDir, discDir, databasesDir, emailsDir, execDir, pptsDir, webDir, fontsDir, codesDir, spreadsheetsDir, systemDir, videosDir, docsDir]
const directoryTypes = [
    {
        name: "images",
        dir: imagesDir,
        types: ['bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'tif', 'tiff'],
    },
    {
        name: "audios",
        dir: audiosDir,
        types: ['mp3', 'ogg', 'wav'],
    },
    {
        name: "compressed",
        dir: compressedDir,
        types: ['arj', '7z', 'deb', 'pkg', 'rar', 'rpm', 'tar.gz', 'tar', 'z', 'zip'],
    },
    {
        name: "discs",
        dir: discDir,
        types: ['bin', 'dmg', 'iso', 'toast', 'vcd'],
    },
    {
        name: "databases",
        dir: databasesDir,
        types: ['csv', 'dat', 'db', 'dbf', 'log', 'mdb', 'sav', 'sql', 'xml'],
    },
    ,
    {
        name: "emails",
        dir: emailsDir,
        types: ['email', 'eml', 'emlx', 'msg', 'oft', 'ost', 'pst', 'vcf'],
    },
    {
        name: "exec",
        dir: execDir,
        types: ['apk', 'bat', 'com', 'exe', 'gadget', 'jar', 'wsf'],
    },
    {
        name: "web",
        dir: webDir,
        types: ['asp', 'aspx', 'cer', 'crt', 'cfm', 'css', 'html', 'htm', 'jsp', 'part', 'rss', 'xhtml'],
    },
    {
        name: "ppts",
        dir: pptsDir,
        types: ['key', 'odp', 'pps', 'ppt', 'pptx'],
    },
    {
        name: "fonts",
        dir: fontsDir,
        types: ['fnt', 'fon', 'otf', 'ttf'],
    },
    {
        name: "codes",
        dir: codesDir,
        types: ['c', 'cgi', 'pl', 'class', 'cpp', 'cs', 'h', 'java', 'php', 'py', 'sh', 'swift', 'vb', 'js'],
    },
    {
        name: "spreadsheets",
        dir: spreadsheetsDir,
        types: ['ods', 'xls', 'xlsm', 'xlsx'],
    },
    {
        name: 'system',
        dir: systemDir,
        types: ['bak', 'cab', 'cfg', 'cpl', 'cur', 'dll', 'dmp', 'drv', 'icns', 'ini', 'lnk', 'msi', 'sys', 'tmp'],
    },
    {
        name: "videos",
        dir: videosDir,
        types: ['3g2', '3gp', 'm4v', 'mkv', 'mov', 'mp4'],
    },
    {
        name: "docs",
        dir: docsDir,
        types: ['doc', 'docx', 'odt', 'pdf', 'rtf', 'tex', 'txt', 'wpd'],
    },
    {
        name: "others",
        dir: miscellaneousDir,
        types: ['psd', 'ai', 'ps'],
    }

]
const storage = multer.diskStorage({
    destination: function (req, file, cb) {

        // make uploads directory if do not exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir)
        }

        // create other directories
        for (var i in directoryTypes) {
            if (!fs.existsSync(directoryTypes[i].dir)) {
                fs.mkdirSync(directoryTypes[i].dir)
            }
        }
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        var fileExtension = file.originalname.match(/\.([^\.]+)$/)[1]
        if (file.originalname.endsWith('.' + 'gz'))
            fileExtension = 'tar.gz'
        let dir = ''
        for (var i in directoryTypes) {
            if (directoryTypes[i].types.includes(fileExtension)) {
                dir = directoryTypes[i].name
            }
        }
        if (!supportedTypes.includes(fileExtension)) {
            return cb(new Error('File Type not allowed'))
        }

        cb(null, dir + '/' + Date.now() + '.' + fileExtension)
    }
})
const upload = multer({ storage })
exports.cpUpload = upload.fields([{ name: 'image', maxCount: 1 }])

exports.createNftUploads = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }])

exports.uploadSingle = upload.single('image')
exports.uploadContentImage = upload.single('files')
exports.collectionUpload = upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'featuredImg', maxCount: 1 }, { name: 'banner', maxCount: 1 }])
exports.profileUpload = upload.fields([{ name: 'profileImage', maxCount: 1 }, { name: 'badgeImage', maxCount: 1 }, { name: 'bannerImage', maxCount: 1 }])
exports.categoryUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }])

// ipfs
const { create } = require('ipfs-http-client')
const { ipfsServerUrl, ipfsBaseUrl } = require('../../config/vars')
const ipfs = create(ipfsServerUrl)

exports.addImage = async (data) => {
    const fileAdded = await ipfs.add(data)
    const imgHash = (fileAdded.cid).toString()
    return `${ipfsBaseUrl}${imgHash}`
}

exports.addContent = async (data) => {
    const doc = JSON.stringify(data);
    const dataAdded = await ipfs.add(doc);
    const dataHash = (dataAdded.cid).toString()
    return `${ipfsBaseUrl}${dataHash}`
}