import mongoose from "mongoose";

const conductorDocumentSchema = new mongoose.Schema({
  name: {
    type: String, // Document name (e.g., "Bus Registration", "Insurance")
  },
  url: {
    type: String, // URL or path to the document (e.g., file path or URL)
  },
});

const conductorSchema = new mongoose.Schema({
  conductorId: {
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
  profilePhoto: {
    type: String, // URL or path to the conductor's profile photo
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
    default: Date.now, // Date when the conductor joined
  },
  status: {
    type: String,
    enum: ["Active", "Inactive", "On Leave"],
    default: "Active",
  },
  role: {
    type: String,
    default: "conductor",
  },
  conductorDocuments: [conductorDocumentSchema], // Array of document objects with name and URL
});

const Conductor = mongoose.model("Conductor", conductorSchema);

export default Conductor;
