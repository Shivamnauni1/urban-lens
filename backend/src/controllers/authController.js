const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { resolveWard } = require('../utils/nominatim');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, password, role, latitude, longitude } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });

    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    let wardName = null;
    let city = null;

    if (role === 'ward_authority') {
      // Option 1: manual ward name + city (preferred)
      if (req.body.wardName && req.body.city) {
        wardName = req.body.wardName.trim();
        city     = req.body.city.trim();
      }
      // Option 2: GPS coordinates — resolve via Nominatim
      else if (latitude && longitude) {
        const resolved = await resolveWard(parseFloat(latitude), parseFloat(longitude));
        wardName = resolved.wardName || resolved.city;
        city     = resolved.city;
      }

      if (!wardName || !city)
        return res.status(400).json({ message: 'Ward name and city are required for Ward Authority accounts' });

      // One authority per ward+city
      const wardTaken = await User.findOne({
        role: 'ward_authority',
        wardName: { $regex: new RegExp(`^${wardName}$`, 'i') },
        city:     { $regex: new RegExp(`^${city}$`, 'i') }
      });
      if (wardTaken)
        return res.status(400).json({ message: `An authority account already exists for ${wardName}, ${city}` });
    }

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ message: 'Username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashed,
      role: role || 'user',
      wardName,
      city
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      role: user.role,
      wardName: user.wardName,
      city: user.city,
      token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      _id: user._id,
      username: user.username,
      role: user.role,
      wardName: user.wardName,
      city: user.city,
      token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({
    _id: req.user._id,
    username: req.user.username,
    role: req.user.role,
    wardName: req.user.wardName,
    city: req.user.city
  });
};

module.exports = { register, login, getMe };
