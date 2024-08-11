let makePDFButton = document.querySelector("#make-pdf-button");
const flyerBody = document.querySelector(".flyer-body");
const pdfOpt = {
    margin:       1,
    filename:     'myfile.pdf',
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  
makePDFButton.addEventListener("click", async (event) => {
    event.preventDefault();
    // New Promise-based usage:
    html2pdf().set(pdfOpt).from(flyerBody).save();
});