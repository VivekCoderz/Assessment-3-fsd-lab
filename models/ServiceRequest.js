const mongoose = require("mongoose");

const CATEGORIES = ["Computer", "Classroom Equipment", "Internet", "Hostel", "Electrical", "Library", "Other"];
const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["Pending", "Under Review", "Assigned", "In Progress", "Resolved", "Closed", "Rejected"];

// Which status can go to which next status
const ALLOWED_NEXT = {
  "Pending": ["Under Review", "Rejected"],
  "Under Review": ["Assigned", "Rejected"],
  "Assigned": ["In Progress"],
  "In Progress": ["Resolved"],
  "Resolved": ["Closed"],
  "Closed": [],
  "Rejected": [],
};

const serviceRequestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    priority: { type: String, enum: PRIORITIES, default: "Medium" },
    status: { type: String, enum: STATUSES, default: "Pending" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    adminResponse: { type: String, default: "" },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

const ServiceRequest = mongoose.model("ServiceRequest", serviceRequestSchema);

module.exports = { ServiceRequest, CATEGORIES, PRIORITIES, STATUSES, ALLOWED_NEXT };
