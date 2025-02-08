/**
 * The server.js file that runs our server
 */
const express = require('express');
const mongoose = require('mongoose');
const ShortUrl = require('./models/shorten');
const path = require("path")
const app = express();

// Serve static files for the website
app.use(express.static(path.join(__dirname, "images")));

require('dotenv').config();
const db_uri = process.env.MONGODB_URI

// Setting up and connecting to the MongoDB database
mongoose.connect(db_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})

// Setting the view tempate and the view engine
app.set('view engine', 'ejs');

// Setting the app config files for URL shortening
app.use(express.urlencoded({ extended: false }));

app.get('/', async (req, res) => {
    const shortUrls = await ShortUrl.find() // Fetching the short URLs from the database
    // Rendering the Home page
    res.render('index', { shortUrls: shortUrls });
})

// Shortening the URLs - Functionality
app.post('/shortUrls', async (req, res) => {
    await ShortUrl.create({
        // Accessing the form property from the front-end
        full: req.body.fullUrl
    });
    // Redirecting the shortened URL to the Home page
    res.redirect('/');
});

// Redirecting the shortened URL to the original URL
app.get('/:shortUrl', async (req, res) => {
  const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl })
  if (shortUrl == null) return res.sendStatus(404)

  // Incrementing the count on each click
  shortUrl.clicks++
  shortUrl.save()

  res.redirect(shortUrl.full)
})

// The port on which the app listens and runs
app.listen(process.env.PORT || 5000);