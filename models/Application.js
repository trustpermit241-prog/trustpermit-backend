const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    applicationType: String,

    taxpayer: {
      registrantName: String,
      registrantPosition: String,
      ownershipType: String,
    },

    applicant: {
      firstName: String,
      middleName: String,
      lastName: String,
      suffixName: String,
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
      block: String,
      lot: String,
      landmark: String,
    },

    contact: {
      telephone: String,
      mobile: String,
      fax: String,
      email: String,
      tin: String,
    },

    businessInfo: {
      businessName: String,
      projectType: String,
      zoneType: String,
      area: String,
      malePersonnel: Number,
      femalePersonnel: Number,
      totalPersonnel: Number,
      lineOfBusiness: String,
    },

    signature: String,

    requirements: {
      locational_clearance: String,
      barangay_clearance: String,
      fire_safety_certification: String,
      building_permit: String,
      wiring_permit: String,
    },

    // Optional permit metadata
    permitNumber: String,
    previousApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
    },

    expiryDate: Date,

    status: {
      type: String,
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Application",
  applicationSchema,
  "applications"
);