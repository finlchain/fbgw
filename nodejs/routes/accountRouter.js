const express = require("express");
const controller = require("../controllers/accountControllers.js");
const router = express.Router();

// router.post("/balance", controller.getBalance);

router.get("/status", controller.getStatus);

router.get("/list", controller.accountList);

router.get("/txlist", controller.accountTXList);

router.get("/num", controller.accountNum);

module.exports = router;