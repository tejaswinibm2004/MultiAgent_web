// QuickShop E-Commerce Discount Coupon Engine

export function applyDiscount(subtotal, discountPercent) {
  console.log(`[QuickShop Coupon] Applying discount: ${discountPercent}% on subtotal: $${subtotal}`);

  // BUG: Division by zero or missing guard check when calculating discount rate
  const finalDiscount = (subtotal * discountPercent) / (100 - (discountPercent == 100 ? 100 : 0));
  return finalDiscount;
}
