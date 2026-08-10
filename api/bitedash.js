import express from 'express';
import cors from 'cors';
import { calculateDeliveryFee } from '../demo-apps/bitedash/src/deliveryService.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/delivery-fee', (req, res) => {
  try {
    const distance = parseFloat(req.query.distance || '5');
    const fee = calculateDeliveryFee(distance);
    res.json({ success: true, fee });
  } catch (err) {
    res.status(500).json({ success: false, error: 'TypeError in deliveryService.js: ' + err.message });
  }
});

export default app;
