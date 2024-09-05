
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import ky from "ky";
import sharp from "sharp";
import QRCode from 'qrcode';
import PDFDocument from "pdfkit";
import ejsMate from "ejs-mate";

import asyncWrapper from "./utils/asyncWrapper.js";
import removeEmoji from "./utils/removeEmoji.js";
import checkNumberOfAdults from "./utils/checkNumberOfAdults.js";
import catFormatChecking from "./utils/catFormatChecking.js";
import connectToMongoose from "./utils/connectToMongoose.js";

import squareRoutes from "./routes/squareRoutes.js";

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express();

app.use(express.urlencoded({extended : true}));
app.use(express.json());
app.use(express.json());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
// Use ejs-mate as rendering engine for EJS, overriding the default
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "/public")));

//Connect to Mongoose with an initial 5 second delay before next attempt, if failed
connectToMongoose(5000);

app.use("/square", squareRoutes)

//Connect to Mongoose with an initial 5 second delay before next attempt, if failed
connectToMongoose(5000);

app.use("/square", squareRoutes)

// TODO Add error handling, because it's unlikely the petstablished api will have 100% uptime
app.get("/tcc/cats", asyncWrapper(
    async (req, res) => {
        console.log("Loading cats iframe")
        const defaultDescription = "We're still getting to know this little one's personality! Check back soon for an accurate description of this cutie."
        try {
            const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available`, {
                retry: {
                    limit: 3,
                    methods: ['get'],
                    statusCodes: [413, 429, 503],
                    backoffLimit: 3000
                }
            }).json();
            if (data.collection.length) {
                for (let cat of data.collection) {
                    cat = catFormatChecking(cat);
                };
            } else {
                throw new (error);
            }
            console.log("Found cats:", data.collection.length);
            res.render("iframe", {data, defaultDescription});
        } catch (error) {
            console.error(error);
            res.status(502);
            res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com")
        }
    })
);

app.get("/tcc/flyers", asyncWrapper( 
    async (req, res) => {
        console.log("Loading flyer selection")
        try {
            const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available`, {
                retry: {
                    limit: 3,
                    methods: ['get'],
                    statusCodes: [413, 429, 503],
                    backoffLimit: 3000
                }
            }).json();
            const adults = await checkNumberOfAdults(data.collection);
            console.log("Found cats:", data.collection.length);
            res.render("flyers", {data, adults});
        } catch (error) {
            console.error(error);
            res.status(502)
            res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com")
        }
    })
);

