import PDFDocument from "pdfkit";
import ky from "ky";
import sharp from "sharp";
import QRCode from 'qrcode';

import getCatsList from "../utils/getCatsList.js";
import removeEmoji from "../utils/removeEmoji.js";

const fetchAllCatsData = async (catName = "") => {
  let data = [];
  const organizations = JSON.parse(process.env.ORGANIZATIONS);
  for (let org of organizations) {
    data.push(...await getCatsList(org, catName));
  }
  return data;
};

const buildFlyer = async (cat, res) => {
  let doc = new PDFDocument({ size: "LETTER", margin: 24 });

  const pageTitle = `Meet ${cat.display_name}`

  // Set the response headers to indicate a file download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Meet ${cat.display_name}.pdf"`);
  doc.pipe(res);

  // Add pink circles to top right and bottom left corners
  doc.circle(610, 2, 120).fill("#ebadd3");
  doc.circle(2, 790, 180).fill("#ebadd3");

  let titleFontSize = 70;
  if (pageTitle.length > 15) {
    titleFontSize = 50;
  }
  if (pageTitle.length > 20) {
    titleFontSize = 40;
  }

  // Add Cat Name
  doc.fill("#2e2a30")
    .font("./public/fonts/caveat-brush-latin-400-normal.ttf")
    .fontSize(titleFontSize)
    .text(`Meet ${cat.display_name}`, (306 - (doc.widthOfString(pageTitle) / 2)), 15, { width: 500 });

  // Save the current graphics state before creating a clipped area
  doc.save();

  // Add Cat Image
  // Fetch the image data using ky
  const response = await ky(cat.images[0].image.url).arrayBuffer();
  const imageBuffer = Buffer.from(response);

  // Get image metadata so we can have height and width
  const metaData = await sharp(imageBuffer).metadata();
  let { width, height } = metaData;

  // Convert the image to PNG (sometimes comes from petstablished in webp format)
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
    .text("Scan To Adopt", catPicX + 170, catPicY + 68)

  // Add Cat Color Pattern
  let descriptivePattern = cat.pet_attributes.filter((attribute) => attribute.id === 36802)
  if (!descriptivePattern.value || descriptivePattern.value === "N/A") {
    let patternString = [cat.primary_color]
    if (cat.secondary_color && cat.secondary_color !== "N/A") { patternString.push(`& ${cat.secondary_color}`) }
    if (cat.tertiary_color && cat.tertiary_color !== "N/A") { patternString.push(`& ${cat.tertiary_color}`) }
    if (cat.coat_pattern && cat.coat_pattern !== "N/A") { patternString.push(cat.coat_pattern) }
    patternString.push(cat.sex);
    descriptivePattern = patternString.join(" ");
  }

  let patternFontSize = 45;
  if (descriptivePattern.length > 20) { patternFontSize = 25 }
  doc.fill("#345c72")
    .font("./public/fonts/chilanka-latin-400-normal.ttf")
    .fontSize(patternFontSize)
    .text(descriptivePattern, (306 - (doc.widthOfString(descriptivePattern) / 2)), 350);

  // Add Cat Age
  const birthDateString = `Birthday: ${cat.date_of_birth}`;
  doc.fill("black")
    .fontSize(16)
    .text(birthDateString, (290 - (doc.widthOfString(birthDateString) / 2)), 400);

  // Add Cat Description
  let descriptionFontSize = 20
  let descriptionText = removeEmoji(cat.pet_internal_notes);
  if (descriptionText.length > 550) {
    descriptionFontSize = 17
  }
  if (descriptionText.length > 600) {
    descriptionFontSize = 15
  }
  if (descriptionText.length > 650) {
    descriptionText = descriptionText.slice(0, 500);
    descriptionText += "...";
  }
  doc.fontSize(descriptionFontSize).text(descriptionText, 50, 440, {
    width: 500,
    align: 'justify'
  });

  // Add "Is OK With" section - Positioned explicitly
  const gal = "Gets Along With";
  const isOkArray = [`${gal} Dogs: ${cat.is_ok_with_other_dogs}`, `${gal} Cats: ${cat.is_ok_with_other_cats}`, `${gal} Children: ${cat.is_ok_with_other_kids}`];
  doc.fontSize(12).list(isOkArray, 180, 725, { listType: "none" });

  doc.end();
};

export { fetchAllCatsData, buildFlyer };