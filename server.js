require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const requestRoutes = require("./routes/requests");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(express.json()); // read JSON body

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => res.json({ message: "Campus Service Request API is running" }));

// Unknown route -> 404
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// Common error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error", error: err.message });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error("MongoDB connection failed:", err.message));
