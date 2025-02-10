require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');  // Added to parse cookies
const path = require('path');
const ShortUrl = require('./models/shorten');
const User = require('./models/user'); // Ensure you have created this file (see note below)
const app = express();

// The link to the images files
app.use(express.static(path.join(__dirname, "images")));

// const favicon = require('serve-favicon');
// app.use(favicon(path.join(__dirname, 'images', 'logo.png')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.use(express.urlencoded({ extended: false }));
// app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser()); // Parse cookies
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 } // 30 minutes
}));

// Set view engine
app.set('view engine', 'ejs');

// Flash error messages via session
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  delete req.session.error;
  next();
});

// Middleware to block access if JavaScript is disabled
// Allow open paths (landing, signup, login) and static assets
app.use((req, res, next) => {
  const openPaths = ['/', '/signup', '/login'];
  const isStatic = req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/');
  
  // If the request is for an open path or a static asset, skip the check
  if (openPaths.includes(req.path) || isStatic) {
    return next();
  }
  
  // If the 'js_enabled' cookie is missing, show an error page.
  if (!req.cookies.js_enabled) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>JavaScript Required</title>
        <style>
          body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 2rem; text-align: center; }
          .error { background: #ffcdd2; color: red; padding: 1rem; border-radius: 4px; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <div class="error">You must enable JavaScript to use this website.</div>
        <p>Please enable JavaScript and reload the page.</p>
      </body>
      </html>
    `);
  }
  next();
});

// Route protection middleware for logged-in users
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = 'You must be logged in to access this page.';
    return res.redirect('/login');
  }
  next();
}

// Landing Page (redirect to home if already logged in)
// This page should include a small inline script that sets the js_enabled cookie.
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  res.render('landing');
});

// Signup Routes
app.get('/signup', (req, res) => {
  res.render('signup', { error: res.locals.error });
});

app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  // Basic server-side validation
  if (!firstName || !lastName || !email || !password) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup');
  }
  // Validate email format using a corrected regex.
  // The hyphen is placed at the beginning of the character class to avoid range issues.
  const emailRegex = /^[-\w.]+@([-\w]+\.)+[-\w]{2,4}$/;
  if (!emailRegex.test(email)) {
    req.session.error = 'Invalid email format.';
    return res.redirect('/signup');
  }
  // Validate password length (8 characters or more)
  const passwordRegex = /^.{8,}$/;
  if (!passwordRegex.test(password)) {
    req.session.error = 'Password must be at least 8 characters long.';
    return res.redirect('/signup');
  }
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    req.session.error = 'Email is already registered.';
    return res.redirect('/signup');
  }
  // Create new user
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ firstName, lastName, email, password: hashedPassword });
  // Redirect to login page upon successful signup
  res.redirect('/login');
});

// Login Routes
app.get('/login', (req, res) => {
  res.render('login', { error: res.locals.error });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.session.error = 'Both email and password are required.';
    return res.redirect('/login');
  }
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    req.session.error = 'Invalid email or password.';
    return res.redirect('/login');
  }
  req.session.userId = user._id;
  res.redirect('/home');
});

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Home Page (Protected)
app.get('/home', requireAuth, async (req, res) => {
  const shortUrls = await ShortUrl.find({ userId: req.session.userId });
  res.render('index', { shortUrls });
});

// URL Shortening (Protected)
app.post('/shortUrls', requireAuth, async (req, res) => {
  await ShortUrl.create({
    full: req.body.fullUrl,
    userId: req.session.userId
  });
  res.redirect('/home');
});

// Redirect Shortened URL with Custom Format
app.get('/short/:shortUrl', async (req, res) => {
  const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
  if (!shortUrl) return res.status(404).render('404');
  shortUrl.clicks++;
  await shortUrl.save();
  res.redirect(shortUrl.full);
});

// Catch-all 404 Route
app.use((req, res) => {
  res.status(404).render('404');
});

// Start Server
app.listen(process.env.PORT || 5000, () => console.log('Server running...'));
