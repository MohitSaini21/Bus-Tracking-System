import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({
  media: {
    type: String, // Path or filename of incident image/video
    required: false,
  },
  explanationAudio: {
    type: String, // Path or filename of explanation audio
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  BusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus", // Reference to the related bus
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver", // Reference to the driver
  },
  conductorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conductor", // Reference to the conductor
  },
});

const Complaint = mongoose.model("Complaint", complaintSchema);

export default Complaint;
