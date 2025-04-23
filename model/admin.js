import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: String,
    email: String,
    password: String,
    role: {
      type: String,
      enum: ["admin", "administrator"], // restrict to these two roles
      required: true,
    },
    adminId: {
      type: String,
      required: function () {
        return this.role === "admin";
      },
    },
    administratorId: {
      type: String,
      required: function () {
        return this.role === "administrator";
      },
    },
    notificationToken: {
      type: String, // e.g., FCM device token
    },
    permissions: [String], // optional: custom access flags
  },
  { timestamps: true }
);

const CORE = model("CORE", userSchema);

export default CORE;
