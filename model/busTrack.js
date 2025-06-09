import mongoose from "mongoose";

const { Schema, model } = mongoose;

const stopLogSchema = new Schema({
  stop: { type: Schema.Types.ObjectId, ref: "Stop", required: true },
  stopName: String,
  morningTime: Date,
  eMorningTime: Date,
  eveningTime: Date,
  eEveningTime: Date,
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

      timestamp: { type: Date, required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
  ],
});

const BusActivityLog = model("BusActivityLog", busActivityLogSchema);
export default BusActivityLog;



