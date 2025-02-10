require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const flash = require('express-flash');
const ShortUrl = require('./models/shorten');
const User = require('./models/user');

const app = express();

// Serve static files from /images, /public, etc.
app.use(express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 } // 30 minutes
}));
app.use(flash());
app.set('view engine', 'ejs');

// Flash message middleware to pass errors to views
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  delete req.session.error;
  next();
});

/*
  Global middleware to block access if JavaScript is disabled.
  We allow requests for static assets (e.g., CSS, JS, images) so that the enable-js.ejs page can be styled.
  For every other request, if the "js_enabled" cookie is not present, we render the enable-js.ejs view.
*/
app.use((req, res, next) => {
  // Allowed paths for static assets
  const allowedPaths = ['/css/', '/js/', '/images/'];
  if (allowedPaths.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }
  // If the js_enabled cookie is not set, render the enable-js view.
  if (!req.cookies.js_enabled) {
    return res.render('enable-js');
  }
  next();
});

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = 'You must be logged in to access this page.';
    return res.redirect('/login');
  }
  next();
}

function isNotAuthenticated(req, res, next) {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  next();
}

// Routes

// Landing Page (for non-authenticated users)
// This page should include a small inline script that sets the js_enabled cookie.
app.get('/', isNotAuthenticated, (req, res) => {
  res.render('landing');
});

// Signup Page
app.get('/signup', isNotAuthenticated, (req, res) => {
  res.render('signup', { error: req.flash('error') });
});

// Login Page
app.get('/login', isNotAuthenticated, (req, res) => {
  res.render('login', { error: req.flash('error') });
});

// Home Page (for authenticated users)
app.get('/home', requireAuth, async (req, res) => {
  try {
    const shortUrls = await ShortUrl.find({ userId: req.session.userId });
    res.render('index', { shortUrls });
  } catch (error) {
    req.flash('error', 'An error occurred.');
    res.redirect('/');
  }
});

// Signup Route
app.post('/signup', async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    req.session.error = 'All fields are required.';
    return res.redirect('/signup');
  }
  const emailRegex = /^[-\w.]+@([-\w]+\.)+[-\w]{2,4}$/;
  if (!emailRegex.test(email)) {
    req.session.error = 'Invalid email format.';
    return res.redirect('/signup');
  }
  const passwordRegex = /^.{8,}$/;
  if (!passwordRegex.test(password)) {
    req.session.error = 'Password must be at least 8 characters long.';
    return res.redirect('/signup');
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    req.session.error = 'Email is already registered.';
    return res.redirect('/signup');
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ firstName, lastName, email, password: hashedPassword });
  // After signup, redirect to login page.
  res.redirect('/login');
});

// Login Route
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

// URL Shortening Route (for authenticated users)
app.post('/shortUrls', requireAuth, async (req, res) => {
  await ShortUrl.create({
    full: req.body.fullUrl,
    userId: req.session.userId
  });
  res.redirect('/home');
});

// Short URL Redirect Route
app.get('/:shortUrl', async (req, res) => {
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
