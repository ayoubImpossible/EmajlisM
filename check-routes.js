const express = require('express');
const app = express();

// Simulate route check
const feedRoutes = require('./src/routes/feed.routes');
console.log("Feed routes mounted");

const calendarRoutes = require('./src/routes/calendar.routes');
console.log("Calendar routes mounted");

// Check what routes exist
feedRoutes.stack.forEach(r => {
  if (r.route) console.log("Feed route:", r.route.methods, r.route.path);
});
