/**
 * Express app rewritten for Netlify Functions
 * -------------------------------------------------
 * - No `process.exit()` so the Lambda never crashes at cold start.
 * - Uses `serverless-http` to expose the app as a handler.
 * - Still works for local development: `node server.js`.
 * -------------------------------------------------
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
const serverless = require("serverless-http");

const app = express();

//--------------------------------------------------
// Static assets
//--------------------------------------------------
// Netlify will also serve anything inside /public at the root, but keeping the
// middleware allows local `node server.js` usage without Netlify CLI.
app.use(express.static(path.join(__dirname, "public")));
app.use("/images", express.static(path.join(__dirname, "images")));

//--------------------------------------------------
// MongoDB connection (no process.exit on failure)
//--------------------------------------------------
const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  console.error("[WARN] MONGODB_URI env var not set – database calls will fail.");
}

// Re‑use existing connection between Lambda invocations
let mongoosePromise;
function connectDB() {
  if (!MONGODB_URI) return Promise.resolve();
  if (mongoose.connection.readyState === 1) return Promise.resolve(); // already up
  if (!mongoosePromise) {
    mongoosePromise = mongoose
      .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
      .then(() => console.log("MongoDB connected"))
      .catch((err) => console.error("MongoDB connection error:", err));
  }
  return mongoosePromise;
}
connectDB();

//--------------------------------------------------
// Middleware
//--------------------------------------------------
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const { SESSION_SECRET } = process.env;
if (!SESSION_SECRET) {
  console.error("[WARN] SESSION_SECRET env var not set – sessions are insecure.");
}

app.use(
  session({
    secret: SESSION_SECRET || "insecure-session", // fallback for dev
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

//--------------------------------------------------
// Auth helpers
//--------------------------------------------------
function isNotAuthenticated(req, res, next) {
  if (req.session.userId) return res.redirect("/");
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = "You must be logged in to access this page.";
    return res.redirect("/login");
  }
  next();
}

//--------------------------------------------------
// Routes
//--------------------------------------------------
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
  if (password.length < 8) {
    req.session.error = "Password must be at least 8 characters long.";
    return res.redirect("/signup");
  }
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    req.session.error = "Email is already registered.";
    return res.redirect("/signup");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({ firstName, lastName, email, password: hashedPassword });
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
  await connectDB(); // ensure DB ready for warm starts
  const shortUrls = await ShortUrl.find({ userId: req.session.userId });
  res.render("index", { shortUrls });
});

// Shorten URL (protected)
app.post("/shortUrls", requireAuth, async (req, res) => {
  await connectDB();
  await ShortUrl.create({
    full: req.body.fullUrl,
    userId: req.session.userId,
  });
  res.redirect("/home");
});

// Redirect short link
app.get("/short/:shortUrl", async (req, res) => {
  await connectDB();
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

//--------------------------------------------------
// Export for Netlify + local dev support
//--------------------------------------------------
const handler = serverless(app);
module.exports.handler = async (event, context) => {
  // Ensure DB is connected for each cold start
  await connectDB();
  return handler(event, context);
};

// If run directly (e.g., `node server.js`), start a local server
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => console.log(`Local server running on ${PORT}`));
}
