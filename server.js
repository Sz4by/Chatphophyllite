const express = require("express");
const fs = require("fs");
const { EventEmitter } = require("events");
const shortid = require("shortid");

const cookieParser = require("cookie-parser");
// const expressLayouts = require("express-ejs-layouts");

const app = express();
const port = 3000;

// Use ejs as the view engine
app.set("view engine", "ejs");

app.use("/public", express.static("public"));

// app.use(expressLayouts);

app.use(express.json());

// Load existing chat history from the JSON file
function loadChatHistory() {
  try {
    const chatData = fs.readFileSync("chat_history.json");
    return JSON.parse(chatData);
  } catch (error) {
    return [];
  }
}

// Middleware to parse cookies
app.use(cookieParser());

// Save the updated chat history to the JSON file
function saveChatHistory(chatHistory) {
  const chatData = JSON.stringify(chatHistory, null, 2);
  fs.writeFileSync("chat_history.json", chatData);
}

// Create an event emitter to handle real-time updates
const eventEmitter = new EventEmitter();

const customCookieName = "chatphophylliteID";
const customIDName = "chatphophylliteIDuser";

app.get("/", (req, res) => {
  let userKey = req.cookies[customCookieName];
  let userID = req.cookies[customIDName];
  const oneYearInSeconds = 31536000; // Number of seconds in a year

  if (!userKey) {
    userKey = shortid.generate();
    res.cookie(customCookieName, userKey, { maxAge: oneYearInSeconds * 1000 });
  }

  if (!userID) {
    userID = shortid.generate();
    res.cookie(customIDName, userID, { maxAge: oneYearInSeconds * 1000 });
  }
  res.render("index", { userKey, userID });
});

app.get("/info", (req, res) => {
  res.render("info");
});

// Route to handle incoming chat messages
app.post("/chat", (req, res) => {
  const { message, sender, profile, user } = req.body;

  if (!message || !sender || !user) {
    return res.send("Message, sender, or user not provided.");
  }

  var pfp = req.body.profile;
  if (!profile || profile === "") {
    pfp = "/public/img/defuser.webp";
  }
  const chatHistory = loadChatHistory();
  const timestamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }); // Get the current timestamp with hour and minute
  const formattedDate = new Date().toLocaleDateString(); // Get the current date
  const messageWithTimestamp = {
    message,
    timestamp,
    date: formattedDate,
    sender,
    profile: pfp,
    user,
  }; // Include timestamp and date in the message object
  chatHistory.push(messageWithTimestamp);
  saveChatHistory(chatHistory);

  eventEmitter.emit("newMessage", messageWithTimestamp); // Emit a newMessage event when a new message arrives

  res.send("Message received and stored.");
});

// Server-sent events route to stream chat history updates
app.get("/chat-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const chatHistory = loadChatHistory();
  chatHistory.forEach((message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`); // Send existing chat history to the client
  });

  // Register an event listener for newMessage events
  const messageListener = (message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`); // Send new messages to the client
  };
  eventEmitter.on("newMessage", messageListener);

  // Clean up the event listener when the client disconnects
  req.on("close", () => {
    eventEmitter.off("newMessage", messageListener);
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
