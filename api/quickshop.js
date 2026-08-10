import express from 'express';
import cors from 'cors';
import { processCheckout, getOrderHistory } from '../demo-apps/quickshop/src/checkoutService.js';
import { applyDiscount } from '../demo-apps/quickshop/src/couponService.js';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/checkout', async (req, res) => {
  try {
    const result = await processCheckout(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/coupon', async (req, res) => {
  try {
    const { subtotal, code } = req.body;
    let discountPercent = 10;
    if (code === 'SAVE100') discountPercent = 100;
    const discount = applyDiscount(subtotal, discountPercent);
    if (Number.isNaN(discount)) {
      return res.json({ success: false, error: 'Coupon calculation engine output NaN due to division error.' });
    }
    res.json({ success: true, discount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  res.json(getOrderHistory());
});

export default app;
