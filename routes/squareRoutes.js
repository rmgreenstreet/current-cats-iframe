import express from "express";
const router = express.Router();

import asyncWrapper from "../utils/asyncWrapper.js";
import { quickResponse } from "../middleware/index.js";
import { updatedPaymentRequestHandler, onDemandDisplay } from "../controllers/squareControllers.js";

router.post("/payment_updated", quickResponse, asyncWrapper(updatedPaymentRequestHandler));

router.get("/update-loyalty", asyncWrapper(onDemandDisplay))

export default router