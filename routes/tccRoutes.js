import express from "express";
const router = express.Router();

import asyncWrapper from "../utils/asyncWrapper.js";
import checkNumberOfAdults from "../utils/checkNumberOfAdults.js";
import { fetchAllCatsData, buildFlyer } from "../controllers/tccControllers.mjs"

const defaultDescription = "We're still getting to know this little one's personality! Check back soon for an accurate description of this cutie."

router.get("/cats", asyncWrapper(async (req, res) => {
    console.log("Loading cats iframe");
    try {
        const data = await fetchAllCatsData();
        console.log("Total Cats Found:", data.length);
        res.render("iframe", { data, defaultDescription });
    } catch (err) {
        console.error(err);
        res.status(502);
        res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com");
    }
}));

router.get("/flyers", asyncWrapper(async (req, res) => {
    console.log("Loading flyer builder");
    try {
        const data = await fetchAllCatsData();
        console.log("Total Cats Found:", data.length);
        const adults = await checkNumberOfAdults(data);
        res.render("flyers", { data, adults, defaultDescription });
    } catch (err) {
        console.error(err);
        res.status(502);
        res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com");
    }
}));

router.post("/flyers", asyncWrapper(async (req, res) => {
    try {
        const selectedCat = JSON.parse(req.body.selectedCat);
        // console.log("selectedCat", selectedCat);
        const data = await fetchAllCatsData(selectedCat.name);
        // console.log("data:", data);
        const cat = data[0];
        console.log("Building flyer for:", cat.name);
        return await buildFlyer(cat, res);
    } catch (err) {
        console.error(err);
        res.status(502)
        res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com");
    }
}));

export default router;