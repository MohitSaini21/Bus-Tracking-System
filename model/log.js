import mongoose from "mongoose";

const busLogSchema = new mongoose.Schema({
  busId: { type: String, required: true },
  events: [
    {
      event: { type: String, enum: ["Entered", "Exited"], required: true },
      gateNumber: { type: String, required: true },
      timestamp: { type: Date, required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
      durationInCampus: { type: Number, default: 0 }, // duration in minutes
    },
  ],
  

});

const BusLog = mongoose.model("BusLog", busLogSchema);
export default BusLog;
    