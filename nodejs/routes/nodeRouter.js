const express = require("express");
const controller = require("../controllers/nodeController.js");
const router = express.Router();

router.get("/list", controller.nodeList);

router.get("/num", controller.nodeNum);

module.exports = router;