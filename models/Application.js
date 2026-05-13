const mongoose = require("mongoose");

const ApplicationSchema = new mongoose.Schema(
  {
    citizenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    businessName: {
      type: String,
      required: true,
    },

    applicationType: {
      type: String,
      enum: ["New Application", "Renewal"],
      default: "New Application",
    },

    projectType: {
      type: String,
      enum: ["Residential", "Commercial"],
      default: "Residential",
    },

    zoneType: {
      type: String,
      enum: ["Residential Zone", "Commercial Zone"],
      default: "Residential Zone",
    },

    applicant: {
      firstName: String,
      middleName: String,
      lastName: String,
      suffixName: String,
      gender: String,
      civilStatus: String,
      nationality: String,
      contactNumber: String,
      email: String,
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

    businessDetails: {
      businessArea: String,
      malePersonnel: Number,
      femalePersonnel: Number,
      ownershipType: String,
      lineOfBusiness: String,
    },

    documents: {
      type: Map,
      of: String,
      default: {},
    },

    documentStatuses: {
      type: Map,
      of: String,
      default: {},
    },

    signature: String,

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    staffNotes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", ApplicationSchema);