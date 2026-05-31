const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    applicationType: {
      type: String,
      default: "New Application",
    },

    projectType: String,
    zoneType: String,
    businessName: String,

    taxpayer: {
      registrantName: String,
      registrantPosition: String,
      ownershipType: String,
    },

    applicant: {
      firstName: String,
      middleName: String,
      lastName: String,
      suffix: String,
      suffixName: String,

      gender: String,
      civilStatus: String,
      nationality: String,
      contactNumber: String,
      email: String,
      birthDate: String,
    },

    personalInfo: {
      birthDate: String,
      gender: String,
      civilStatus: String,
      nationality: String,
    },

    address: {
      province: String,
      city: String,
      barangay: String,
      subdivision: String,
      street: String,
      building: String,
      houseNo: String,
      houseNumber: String,
      block: String,
      lot: String,
      landmark: String,
    },

    contact: {
      telephone: String,
      mobile: String,
      contactNumber: String,
      fax: String,
      email: String,
      tin: String,
    },

    businessInfo: {
      businessName: String,
      projectType: String,
      zoneType: String,
      area: String,
      businessArea: String,
      malePersonnel: Number,
      femalePersonnel: Number,
      totalPersonnel: Number,
      lineOfBusiness: String,
    },

    businessDetails: {
      businessName: String,
      projectType: String,
      zoneType: String,
      businessArea: String,
      area: String,
      malePersonnel: Number,
      femalePersonnel: Number,
      totalPersonnel: Number,
      lineOfBusiness: String,
    },

    documents: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    attachments: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    uploadedDocuments: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    documentStatuses: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    signature: String,

    requirements: {
      locational_clearance: String,
      barangay_clearance: String,
      fire_safety_certification: String,
      building_permit: String,
      wiring_permit: String,
    },

    permitNumber: String,

    previousApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
    },

    expiryDate: Date,

    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
        "Completed",
        "Inspection",
        "For Payment",
        "Released",
      ],
      default: "Pending",
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

module.exports = mongoose.model(
  "Application",
  applicationSchema,
  "applications"
);