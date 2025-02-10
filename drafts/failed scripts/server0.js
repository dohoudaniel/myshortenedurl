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

// Static files and middleware
app.use(express.static(path.join(__dirname, "images")));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

// View engine setup
app.set('view engine', 'ejs');

// Flash messages middleware
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  delete req.session.error;
  next();
});

// JavaScript check middleware (updated)
app.use((req, res, next) => {
  const openPaths = ['/', '/signup', '/login', '/enable-js'];
  const isStatic = req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/images/');
  
  // Allow open paths and static assets
  if (openPaths.includes(req.path) || isStatic) {
    return next();
  }
  
  // Check for JavaScript enabled cookie
  if (!req.cookies.js_enabled) {
    return res.render('enable-js');
  }
  next();
});

// Route to set JS enabled cookie (add this new route)
app.get('/enable-js', (req, res) => {
  res.cookie('js_enabled', 'true', { maxAge: 900000, httpOnly: true });
  res.redirect('/');
});

// Updated landing page route with JS detection
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/home');
  }
  // Set JS check cookie if not present
  if (!req.cookies.js_check) {
    res.cookie('js_check', 'true', { maxAge: 900000, httpOnly: true });
  }
  res.render('landing');
});

// ... keep all other routes (signup, login, home, etc.) exactly the same ...

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(process.env.PORT || 5000, () => console.log('Server running...'));