const axios = require('axios');

// Login first to get a real token
async function main() {
  try {
    console.log("Logging in...");
    const login = await axios.post('http://192.168.1.25:3000/api/auth/login', {
      username: 'ayoub.zamani',
      password: 'password'
    });
    const token = login.data.token;
    console.log("Got token:", !!token);

    console.log("\nCalling /api/feed/calendar...");
    const cal = await axios.get('http://192.168.1.25:3000/api/feed/calendar', {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: 1, limit: 10 }
    });
    console.log("Calendar response:", JSON.stringify(cal.data).substring(0, 500));

  } catch(e) {
    console.log("Error:", e.response?.status, JSON.stringify(e.response?.data || {}).substring(0,300));
    console.log("Message:", e.message);
  }
}
main();
