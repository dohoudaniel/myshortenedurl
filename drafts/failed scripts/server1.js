require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const ShortUrl = require('./models/shorten');
const User = require('./models/user');
const app = express();

// Static file serving
app.use(express.static(path.join(__dirname, "images")));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
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

// Middleware to check for JavaScript and handle disabled JavaScript
app.use((req, res, next) => {
  // Paths that should bypass the JavaScript check
  const openPaths = ['/', '/signup', '/login'];
  const isStatic = req.path.startsWith('/css/') || 
                   req.path.startsWith('/js/') || 
                   req.path.startsWith('/images/');
  
  // Skip check for open paths and static assets
  if (openPaths.includes(req.path) || isStatic) {
    return next();
  }
  
  // Check for js_enabled cookie
  if (!req.cookies.js_enabled) {
    // Render the enable-js.ejs template instead of inline HTML
    return res.render('enable-js');
  }
  
  next();
});

// Route protection middleware
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = 'You must be logged in to access this page.';
    return res.redirect('/login');
  }
  next();
}

// Landing Page
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

// Redirect Shortened URL
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
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));