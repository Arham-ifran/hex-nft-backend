const fs = require('fs')
const Category = require('../../models/categories.model')
const Collection = require('../../models/collection.model')
const { addImage } = require('../../utils/upload')
const { checkDuplicate } = require('../../../config/errors')
const { baseUrl, tinifyAPIKey } = require('../../../config/vars')
const tinify = require("tinify");
tinify.key = tinifyAPIKey;

// API to create category
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files)
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

                payload[key] = await addImage(imgData)
                payload[`${key}Local`] = image.filename

                // compressing image and saving to server
                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                    tinify.fromFile(image.path).toFile(image.path);
            }

        const category = await Category.create(payload)
        return res.send({ success: true, message: 'Category created successfully', category })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Category')
        else
            return next(error)
    }
}

// API to edit category
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files)
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

                payload[key] = await addImage(imgData)
                payload[`${key}Local`] = image.filename
            }

        const category = await Category.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        category.image = category.imageLocal ? `${baseUrl}${category.imageLocal}` : ''
        delete category.imageLocal

        return res.send({ success: true, message: 'Category updated successfully', category })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Category')
        else
            return next(error)
    }
}

// API to delete category
exports.delete = async (req, res, next) => {
    try {
        const { categoryId } = req.params
        if (categoryId) {
            const catCollection = await Collection.findOne({ categoryId }, 'name')

            if (catCollection)
                return res.status(400).send({ success: false, message: `This category can not be deleted, because it is already assigned to collection named ${catCollection.name}` })

            const category = await Category.deleteOne({ _id: categoryId })
            if (category && category.deletedCount)
                return res.send({ success: true, message: 'Category deleted successfully', categoryId })
            else return res.status(400).send({ success: false, message: 'Category not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Category Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get a category
exports.get = async (req, res, next) => {
    try {
        const { categoryId } = req.params
        if (categoryId) {
            let category = await Category.findOne({ _id: categoryId }, { _id: 1, name: 1, image: 1, status: 1, description: 1 }).lean(true)
            category.image = category.imageLocal ? `${baseUrl}${category.imageLocal}` : ''

            if (category)
                return res.json({ success: true, message: 'Category retrieved successfully', category })
            else return res.status(400).send({ success: false, message: 'Category not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Category Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get categories list
exports.list = async (req, res, next) => {
    try {
        let { all, page, limit } = req.query
        let { name, status } = req.body
        const filter = {}
        if (name) {
            name = name.trim()
            filter.name = { $regex: name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' };
        }
        if (status !== undefined) {
            filter.status = status
        }
        page = page !== undefined && page !== '' ? parseInt(page) : 1
        if (!all)
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Category.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)


        let pipeline = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
        ]

        if (!all) {
            pipeline.push({ $skip: limit * (page - 1) })
            pipeline.push({ $limit: limit })
        }

        pipeline.push(
            {
                $project: {
                    _id: 1, name: 1, slug: 1,
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, ''] },
                    status: 1, createdAt: 1, description: 1
                }
            }
        )

        const categories = await Category.aggregate(pipeline)

        return res.send({
            success: true, message: 'Categories fetched successfully',
            data: {
                categories,
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