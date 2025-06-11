/**
 * This file runs the project,
 * and adds a lot of user and
 * session authentication features.
 * It also handles error messages
 * and rendering of errors.
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const cookieParser = require("cookie-parser"); // Added to parse cookies
const path = require("path");
const ShortUrl = require("./models/shorten");
const User = require("./models/user");
const app = express();

// Serve static files from /images and /public
app.use(express.static(path.join(__dirname, "images")));
app.use("/images", express.static(path.join(__dirname, "images")));
const favicon = require("serve-favicon");
app.use(favicon(path.join(__dirname, "images", "logo.png")));

// MongoDB connection for serverless
let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
      maxPoolSize: 1, // Maintain up to 1 socket connection
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });
    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Check for required SESSION_SECRET
if (!process.env.SESSION_SECRET) {
  console.error("SESSION_SECRET environment variable is not set");
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

// Flash message middleware to pass errors to views
app.use((req, res, next) => {
  res.locals.error = req.session.error;
  delete req.session.error;
  next();
});

// Database connection middleware for routes that need it
const ensureDbConnection = async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).send("Database connection failed");
  }
};

/*
  Global middleware to block access if JavaScript is disabled.
  We allow requests for static assets (e.g., CSS, JS, images) so that the error page can be styled.
  For every other request, if the "js_enabled" cookie is not present, we display an error page.
*/
// app.use((req, res, next) => {
//   // Allowed paths for static assets
//   const allowedPaths = ['/css/', '/js/', '/images/'];
//   if (allowedPaths.some(prefix => req.path.startsWith(prefix))) {
//     return next();
//   }
//   // If the js_enabled cookie is not set, block access.
//   if (!req.cookies.js_enabled) {
//     return res.send(`
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8">
//         <title>JavaScript Required</title>
//         <style>
//           body {
//             font-family: Arial, sans-serif;
//             background: #fefefe;
//             color: #333;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             height: 100vh;
//             margin: 0;
//             padding: 1rem;
//             text-align: center;
//           }
//           .error-message {
//             max-width: 600px;
//           }
//           .error-message h1 {
//             font-size: 2rem;
//             margin-bottom: 1rem;
//           }
//           .error-message p {
//             font-size: 1.125rem;
//           }
//         </style>
//       </head>
//       <body>
//         <div class="error-message">
//           <h1>JavaScript Required</h1>
//           <p>You must enable JavaScript to use this website.</p>
//         </div>
//       </body>
//       </html>
//     `);
//   }
//   next();
// });

// Middleware to redirect logged-in users away from login/signup pages
function isNotAuthenticated(req, res, next) {
  if (req.session.userId) {
    // If user is logged in, redirect them to the "/" route (which further redirects if needed)
    return res.redirect("/");
  }
  next();
}

// Route protection middleware for logged-in users
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.error = "You must be logged in to access this page.";
    return res.redirect("/login");
  }
  next();
}

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Landing Page (redirect to home if already logged in)
// This page should include a small inline script that sets the js_enabled cookie.
app.get("/", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/home");
  }
  res.render("landing");
});

// Signup Routes
app.get("/signup", isNotAuthenticated, (req, res) => {
  res.render("signup", { error: res.locals.error });
});

app.post("/signup", async (req, res) => {
  try {
    await connectToDatabase();

    const { firstName, lastName, email, password } = req.body;
    // Basic server-side validation
    if (!firstName || !lastName || !email || !password) {
      req.session.error = "All fields are required.";
      return res.redirect("/signup");
    }
    // Validate email format using a corrected regex.
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
  } catch (error) {
    console.error("Signup error:", error);
    req.session.error = "An error occurred during signup. Please try again.";
    res.redirect("/signup");
  }
});

// Login Routes
app.get("/login", isNotAuthenticated, (req, res) => {
  res.render("login", { error: res.locals.error });
});

app.post("/login", async (req, res) => {
  try {
    await connectToDatabase();

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
  } catch (error) {
    console.error("Login error:", error);
    req.session.error = "An error occurred during login. Please try again.";
    res.redirect("/login");
  }
});

// Logout Route
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Home Page (Protected)
app.get("/home", requireAuth, async (req, res) => {
  try {
    await connectToDatabase();
    const shortUrls = await ShortUrl.find({ userId: req.session.userId });
    res.render("index", { shortUrls });
  } catch (error) {
    console.error("Home page error:", error);
    req.session.error = "An error occurred loading your URLs.";
    res.redirect("/");
  }
});

// URL Shortening (Protected)
app.post("/shortUrls", requireAuth, async (req, res) => {
  try {
    await connectToDatabase();
    await ShortUrl.create({
      full: req.body.fullUrl,
      userId: req.session.userId,
    });
    res.redirect("/home");
  } catch (error) {
    console.error("URL shortening error:", error);
    req.session.error = "An error occurred creating the short URL.";
    res.redirect("/home");
  }
});

// Redirect Shortened URL with Custom Format
app.get("/short/:shortUrl", async (req, res) => {
  try {
    await connectToDatabase();
    const shortUrl = await ShortUrl.findOne({ short: req.params.shortUrl });
    if (!shortUrl) return res.status(404).render("404");
    shortUrl.clicks++;
    await shortUrl.save();
    res.redirect(shortUrl.full);
  } catch (error) {
    console.error("URL redirect error:", error);
    res.status(404).render("404");
  }
});

// Catch-all 404 Route
app.use((req, res) => {
  res.status(404).render("404");
});

// Export the Express app for both local development and serverless deployment
if (process.env.NODE_ENV !== "production") {
  // Start Server for local development
  const PORT = process.env.PORT || 7000;
  const server = app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
  });

  // Handle server errors
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Please use a different port.`
      );
      process.exit(1);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      console.log("Process terminated");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received. Shutting down gracefully...");
    server.close(() => {
      console.log("Process terminated");
      process.exit(0);
    });
  });
}

// Export the app for serverless deployment
module.exports = app;
