
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import ky from "ky";
import ejsMate from "ejs-mate";

import connectToMongoose from "./utils/connectToMongoose.js";

import squareRoutes from "./routes/squareRoutes.js";
import tccRoutes from "./routes/tccRoutes.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.json());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
// Use ejs-mate as rendering engine for EJS, overriding the default
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "/public")));

//Connect to Mongoose with an initial 5 second delay before next attempt, if failed
// connectToMongoose(5000);

app.use("/square", squareRoutes);
app.use("/tcc", tccRoutes);

app.get("/health", async (req, res) => {
    try {
        const testData = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.TEAM_KITTEN_PUBLIC_KEY}&pagination[limit]=1&search[status]=Available`, {
            retry: {
                limit: 5,
                methods: ['get'],
                statusCodes: [413, 429, 503],
                backoffLimit: 10000
            }
        }).json();
        if (testData.collection.length > 0) {
            res.status(200).send("OK");
        }
    } catch (error) {
        console.error(error);
        res.status(502).send("There is a problem with the Petstablished API");
    }
});

app.all("*", (req, res) => {
    console.log("Invalid request received for", req.path)
    console.log("Invalid request received for", req.path)
    res.send("This is not a valid page");
});

app.listen(process.env.PORT, () => {
    console.log("Express listening on port ", process.env.PORT);
});