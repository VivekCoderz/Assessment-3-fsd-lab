const express = require("express");
const { ServiceRequest } = require("../models/ServiceRequest");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();

// GET /api/admin/dashboard  -> statistics using MongoDB aggregation
router.get("/dashboard", protect, allowRoles("admin"), async (req, res, next) => {
  try {
    const [result] = await ServiceRequest.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          highPriority: [{ $match: { priority: "High" } }, { $count: "count" }],
          byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
        },
      },
    ]);

    // Convert [{_id: "Pending", count: 3}, ...] into { Pending: 3, ... }
    const statusCounts = {};
    result.byStatus.forEach((s) => (statusCounts[s._id] = s.count));
    const categoryCounts = {};
    result.byCategory.forEach((c) => (categoryCounts[c._id] = c.count));

    res.json({
      totalRequests: result.total[0]?.count || 0,
      pending: statusCounts["Pending"] || 0,
      inProgress: statusCounts["In Progress"] || 0,
      resolved: statusCounts["Resolved"] || 0,
      highPriority: result.highPriority[0]?.count || 0,
      byStatus: statusCounts, // bonus
      byCategory: categoryCounts, // bonus
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
