const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const bcrypt = require('bcrypt');
const validator = require('validator');
const ShortUrl = require('./models/shorten');
const User = require('./models/user');

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { maxAge: 30 * 60 * 1000 } // 30 minutes
}));

app.use(flash());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Auth middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'You must be logged in to access this page.');
    res.redirect('/login');
};

// Routes
app.get('/', (req, res) => {
    req.session.user ? res.redirect('/home') : res.redirect('/landing');
});

app.get('/landing', (req, res) => res.render('landing'));
app.get('/signup', (req, res) => res.render('signup', { error: req.flash('error') }));
app.get('/login', (req, res) => res.render('login', { error: req.flash('error') }));

app.post('/signup', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        // Validation
        if (!validator.isEmail(email)) throw new Error('Invalid email');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ firstName, lastName, email, password: hashedPassword });
        
        req.session.user = user;
        res.redirect('/home');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/signup');
    }
});

app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) throw new Error('Invalid credentials');
        
        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (!validPassword) throw new Error('Invalid credentials');
        
        req.session.user = user;
        res.redirect('/home');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/login');
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/home', isAuthenticated, async (req, res) => {
    const shortUrls = await ShortUrl.find({ user: req.session.user._id });
    res.render('index', { shortUrls });
});

app.post('/shortUrls', isAuthenticated, async (req, res) => {
    await ShortUrl.create({ 
        full: req.body.fullUrl,
        user: req.session.user._id
    });
    res.redirect('/home');
});

app.get('/:shortUrl', async (req, res) => {
    const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
    if (!shortUrl) return res.status(404).render('404');
    
    shortUrl.clicks++;
    await shortUrl.save();
    res.redirect(shortUrl.full);
});

app.use((req, res) => res.status(404).render('404'));

app.listen(process.env.PORT || 5000);