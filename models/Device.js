const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Unknown Device' },
  type: { type: String, enum: ['android', 'pc', 'web'], required: true },
  os: { type: String, default: '' },
  osVersion: { type: String, default: '' },
  browser: { type: String, default: '' },
  browserVersion: { type: String, default: '' },
  ip: { type: String, default: '' },
  country: { type: String, default: '' },
  status: { type: String, enum: ['online', 'offline'], default: 'online' },
  lastSeen: { type: Date, default: Date.now },
  firstSeen: { type: Date, default: Date.now },
  totalKeystrokes: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);

