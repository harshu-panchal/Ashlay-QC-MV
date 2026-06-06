import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const CategorySchema = new mongoose.Schema({}, { strict: false });
const Category = mongoose.model('Category', CategorySchema, 'categories');

async function checkCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const counts = await mongoose.connection.db.collection('quick_categories').aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]).toArray();
    console.log('Category type counts:', counts);

    const samples = await mongoose.connection.db.collection('quick_categories').find({ type: 'header' }).limit(5).toArray();
    console.log('Sample headers:', JSON.stringify(samples, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkCategories();
