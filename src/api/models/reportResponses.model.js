const mongoose = require('mongoose');

/**
 * Report Responses Schema
 * @private
 */
const ReportResponseSchema = new mongoose.Schema({
    reportId: { type: mongoose.Schema.Types.ObjectId, required: true},
    userResponse: { type: String },
    adminResponse: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId },
    adminId : {type: mongoose.Schema.Types.ObjectId } 

}, { timestamps: true }
);

/**
 * @typedef ReportResponses
 */

module.exports = mongoose.model('reportResponse', ReportResponseSchema);