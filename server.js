import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import flash from 'express-flash';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { body, validationResult } from 'express-validator';
import User from './models/User.js';
import ShortUrl from './models/ShortUrl.js';

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost/urlShortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
app.use(flash());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost/urlShortener' }),
  cookie: { 
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  req.flash('error', 'You must be logged in to access this page.');
  res.redirect('/login');
};

const isNotAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return next();
  }
  res.redirect('/home');
};

// Routes
app.get('/', isNotAuthenticated, (req, res) => {
  res.render('landing');
});

app.get('/signup', isNotAuthenticated, (req, res) => {
  res.render('signup');
});

app.get('/login', isNotAuthenticated, (req, res) => {
  res.render('login');
});

app.get('/home', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    const shortUrls = await ShortUrl.find({ userId: req.session.userId });
    res.render('index', { shortUrls, user });
  } catch (error) {
    req.flash('error', 'An error occurred.');
    res.redirect('/');
  }
});

// Signup validation middleware
const signupValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').trim().isEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/)
    .withMessage('Password must include one lowercase character, one uppercase character, a number, and a special character')
];

// Signup route
app.post('/signup', signupValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array()[0].msg);
    return res.redirect('/signup');
  }

  try {
    const { firstName, lastName, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error', 'Email already registered');
      return res.redirect('/signup');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword
    });

    req.session.userId = user._id;
    res.redirect('/home');
  } catch (error) {
    req.flash('error', 'Error creating account');
    res.redirect('/signup');
  }
});

// Login route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }

    req.session.userId = user._id;
    res.redirect('/home');
  } catch (error) {
    req.flash('error', 'An error occurred');
    res.redirect('/login');
  }
});

// Logout route
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/home');
    }
    res.redirect('/');
  });
});

// URL shortening route
app.post('/shortUrls', isAuthenticated, async (req, res) => {
  try {
    const { fullUrl } = req.body;
    const shortCode = nanoid(9);
    await ShortUrl.create({ 
      full: fullUrl,
      short: shortCode,
      userId: req.session.userId
    });
    res.redirect('/home');
  } catch (error) {
    req.flash('error', 'Error shortening URL');
    res.redirect('/home');
  }
});

// Short URL redirect
app.get('/:shortUrl', async (req, res) => {
  try {
    const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
    if (!shortUrl) {
      return res.status(404).render('404');
    }

    shortUrl.clicks++;
    await shortUrl.save();
    res.redirect(shortUrl.full);
  } catch (error) {
    res.status(404).render('404');
  }
});

// 404 route
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});