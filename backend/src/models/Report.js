const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    citizen:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    imageUrl:    { type: String, required: true },
    description: { type: String, default: '' },
    location: {
      type:        { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true } // [lng, lat]
    },
    // Resolved from Nominatim
    wardName: { type: String, default: null },
    city:     { type: String, default: null },
    // ML outputs
    damageType:   { type: String, default: 'Evaluating' },
    severity:     { type: Number, min: 1, max: 5, default: null },
    urgencyScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected', 'In Progress', 'Resolved'],
      default: 'Pending'
    }
  },
  { timestamps: true }
);

reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
