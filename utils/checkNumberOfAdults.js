import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

export default function (cats) {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const numberOfAdults = cats.filter((cat) => {
       return fourMonthsAgo > Date.parse(cat.date_of_birth)
    })
    let adultsText = [];
    for (let cat of numberOfAdults) {
      adultsText.push(`<p>Name: ${cat.name.slice(20)}, Birth Date: ${cat.date_of_birth}</p>`)
    }
    return adultsText;
    // if (numberOfAdults.length > 10) {
    //     let emailText = [];
    //     for (let cat of numberOfAdults) {
    //         emailText.push(`<p>Name: ${cat.name}, Birth Date: ${cat.date_of_birth}</p>`)
    //     }
    //     const mailOptions = {
    //         from: 'team@topekacatcafe.com',
    //         to: process.env.ADMIN_EMAIL,
    //         subject: `There are ${numberOfAdults.length} adults at the cafe`,
    //         text: emailText.join(",")
    //     };
        
    //     transporter.sendMail(mailOptions, function(error, info){
    //         if (error) {
    //         console.log(error);
    //         } else {
    //         console.log('Email sent: ' + info.response);
    //         }
    //     });
    // } else {
    //     return;
    // }
}