const express = require("express");
const controller = require("../controllers/kafkaControllers.js");
const router = express.Router();

router.get("/broker/list", controller.getBrokerList);

module.exports = router;