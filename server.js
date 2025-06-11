/**
 * This file runs the project,
 * and adds user/session auth,
 * handles error messages and rendering.
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const ShortUrl = require("./models/shorten");
const User = require("./models/user");

const app = express();

// Serve static files from public and images directories
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

// MongoDB connection
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => {
  console.error("MongoDB connection error:", err);
  process.exit(1);
});

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Session setup
if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET is not set");
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }, // 30 minutes
  })
);
app.use(require("express-flash")());
app.set("view engine", "ejs");

// Flash error support
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  delete req.session.error;
  next();
});

// Middleware to restrict login/signup for logged-in users
function isNotAuthenticated(req, res, next) {
  if (req.session.userId) return res.redirect("/");
  next();
}

// Middleware to require auth
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = "You must be logged in to access this page.";
    return res.redirect("/login");
  }
  next();
}

// Landing page
app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/home");
  res.render("landing");
});

// Signup
app.get("/signup", isNotAuthenticated, (req, res) => {
  res.render("signup", { error: res.locals.error });
});

app.post("/signup", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    req.session.error = "All fields are required.";
    return res.redirect("/signup");
  }

  const emailRegex = /^[-\w.]+@([-\w]+\.)+[-\w]{2,4}$/;
  if (!emailRegex.test(email)) {
    req.session.error = "Invalid email format.";
    return res.redirect("/signup");
  }
  // Validate password length (8 characters or more)
  const passwordRegex = /^.{8,}$/;
  if (!passwordRegex.test(password)) {
    req.session.error = "Password must be at least 8 characters long.";
    return res.redirect("/signup");
  }
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    req.session.error = "Email is already registered.";
    return res.redirect("/signup");
  }
  // Create new user
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ firstName, lastName, email, password: hashedPassword });
  // Redirect to login page upon successful signup
  res.redirect("/login");
});

// Login
app.get("/login", isNotAuthenticated, (req, res) => {
  res.render("login", { error: res.locals.error });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    req.session.error = "Both email and password are required.";
    return res.redirect("/login");
  }

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    req.session.error = "Invalid email or password.";
    return res.redirect("/login");
  }

  req.session.userId = user._id;
  res.redirect("/home");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

// Home (protected)
app.get("/home", requireAuth, async (req, res) => {
  const shortUrls = await ShortUrl.find({ userId: req.session.userId });
  res.render("index", { shortUrls });
});

// Shorten URL (protected)
app.post("/shortUrls", requireAuth, async (req, res) => {
  await ShortUrl.create({
    full: req.body.fullUrl,
    userId: req.session.userId,
  });
  res.redirect("/home");
});

// Redirect short link
app.get("/short/:shortUrl", async (req, res) => {
  const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
  if (!shortUrl) return res.status(404).render("404");
  shortUrl.clicks++;
  await shortUrl.save();
  res.redirect(shortUrl.full);
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render("404");
});

// Start server
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

// Error handling
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");
  server.close(() => process.exit(0));
});
