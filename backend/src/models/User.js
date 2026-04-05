const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'ward_authority'],
      default: 'user'
    },
    // Ward authority fields — resolved via Nominatim
    wardName: { type: String, default: null },  // suburb / neighbourhood
    city:     { type: String, default: null }   // city / district
  },
  { timestamps: true }
);

// One ward authority per wardName+city combination
userSchema.index(
  { role: 1, wardName: 1, city: 1 },
  { unique: true, partialFilterExpression: { role: 'ward_authority' } }
);

module.exports = mongoose.model('User', userSchema);
