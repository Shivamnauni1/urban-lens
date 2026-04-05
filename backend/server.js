const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./src/config/db');
const authRoutes     = require('./src/routes/authRoutes');
const reportRoutes   = require('./src/routes/reportRoutes');
const repairRoutes   = require('./src/routes/repairRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',      authRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/repairs',  repairRoutes);
app.use('/api/analytics', analyticsRoutes);

// Debug — see raw Nominatim response for any coordinate
app.get('/api/debug/ward', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ message: 'Provide lat and lng' });
  const { resolveWard } = require('./src/utils/nominatim');
  const result = await resolveWard(parseFloat(lat), parseFloat(lng));
  res.json(result);
});

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
