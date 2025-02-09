// import mongoose from 'mongoose';
const mongoose = require('mongoose');

mongoose.connect('mongodb://54.173.231.75/urlShortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

const shortUrlSchema = new mongoose.Schema({
  full: {
    type: String,
    required: true
  },
  short: {
    type: String,
    required: true,
    unique: true
  },
  clicks: {
    type: Number,
    required: true,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// export default mongoose.model('ShortUrl', shortUrlSchema);
module.exports = mongoose.model('ShortUrl', shortUrlSchema);