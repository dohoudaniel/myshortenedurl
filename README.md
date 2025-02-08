# URL Shortener (Project 3)

## Overview
The **Aetheris' URL Shortener** is a simple web application that allows users to convert long URLs into short, compact links. It also tracks the number of clicks each shortened URL receives. The project is built using:
- **Frontend:** HTML, CSS, JavaScript (Minimalist Design)
- **Backend:** Node.js with Express.js
- **Database:** MongoDB (for storing and managing short URLs efficiently)

## Features
- 🌍 **Shorten URLs:** Users can enter a long URL and receive a shortened version.
- 📊 **Click Tracking:** Counts the number of times each shortened link is accessed.
- 🔐 **User Authentication (Future Feature):** Logged-in users can manage and view their shortened URLs.

## Demo Video
Watch the full explanation of this project on YouTube: [URL Shortener Description](https://youtu.be/SLpUKAGnm-g?si=87hPGuGrFtDNq5rB)

---

## Installation and Setup
### Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (LTS recommended)
- [MongoDB](https://www.mongodb.com/) (Local or cloud instance)
- [Git](https://git-scm.com/)

### Clone the Repository
```sh
git clone https://github.com/yourusername/url-shortener.git
cd url-shortener
```

### Install Dependencies
```sh
npm install
```

### Configure Environment Variables
Create a `.env` file in the root directory and add:
```
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

### Start the Application
```sh
npm start
```
The server will start on `http://localhost:5000`

---

## Project Structure
```
url-shortener/
│── models/
│   └── shorten.js        # Mongoose schema for URL storage
│── public/
│   ├── images/           # Static images (logo, favicon, etc.)
│── views/
│   └── index.ejs         # Frontend UI template
│── .env                  # Environment variables
│── server.js             # Main Express server
│── package.json          # Node.js dependencies
│── README.md             # Project documentation
```

---

## Usage
1. **Visit the Home Page:** Open `http://localhost:5000` in your browser.
2. **Enter a URL:** Paste a long URL into the input field and click the **Shorten** button.
3. **Get a Short Link:** The shortened link appears in the table.
4. **Track Clicks:** The number of times each short link is clicked is updated in real-time.

---

## Code Breakdown
### **Backend - Express Server (`server.js`)**
- Connects to MongoDB
- Serves static files
- Handles URL shortening and redirection
- Tracks clicks on each short link

### **Database Model (`shorten.js`)**
Defines the Mongoose schema with fields:
- `full`: Original URL
- `short`: Auto-generated short ID
- `clicks`: Click count tracker

### **Frontend (`index.ejs`)**
- Uses Bootstrap for styling
- Displays shortened URLs and click counts dynamically
- Sends POST requests to shorten URLs

<!---

## Deployment
### **Using Render (or Any Cloud Provider)**
1. Deploy the MongoDB database (MongoDB Atlas recommended).
2. Set up an Express app on Render, Vercel, or Heroku.
3. Configure environment variables (PORT, MONGODB_URI).
4. Deploy and access your URL shortener online.

---

## Future Enhancements
🔹 **User Authentication:** Allow users to log in and manage their URLs.
🔹 **Custom Short URLs:** Let users choose a custom short link instead of auto-generated IDs.
🔹 **QR Code Generation:** Generate QR codes for shortened links.
🔹 **API Integration:** Provide an API for developers to use the shortening service programmatically.

---

## Contributors
- **Your Name** - Developer

Feel free to contribute! Open an issue or submit a pull request on [GitHub](https://github.com/yourusername/url-shortener).

---

## License
This project is licensed under the MIT License.

-->
