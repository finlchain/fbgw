const express = require("express");
const controller = require("../controllers/txControllers.js");
const router = express.Router();

router.get("/txinfo", controller.singleTXInfo);

router.get("/list", controller.TXList);

module.exports = router;
