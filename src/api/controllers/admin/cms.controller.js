const CMS = require('../../models/cms.model')
const { checkDuplicate } = require('../../../config/errors')

// API to create CMS
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        let checkContentExists = await CMS.findOne({slug : payload.slug})
        if(checkContentExists){
            return res.status(200).send({ success: false, message: 'Content Page title already exists!' })
        }
        const content = await CMS.create(payload)
        return res.status(200).send({ success: true, message: 'Content Page created successfully', content })
    } catch (error) {
        return next(error)
    }
}

// API to edit CMS
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        const content = await CMS.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'Content Page updated successfully', content })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'CMS')
        else
            return next(error)
    }
}

exports.uploadContentPageImg = async(req,res,next) =>{
    try{
        if(req.file){
            return res.status(200).send({success: true, message : 'Image uploaded successfully!', imageData : req.file})
        }
        else {
            return res.status(400).send({success: false, message : 'Image not found!'})

        }
    }
    catch(err){
        next(err)
    }
}
// API to delete content
exports.delete = async (req, res, next) => {
    try {
        const { contentId } = req.params
        if (contentId) {
            const content = await CMS.deleteOne({ _id: contentId })
            if (content && content.deletedCount)
                return res.send({ success: true, message: 'Content Page deleted successfully', contentId })
            else return res.status(400).send({ success: false, message: 'Content Page not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Content Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get a CMS
exports.get = async (req, res, next) => {
    try {
        const { contentId } = req.params
        if (contentId) {
            const content = await CMS.findOne({ _id: contentId }, { _id: 1, title: 1, status:1, slug: 1, description: 1 }).lean(true)
            if (content)
                return res.json({ success: true, message: 'Content Page retrieved successfully', content })
            else return res.status(400).send({ success: false, message: 'CMS not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'CMS Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get CMS list
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        let { title, slug, status} = req.body
        const filter = {}

        if(title){
            title = title.trim()
            filter.title = { $regex: title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' };
        }
        if(status !== undefined){
            filter.status = status
        }
        if(slug){
            filter.slug = {$regex : slug.replace(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),  $options: 'gi'}
        }

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await CMS.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        const contentPages = await CMS.aggregate([
            { $match : filter },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $project: {
                    _id: 1, title: 1, status : 1, description : 1, slug : 1
                }
            }
        ])

        return res.send({
            success: true, message: 'Content Pages fetched successfully',
            data: {
                contentPages,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                }
            }
        })
    } catch (error) {
        return next(error)
    }
}