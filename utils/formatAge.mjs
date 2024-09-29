export default function formatAge(birthDate) {
    const jsBirthDate = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - jsBirthDate.getFullYear();
    const months = now.getMonth() - jsBirthDate.getMonth();
  
    // Handle negative month difference (previous year)
    if (months < 0) {
      years--;
      months += 12;
    }
    
    // Calculate the difference in days for weeks
    const diffDays = now.getDate() - jsBirthDate.getDate();
    const weeks = Math.floor(diffDays / 7);
  
    let yearsAndMonths = `${years} year${years > 1 ? "s" : ""} and ${months} month${months > 1 ? "s" : ""}`;
    let monthsAndWeeks = `${months} month${months > 1 ? "s" : ""} and ${weeks} week${weeks > 1 ? "s" : ""}`;

    if (months < 1) {
      yearsAndMonths = `${years} year${years > 1 ? "s" : ""}`
    }

    if (weeks < 1) {
      monthsAndWeeks = `${months} month${months > 1 ? "s" : ""}`
    }
  
    return years >= 1 ? yearsAndMonths : monthsAndWeeks;
}