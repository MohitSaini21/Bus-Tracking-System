import { timeStamp } from "console";
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
});

const BusActivityLog = model("BusActivityLog", busActivityLogSchema);
export default BusActivityLog;
