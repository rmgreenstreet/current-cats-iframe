import express from "express";
const router = express.Router();

import asyncWrapper from "../utils/asyncWrapper.js";
import { quickResponse } from "../middleware/index.js";
import { updatedPaymentRequestHandler } from "../controllers/squareControllers.js";

router.post("/payment_updated", quickResponse, asyncWrapper(updatedPaymentRequestHandler));

export default router