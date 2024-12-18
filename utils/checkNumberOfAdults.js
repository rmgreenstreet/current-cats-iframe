export default function (cats) {
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    const numberOfAdults = cats.filter((cat) => {
       return fourMonthsAgo > Date.parse(cat.date_of_birth)
    })
    let adultsText = [];
    for (let cat of numberOfAdults) {
      adultsText.push(`<p>Name: ${cat.display_name}, Birth Date: ${cat.date_of_birth}</p>`)
    }
    return adultsText;
}