export default async function exponentialBackoff(fn, maxRetries = 10, baseDelay = 250) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      const delay = baseDelay * Math.pow(2, attempt - 1);
      if (attempt >= maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
