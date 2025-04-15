import mongoose from "mongoose";

const driverDocumentSchema = new mongoose.Schema({
  name: {
    type: String, // Document name (e.g., "Bus Registration", "Insurance")
  },
  url: {
    type: String, // URL or path to the document (e.g., file path or URL)
  },
});
const driverSchema = new mongoose.Schema({
  driverId: {
    type: String,
    index: true, // This creates an index on 'email'
  },
  password: {
    type: String,
  },
  name: {
    type: String,
  },
  phone: {
    type: String,
  },
  licenseNumber: {
    type: String,
  },
  profilePhoto: {
    type: String, // URL or path to the driver's profile photo
  },

  address: {
    type: String,
  },
  assignedBus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus", // Reference to the assigned bus
  },
  joiningDate: {
    type: Date,
    default: Date.now, // Date when the driver joined the university transport system
  },
  status: {
    type: String,
    enum: ["Active", "Inactive", "On Leave"],
    default: "Active",
  },
  role: {
    type: String,
    default: "driver",
  },
  driverDocuments: [driverDocumentSchema], // Array of document objects with name and URL
});

const Driver = mongoose.model("Driver", driverSchema);

export default Driver;
