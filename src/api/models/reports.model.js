const mongoose = require('mongoose');

/**
 * Reports Schema
 * @private
 */
const ReportsSchema = new mongoose.Schema({
    nftId: { type: mongoose.Schema.Types.ObjectId, required: true},
    reportedTo: { type: mongoose.Schema.Types.ObjectId, required: true},
    reportedBy: { type: mongoose.Schema.Types.ObjectId, required: true},
    description: { type: String, required: true},
    status : {type: Number ,default : 1} // 1- pending, 2- In-Review, 3- Resolved

}, { timestamps: true }
);

/**
 * @typedef Reports
 */

module.exports = mongoose.model('report', ReportsSchema);