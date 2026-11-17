// Run once: npm run seed:admin
// Creates admin users (register API only creates students, for security)
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

const admins = [
  { name: "Admin", email: "admin@campus.com", password: "admin123", department: "Administration" },
  { name: "IT Staff", email: "staff@campus.com", password: "staff123", department: "IT" },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const a of admins) {
    const exists = await User.findOne({ email: a.email });
    if (exists) {
      console.log("Already exists:", a.email);
      continue;
    }
    const hashed = await bcrypt.hash(a.password, 10);
    await User.create({ ...a, password: hashed, role: "admin" });
    console.log("Created admin:", a.email, "/", a.password);
  }
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
