const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { ServiceRequest, CATEGORIES, PRIORITIES, STATUSES, ALLOWED_NEXT } = require("../models/ServiceRequest");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();
router.use(protect); // every route below needs a valid token

// Helper: find request by id, send 400/404 if bad. Returns the request or null.
async function findRequest(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: "Invalid request id" });
    return null;
  }
  const request = await ServiceRequest.findById(id)
    .populate("createdBy", "name email department")
    .populate("assignedTo", "name email");
  if (!request) {
    res.status(404).json({ message: "Request not found" });
    return null;
  }
  return request;
}

function isOwner(request, user) {
  // createdBy is null after populate if the owner account was deleted
  return !!request.createdBy && request.createdBy._id.toString() === user._id.toString();
}

// POST /api/requests  -> student creates a request
router.post("/", allowRoles("student"), async (req, res, next) => {
  try {
    const { title, description, category } = req.body;
    if (!title || !description || !category) {
      return res.status(400).json({ message: "title, description and category are required" });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "category must be one of: " + CATEGORIES.join(", ") });
    }

    const request = await ServiceRequest.create({
      title,
      description,
      category,
      createdBy: req.user._id,
    });
    res.status(201).json({ message: "Request created", request });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests  -> student: own requests, admin: all (with search & filters)
// Example: /api/requests?status=Pending&priority=High&category=Internet&search=wifi
router.get("/", async (req, res, next) => {
  try {
    const filter = {};

    if (req.user.role === "student") {
      filter.createdBy = req.user._id;
    }

    const { status, priority, category, search } = req.query;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape special chars
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
      ];
    }

    const requests = await ServiceRequest.find(filter)
      .populate("createdBy", "name email department")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json({ count: requests.length, requests });
  } catch (err) {
    next(err);
  }
});

// GET /api/requests/:id  -> owner or admin
router.get("/:id", async (req, res, next) => {
  try {
    const request = await findRequest(req.params.id, res);
    if (!request) return;

    if (req.user.role !== "admin" && !isOwner(request, req.user)) {
      return res.status(403).json({ message: "You can only view your own requests" });
    }
    res.json(request);
  } catch (err) {
    next(err);
  }
});

// PUT /api/requests/:id  -> owner only, and only while Pending
router.put("/:id", allowRoles("student"), async (req, res, next) => {
  try {
    const request = await findRequest(req.params.id, res);
    if (!request) return;

    if (!isOwner(request, req.user)) {
      return res.status(403).json({ message: "You can only update your own requests" });
    }
    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Request can only be updated while it is Pending" });
    }

    const { title, description, category } = req.body;
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "category must be one of: " + CATEGORIES.join(", ") });
    }
    if (title !== undefined) request.title = title;
    if (description !== undefined) request.description = description;
    if (category !== undefined) request.category = category;

    await request.save();
    res.json({ message: "Request updated", request });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/requests/:id  -> owner (only while Pending) or admin
router.delete("/:id", async (req, res, next) => {
  try {
    const request = await findRequest(req.params.id, res);
    if (!request) return;

    if (req.user.role !== "admin") {
      if (!isOwner(request, req.user)) {
        return res.status(403).json({ message: "You can only delete your own requests" });
      }
      if (request.status !== "Pending") {
        return res.status(400).json({ message: "Request can only be deleted while it is Pending" });
      }
    }

    await request.deleteOne();
    res.json({ message: "Request deleted" });
  } catch (err) {
    next(err);
  }
});

// PUT /api/requests/:id/status  -> admin changes status / priority / response
// Body: { "status": "Under Review", "priority": "High", "adminResponse": "Checking it" }
router.put("/:id/status", allowRoles("admin"), async (req, res, next) => {
  try {
    const request = await findRequest(req.params.id, res);
    if (!request) return;

    const { status, priority, adminResponse } = req.body;
    if (!status && !priority && adminResponse === undefined) {
      return res.status(400).json({ message: "Provide status, priority or adminResponse" });
    }

    if (status) {
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ message: "status must be one of: " + STATUSES.join(", ") });
      }
      if (!ALLOWED_NEXT[request.status].includes(status)) {
        return res.status(400).json({
          message: `Invalid status change: ${request.status} -> ${status}`,
          allowedNext: ALLOWED_NEXT[request.status],
        });
      }
      if (status === "Assigned") {
        return res.status(400).json({ message: "Use PUT /api/requests/:id/assign to assign a request" });
      }
      request.status = status;
    }

    if (priority) {
      if (!PRIORITIES.includes(priority)) {
        return res.status(400).json({ message: "priority must be one of: " + PRIORITIES.join(", ") });
      }
      request.priority = priority;
    }

    if (adminResponse !== undefined) request.adminResponse = adminResponse;

    await request.save();
    res.json({ message: "Request updated", request });
  } catch (err) {
    next(err);
  }
});

// PUT /api/requests/:id/assign  -> admin assigns request to a staff member
// Body: { "assignedTo": "<userId of staff/admin>" }
router.put("/:id/assign", allowRoles("admin"), async (req, res, next) => {
  try {
    const request = await findRequest(req.params.id, res);
    if (!request) return;

    const { assignedTo } = req.body;
    if (!assignedTo || !mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({ message: "Valid assignedTo user id is required" });
    }

    const staff = await User.findById(assignedTo);
    if (!staff) return res.status(404).json({ message: "Staff user not found" });
    if (staff.role !== "admin") {
      return res.status(400).json({ message: "Request can only be assigned to a staff (admin) user" });
    }

    // Assigning is allowed from "Under Review" (or re-assigning while "Assigned")
    if (request.status !== "Under Review" && request.status !== "Assigned") {
      return res.status(400).json({
        message: `Cannot assign a request with status ${request.status}. It must be Under Review first.`,
      });
    }

    request.assignedTo = staff._id;
    request.status = "Assigned";
    await request.save();
    await request.populate("assignedTo", "name email");

    res.json({ message: "Request assigned", request });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
