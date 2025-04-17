import express from "express";
import Bus from "../model/Bus.js";
import Conductor from "../model/conductor.js";
let router = express.Router();
router.get("/", async (req, res) => {
  const bus = await Bus.findOne({
    conductor: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("conductor/index.ejs", { bus });
  }
});

router.get("/GoLive", async (req, res) => {
  const bus = await Bus.findOne({
    conductor: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("conductor/goLive.ejs", { bus, role: "conductor" });
  }
});

router.get("/stream", async (req, res) => {
  const bus = await Bus.findOne({
    conductor: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("conductor/stream.ejs", { bus, role: "conductor" });
  }
});

export { router as conductorRouter };
