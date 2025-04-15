import express from "express";
import Bus from "../modal/Bus.js";
import Conductor from "../modal/conductor.js";
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
    return res.render("conductor/goLive.ejs", { bus });
  }
});

export { router as conductorRouter };
