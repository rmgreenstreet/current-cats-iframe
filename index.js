
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import ky from "ky";
import ejsMate from "ejs-mate";

import asyncWrapper from "./utils/asyncWrapper.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
// Use ejs-mate as rendering engine for EJS, overriding the default
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "/public")));

app.get("/tcc/cats", async (req, res) => {
    const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available`).json();
    console.log(data.collection[0]);
    res.render("iframe", {data});
});

app.all("*", (req, res) => {
    res.send("This is not a valid page");
})

app.listen(process.env.PORT, () => {
    console.log("Express listening on port ", process.env.PORT);
})