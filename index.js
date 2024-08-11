
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

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const app = express();

app.use(express.urlencoded({extended : true}));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
// Use ejs-mate as rendering engine for EJS, overriding the default
app.engine("ejs", ejsMate);

app.use(express.static(path.join(__dirname, "/public")));

const removeEmoji = (text) => {
    return text.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, '');
}

// TODO Add error handling, because it's unlikely the petstablished api will have 100% uptime
app.get("/tcc/cats", async (req, res) => {
    const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available`).json();
    // console.log(data.collection[0]);
    res.render("iframe", {data});
});

app.get("/tcc/flyers", async (req, res) => {
    const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available`).json();
    // console.log(data.collection[0]);
    res.render("flyers", {data});
});

app.post("/tcc/flyers", async (req, res) => {
    const listOfCats = req.body.selected;
    const data = await ky.get(`https://petstablished.com/api/v2/public/pets?public_key=${process.env.PUBLIC_KEY}&pagination[limit]=100&search[status]=Available&search[name]=${listOfCats.join(",")}`).json();
    const cat = data.collection[0];
    // Ok, we'll try just generating with pdfkit rather than rendering ejs and sending that in
    
    let doc = new PDFDocument({size: "LETTER"});
    doc.pipe(res)

    // Add pink circles to top right and bottom left corners
    doc.circle(610, 2, 120).fill("#ebadd3");
    doc.circle(2, 790, 180).fill("#ebadd3");

    // Add Cat Name
    doc.fill("#2e2a30")
        .font("./public/fonts/caveat-brush-latin-400-normal.ttf")
        .fontSize(65)
        .text(`Meet ${cat.name.slice(20)}`, (306-(doc.widthOfString(`Meet ${cat.name.slice(20)}`)/2)), 30);

    // Add Cat Image
    // Fetch the image data using ky
    const response = await ky(cat.images[0].image.url).arrayBuffer();
    const imageBuffer = Buffer.from(response);

    // Convert the WebP image to PNG (or JPEG)
    const convertedBuffer = await sharp(imageBuffer)
        .png() 
        .toBuffer();

    
    // Save the current graphics state
    doc.save();

    // Define the position/size of the circle
    const catPicX = 165;
    const catPicY = 225;
    const catPicRadius = 115;

    doc.circle(catPicX, catPicY, catPicRadius).clip();
    
    // Draw the image within the clipping path
    doc.image(convertedBuffer, catPicX - catPicRadius, catPicY - catPicRadius, {
        width: catPicRadius * 2,
        height: catPicRadius * 2
    });


    // Restore the previous graphics state to remove the clipping path
    doc.restore();

    // Add Adoption Form QR Code
    const qrUri = await QRCode.toDataURL(cat.pet_adoption_url);
    doc.image(qrUri, catPicX + 225, catPicY - catPicRadius)

    // Add Cat Color Pattern
    let descriptivePattern = cat.pet_attributes.filter((attribute) => attribute.id === 36802)
    if (!descriptivePattern.value || descriptivePattern.value === "N/A") {
        let patternString = [cat.primary_color]
        if (cat.secondary_color) {patternString.push(cat.secondary_color)}
        if (cat.tertiary_color) {patternString.push(cat.tertiary_color)}
        patternString.push(cat.coat_pattern, cat.sex);
        descriptivePattern = patternString.join(" ");
    }
    doc.fill("#345c72")
        .font("./public/fonts/chilanka-latin-400-normal.ttf")
        .fontSize(45)
        .text(descriptivePattern, (306-(doc.widthOfString(descriptivePattern)/2)), 350, { align: "center" });
    
    // Add Cat Age
    doc.fill("black")
        .fontSize(16)
        .moveDown(.2)
        .text(`Age: ${cat.numerical_age}`, { align: "center" });
    
    // Add Cat Description
    let descriptionText = removeEmoji(cat.pet_internal_notes);
    if(descriptionText.length > 350) {
        descriptionText = descriptionText.slice(0, 350);
        descriptionText += "..."
    }
    doc.moveDown()
        .fontSize(20)
        .text(descriptionText, {
            width: 550,
            align: 'justify'
            }
        );
    
    // Add "Is OK With" section
    const gal = "Gets Along With";
    const isOkArray = [`${gal} Dogs: ${cat.is_ok_with_other_dogs}`,`${gal} Cats: ${cat.is_ok_with_other_cats}`,`${gal} Children: ${cat.is_ok_with_other_kids}`]
    doc.moveDown()
        .fontSize(12)
        .list(isOkArray, { align: "center", listType: "none" });

    doc.end();
    // res.render("individualFlyer", {cat: data.collection[0]});
    // res.send(data.collection[0]);
});

app.all("*", (req, res) => {
    res.send("This is not a valid page");
})

app.listen(process.env.PORT, () => {
    console.log("Express listening on port ", process.env.PORT);
})