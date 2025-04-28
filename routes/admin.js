import express from "express";
import CORE from "../model/admin.js";
import Bus from "../model/bus.js";
let router = express.Router();

router.get("/", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    res.render("adminAdministrator/index.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/garrage", async (req, res) => {
  const user = await CORE.findById(req.user.id);
  const buses = await Bus.find({});

  if (user) {
    res.render("adminAdministrator/garrage.ejs", { buses, user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/CDB", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("adminAdministrator/CDB.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/allBusLocaton", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("adminAdministrator/allBusLocation.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/particularBusLive/:id", async (req, res) => {
  let bus = await Bus.findById(req.params.id);
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("adminAdministrator/paritcularBusLive.ejs", {
      bus,
      user,
    });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("authToken"); // clear the correct cookie
  return res.redirect("/coreLogin");
});
export { router as adminRouter };
