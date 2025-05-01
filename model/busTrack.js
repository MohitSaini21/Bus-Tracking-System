import mongoose from "mongoose";

const { Schema, model } = mongoose;

const stopLogSchema = new Schema({
  stop: { type: Schema.Types.ObjectId, ref: "Stop", required: true },
  morningArrival: Date,
  eveningArrival: Date,
  morningDeparture: Date,
  eveningDeparture: Date,
});

const busActivityLogSchema = new Schema({
  bus: { type: Schema.Types.ObjectId, ref: "Bus", required: true },
  date: { type: Date, required: true },
  stops: [stopLogSchema], // Array of stop logs
  path: [
    {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
  ],
  events: [
    {
      event: { type: String, enum: ["Entered", "Exited"], required: true },
      gateNumber: { type: String, required: false },
      timestamp: { type: Date, required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
  ],
  distance: {
    type: Number, // Assuming this is the total distance in meters or kilometers
    required: false, // This can be optional if it’s updated later
    default: 0, // Default to 0 if not set initially
  },
});

const BusActivityLog = model("BusActivityLog", busActivityLogSchema);
export default BusActivityLog;
