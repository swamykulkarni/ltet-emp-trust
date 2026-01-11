import app from './app';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const port = process.env.PORT || 3003;

app.listen(port, () => {
  console.log(`Application Service running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/health`);
});