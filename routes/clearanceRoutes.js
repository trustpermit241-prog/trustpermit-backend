const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/clearanceController");
const auth = require("../middleware/authMiddleware");

router.post("/request", auth, ctrl.requestClearance);
router.get("/verify/:id", ctrl.verifyClearance);

module.exports = router;
