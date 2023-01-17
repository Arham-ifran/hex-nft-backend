var mongoose = require('mongoose');

const RolesSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, lowercase: true, unique: true },
        isSuperAdmin: { type: Boolean, default: false },

        /**  system permissions **/

        // dashboard
        viewDashboard: { type: Boolean, default: false },

        // user’s records
        addStaff: { type: Boolean, default: false },
        editStaff: { type: Boolean, default: false },
        deleteStaff: { type: Boolean, default: false },
        viewStaff: { type: Boolean, default: false },

        // users records
        addUser: { type: Boolean, default: false },
        editUser: { type: Boolean, default: false },
        deleteUser: { type: Boolean, default: false },
        viewUsers: { type: Boolean, default: false },

        // categories
        addCategory: { type: Boolean, default: false },
        editCategory: { type: Boolean, default: false },
        deleteCategory: { type: Boolean, default: false },
        viewCategory: { type: Boolean, default: false },

        // categories
        addCollection: { type: Boolean, default: false },
        editCollection: { type: Boolean, default: false },
        deleteCollection: { type: Boolean, default: false },
        viewCollection: { type: Boolean, default: false },

        // stakings
        addStaking: { type: Boolean, default: false },
        editStaking: { type: Boolean, default: false },
        deleteStaking: { type: Boolean, default: false },
        viewStaking: { type: Boolean, default: false },

        // nft's
        addNft: { type: Boolean, default: false },
        editNft: { type: Boolean, default: false },
        viewNft: { type: Boolean, default: false },
        deleteNft: { type: Boolean, default: false },

        //nft's reportings
        viewReports: { type: Boolean, default: false },
        editReports: { type: Boolean, default: false },
        deleteReports: { type: Boolean, default: false },
        viewReportResponses: { type: Boolean, default: false },

        // permissions
        addRole: { type: Boolean, default: false },
        editRole: { type: Boolean, default: false },
        deleteRole: { type: Boolean, default: false },
        viewRole: { type: Boolean, default: false },

        // FAQs / articles
        addFaq: { type: Boolean, default: false },
        editFaq: { type: Boolean, default: false },
        deleteFaq: { type: Boolean, default: false },
        viewFaqs: { type: Boolean, default: false },

        // contact
        viewContact: { type: Boolean, default: false },
        editContact: { type: Boolean, default: false },

        // activity
        viewActivity: { type: Boolean, default: false },

        // settings
        editSetting: { type: Boolean, default: false },
        viewSetting: { type: Boolean, default: false },

        // content
        addContent: { type: Boolean, default: false },
        editContent: { type: Boolean, default: false },
        viewContent: { type: Boolean, default: false },
        deleteContent: { type: Boolean, default: false },


        // email-templates
        editEmails: { type: Boolean, default: false },
        viewEmails: { type: Boolean, default: false },

        // reporting digital assets
        addDigitalAssets: { type: Boolean, default: false },
        viewDigitalassets: { type: Boolean, default: false },
        editDigitalAssets: { type: Boolean, default: false },
        deleteDigitalAssets: { type: Boolean, default: false },

        // help center pages
        addHelpCenterPage: { type: Boolean, default: false },
        editHelpCenterPage: { type: Boolean, default: false },
        viewHelpCenterPage: { type: Boolean, default: false },
        deleteHelpCenterPage: { type: Boolean, default: false },

        // payment Gateways
        addPaymentGateway: { type: Boolean, default: false },
        editPaymentGateway: { type: Boolean, default: false },
        viewPaymentGateway: { type: Boolean, default: false },
        deletePaymentGateway: { type: Boolean, default: false },

        // third party Management
        viewThirdParty: { type: Boolean, default: false },
        editThirdParty: { type: Boolean, default: false },

        // newsletter/subscriptions
        viewNewsLetter: { type: Boolean, default: false },

        // notable drops on homepage
        viewNotableDropsSettings: { type: Boolean, default: false },
        editNotableDropsSettings: { type: Boolean, default: false },

        // nft slider on homepage
        viewHomepageNftSettings: { type: Boolean, default: false },
        editHomepageNftSettings: { type: Boolean, default: false },

        // status (i.e: true for active & false for in-active)
        status: { type: Boolean, default: false },
    },
    {
        timestamps: true
    }
);

RolesSchema.index({ identityNumber: 'title' });

module.exports = mongoose.model("Roles", RolesSchema);