app.post("/tcc/flyers", async (req, res) => {
    console.log("Building flyer PDF")
    try {
        const listOfCats = req.body.selected;
        const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available&search[name]=${listOfCats.join(",")}`, {
            retry: {
                limit: 3,
                methods: ['get'],
                statusCodes: [413, 429, 503],
                backoffLimit: 3000
            }
        }).json();
        const cat = data.collection[0];
        console.log("Found cat:", cat.name.slice(20).trim());
        if (!cat.pet_internal_notes){ cat.pet_internal_notes = "We're still getting to know this little one! Check back soon for a more accurate description." }
        
        let doc = new PDFDocument({size: "LETTER", margin: 24});
    
        const pageTitle = `Meet ${cat.name.slice(20).trim()}`
    
        // Set the response headers to indicate a file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Meet ${cat.name.slice(20).trim()}.pdf"`);
        doc.pipe(res);
    
        // Add pink circles to top right and bottom left corners
        doc.circle(610, 2, 120).fill("#ebadd3");
        doc.circle(2, 790, 180).fill("#ebadd3");
    
        let titleFontSize = 70;
        if (pageTitle.length > 15) {
            titleFontSize = 50;
        } 
    
        // Add Cat Name
        doc.fill("#2e2a30")
            .font("./public/fonts/caveat-brush-latin-400-normal.ttf")
            .fontSize(titleFontSize)
            .text(`Meet ${cat.name.slice(20)}`, (306-(doc.widthOfString(pageTitle)/2)), 15, { width: 500});
        
        // Save the current graphics state before creating a clipped area
        doc.save();
    
        // Add Cat Image
        // Fetch the image data using ky
        const response = await ky(cat.images[0].image.url).arrayBuffer();
        const imageBuffer = Buffer.from(response);
    
        // Get image metadata
        const metaData = await sharp(imageBuffer).metadata();
        let { width, height } = metaData;
    
        // Convert the image to PNG (sometimes comes in webp format)
        let convertedBuffer = sharp(imageBuffer).png();
    
        // Crop the image to a square if it isn't already
        if (width !== height) {
            const sideLength = Math.min(width, height);
            convertedBuffer = convertedBuffer.extract({
                left: Math.floor((width - sideLength) / 2),
                top: Math.floor((height - sideLength) / 2),
                width: sideLength,
                height: sideLength
            });
            width = sideLength;
            height = sideLength;
        }
    
        // Convert to buffer after cropping
        convertedBuffer = await convertedBuffer.toBuffer();
    
        // Define the position/size of the circle
        const catPicX = 165;
        const catPicY = 225;
        const catPicRadius = 115;
    
        // Determine the scaling factor to fit the image within the circle
        const scaleFactor = (catPicRadius * 2) / width; // Now width and height are the same
    
        // Calculate scaled dimensions (they'll be equal due to the square crop)
        const displayWidth = width * scaleFactor;
        const displayHeight = height * scaleFactor;
    
        // Calculate offsets to center the image
        const offsetX = catPicX - displayWidth / 2;
        const offsetY = catPicY - displayHeight / 2;
    
        // Clip the circle area and draw the image
        doc.circle(catPicX, catPicY, catPicRadius).clip();
        doc.image(convertedBuffer, offsetX, offsetY, {
            width: displayWidth,
            height: displayHeight
        });
    
        // Restore the previous graphics state to remove the clipping path
        doc.restore();
    
    
        // Add Adoption Form QR Code
        const qrUri = await QRCode.toDataURL(`https://petstablished.com/adoptions/personal-information?application_type=Adopt&form_id=${cat.adoption_form_id}&pet_id=${cat.id}`);
        doc.image(qrUri, catPicX + 160, catPicY - 115)
    
        // Add QR Code Label
        doc.font("./public/fonts/chilanka-latin-400-normal.ttf")
            .fontSize(24)
            .text("Scan To Adopt",  catPicX + 170, catPicY + 68 )
    
        // Add Cat Color Pattern
        let descriptivePattern = cat.pet_attributes.filter((attribute) => attribute.id === 36802)
        if (!descriptivePattern.value || descriptivePattern.value === "N/A") {
            let patternString = [cat.primary_color]
            if (cat.secondary_color && cat.secondary_color !== "N/A") {patternString.push(`& ${cat.secondary_color}`)}
            if (cat.tertiary_color && cat.tertiary_color !== "N/A") {patternString.push(`& ${cat.tertiary_color}`)}
            if (cat.coat_pattern && cat.coat_pattern !== "N/A") {patternString.push(cat.coat_pattern)}
            patternString.push(cat.sex);
            descriptivePattern = patternString.join(" ");
        }
    
        let patternFontSize = 45; 
        if (descriptivePattern.length > 20) { patternFontSize = 25}
        doc.fill("#345c72")
            .font("./public/fonts/chilanka-latin-400-normal.ttf")
            .fontSize(patternFontSize)
            .text(descriptivePattern, (306-(doc.widthOfString(descriptivePattern)/2)), 350);
        
        // Add Cat Age
        const birthDateString = `Birthday: ${cat.date_of_birth}`;
        doc.fill("black")
            .fontSize(16)
            .text(birthDateString, (290-(doc.widthOfString(birthDateString)/2)), 400);
        
        // Add Cat Description
        let descriptionText = removeEmoji(cat.pet_internal_notes);
        if(descriptionText.length > 500) {
            descriptionText = descriptionText.slice(0, 500);
            descriptionText += "...";
        }
        doc.fontSize(20).text(descriptionText, 50, 440, {
            width: 500,
            align: 'justify'
        });
    
        // Add "Is OK With" section - Positioned explicitly
        const gal = "Gets Along With";
        const isOkArray = [`${gal} Dogs: ${cat.is_ok_with_other_dogs}`,`${gal} Cats: ${cat.is_ok_with_other_cats}`,`${gal} Children: ${cat.is_ok_with_other_kids}`];
        doc.fontSize(12).list(isOkArray, 180, 725, { listType: "none" });
    
        doc.end();
    } catch (error) {
        console.error(error);
        res.status(502)
        res.send("There was an issue with the Petstablished server. Please try again in a few seconds. If the issue persists, please contact admin@topekacatcafe.com")
    }
});

app.get("/health", async (req, res) => {
    try {
        const testData = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=1&search[status]=Available`, {
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
    } catch(error) {
        console.error(error);
        res.status(502).send("There is a problem with the Petstablished API");
    }
})

app.all("*", (req, res) => {
    console.log("Invalid request received for", req.path)
    console.log("Invalid request received for", req.path)
    res.send("This is not a valid page");
})

app.listen(process.env.PORT, () => {
    console.log("Express listening on port ", process.env.PORT);
})