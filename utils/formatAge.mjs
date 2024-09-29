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
  
    let yearsAndMonths = `${years} years and ${months} months`;
    let monthsAndWeeks = `${months} months and ${weeks} weeks`;

    if (months < 1) {
      yearsAndMonths = `${years} years`
    }

    if (weeks < 1) {
      monthsAndWeeks = `${months} months`
    }
  
    return years >= 1 ? yearsAndMonths : monthsAndWeeks;
}