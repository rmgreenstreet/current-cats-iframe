import mongoose from 'mongoose';

const maxRetries = 5; // Number of attempts

async function connectToMongoose(delay = 250) { // Default delay value
  let attempts = 0;

  const connect = async () => {
    attempts++;

    try {
      await mongoose.connect(process.env.DB_CONNECTION_STRING, { dbName: 'test' });
      console.log(`Mongoose Connected to MongoDB`);
    } catch (err) {
      console.error(`Failed to connect to MongoDB (attempt ${attempts}): ${err.message}`);

      if (attempts < maxRetries) {
        const nextDelay = delay * 2; // Exponential backoff
        console.log(`Retrying in ${nextDelay / 1000} seconds...`);
        setTimeout(connect, delay); // Retry connection
      } else {
        console.error('Max retries reached. Exiting...');
        process.exit(1); // Exit with failure code
      }
    }
  };

  connect(); // Initial call to start the connection process
}

export default connectToMongoose;
