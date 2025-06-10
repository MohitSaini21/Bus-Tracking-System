import mongoose from "mongoose";

const fcmSchema = new mongoose.Schema({
  fcmToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus",
    required: true,
  },
  stopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stop",
    required: true,
  },
  role: {
    type: String,
    enum: ["student", "driver", "admin"],
    default: "student",
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: "30d" }, // TTL index: expires 30 days after createdAt
  },

  isActive: {
    type: Boolean,
    default: true, // Can be used to soft-disable tokens
  },
});

const FCM = mongoose.model("FCM", fcmSchema);

export default FCM;
