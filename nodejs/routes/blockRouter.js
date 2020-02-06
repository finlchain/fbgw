const express = require("express");
const controller = require("../controllers/blockControllers.js");
const router = express.Router();

router.get("/blkinfo", controller.LightBlkInfo);

router.get("/list", controller.BlkList);

router.get("/last/blknum", controller.lastBlkNum);

module.exports = router;