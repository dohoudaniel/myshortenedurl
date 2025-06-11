# Deployment Guide for URL Shortener

## ✅ VERCEL DEPLOYMENT FIXED

Your app is now properly configured for Vercel serverless deployment.

## VERCEL DEPLOYMENT INSTRUCTIONS

### Updated Vercel Settings

**Build Command**: Leave empty or use:

```bash
npm run build
```

**Install Command**:

```bash
npm install
```

**Output Directory**: Leave empty (Vercel will auto-detect)

### Environment Variables for Vercel

Set these in your Vercel dashboard:

1. **MONGODB_URI**: Your MongoDB connection string
2. **SESSION_SECRET**: A secure random string
3. **NODE_ENV**: Set to `production`

### What Was Fixed for Vercel

1. ✅ **Serverless Structure**: Created `/api/server.js` for Vercel functions
2. ✅ **Proper Export**: App now exports correctly for serverless
3. ✅ **Build Configuration**: Added proper `vercel.json` configuration
4. ✅ **Environment Handling**: Server only starts in development mode
5. ✅ **Dependencies**: Added `serverless-http` dependency
6. ✅ **MongoDB Warnings**: Removed deprecated connection options

## Fixed Issues

### 1. Port Configuration

- ✅ **Fixed**: Server now properly uses `process.env.PORT` with fallback to 5000
- ✅ **Fixed**: Added proper error handling for port conflicts
- ✅ **Fixed**: Added graceful shutdown handlers

### 2. Start Scripts

- ✅ **Fixed**: Added production `start` script to package.json
- ✅ **Fixed**: Separated development (`devStart`) and production (`start`) commands

## Render Deployment Instructions

### Build Command

```bash
npm i express mongoose ejs dotenv shortid bcryptjs express-session cookie-parser serve-favicon express-flash ; npm i --save-dev nodemon
```

### Start Command (UPDATED)

```bash
npm start
```

**Important**: Change your start command from `npm run devStart` to `npm start`

### Environment Variables Required

Make sure to set these environment variables in your Render dashboard:

1. **MONGODB_URI**: Your MongoDB connection string

   ```
   mongodb+srv://username:password@cluster.mongodb.net/database_name
   ```

2. **SESSION_SECRET**: A secure random string for session encryption

   ```
   your-super-secret-session-key-here
   ```

3. **PORT**: (Optional - Render sets this automatically)
   ```
   This is automatically set by Render, no need to configure
   ```

## Deployment Steps

1. **Update your Render service settings:**

   - Build Command: `npm i express mongoose ejs dotenv shortid bcryptjs express-session cookie-parser serve-favicon express-flash ; npm i --save-dev nodemon`
   - Start Command: `npm start` (NOT `npm run devStart`)

2. **Set Environment Variables:**

   - Go to your Render dashboard
   - Navigate to your service
   - Go to "Environment" tab
   - Add the required environment variables listed above

3. **Deploy:**
   - Push your changes to GitHub
   - Render will automatically redeploy

## Why the Previous Deployment Failed

1. **Wrong Start Command**: Using `npm run devStart` runs `nodemon` which is a development tool
2. **Port Conflicts**: `nodemon` tries to restart the server when it crashes, causing port conflicts
3. **Missing Production Script**: No proper production start script was defined

## What Was Fixed

1. **Added Production Start Script**: `"start": "node server.js"` in package.json
2. **Enhanced Error Handling**: Better port conflict detection and graceful shutdown
3. **Proper Process Management**: Added SIGTERM and SIGINT handlers for clean shutdowns

## Testing Locally

To test the production setup locally:

```bash
# Install dependencies
npm install

# Start in production mode
npm start

# Start in development mode (with auto-restart)
npm run devStart
```

## Troubleshooting

If you still encounter issues:

1. **Check Environment Variables**: Ensure MONGODB_URI and SESSION_SECRET are set
2. **Check Logs**: Look at Render deployment logs for specific error messages
3. **Database Connection**: Verify your MongoDB connection string is correct
4. **Port Issues**: The new error handling will provide clearer error messages

## Next Steps

1. Update your Render service start command to `npm start`
2. Ensure all environment variables are properly set
3. Redeploy your application
