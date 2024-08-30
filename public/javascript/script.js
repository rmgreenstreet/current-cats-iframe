// let makePDFButton = document.querySelector("#make-pdf-button");
// const flyerBody = document.querySelector(".flyer-body");
// const pdfOpt = {
//     margin:       1,
//     filename:     'myfile.pdf',
//     image:        { type: 'jpeg', quality: 0.98 },
//     html2canvas:  { scale: 2 },
//     jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
//   };
  
// makePDFButton.addEventListener("click", async (event) => {
//     event.preventDefault();
//     // New Promise-based usage:
//     html2pdf().set(pdfOpt).from(flyerBody).save();
// });

$(document).ready(function() {
  var showChar = 500; // Number of characters to show by default
  var ellipsestext = "...";
  var moretext = "Read more";
  var lesstext = "Read less";

  $('.cat-description').each(function() {
      var content = $(this).html();

      if(content.length > showChar) {
          var visibleText = content.substr(0, showChar);
          var hiddenText = content.substr(showChar, content.length - showChar);

          var html = visibleText + '<span class="moreellipses">' + ellipsestext + '&nbsp;</span><span class="morecontent">' + hiddenText + '</span>&nbsp;&nbsp;<a href="#" class="morelink">' + moretext + '</a>';

          $(this).html(html);
          $(this).find('.morecontent').hide(); // Ensure the hidden content is hidden on load
      }
  });

  $(".cat-description").on("click", ".morelink", function(e) {
      e.preventDefault(); // Prevent default link behavior
      var $this = $(this);
      var $moreContent = $this.prev('.morecontent');
      var $moreEllipses = $this.prev().prev('.moreellipses');

      if($this.hasClass("less")) {
          $this.removeClass("less").html(moretext);
          $moreContent.hide(); // Hide the hidden content
          $moreEllipses.show(); // Show the ellipses
      } else {
          $this.addClass("less").html(lesstext);
          $moreContent.show(); // Show the hidden content
          $moreEllipses.hide(); // Hide the ellipses
      }
  });
});
