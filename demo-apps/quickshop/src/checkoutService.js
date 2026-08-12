// QuickShop E-Commerce Checkout Core Service
// Handles cart calculations, payment gateway processing, and order record insertion.

globalThis.quickShopOrders = globalThis.quickShopOrders || [
  { id: 'ORD-901', itemsCount: 2, total: 149.99, status: 'PAID', createdAt: '2026-08-09T10:00:00Z' }
];

async function saveOrderToDatabase(orderData) {
  // Simulate database delay & write operation
  await new Promise(resolve => setTimeout(resolve, 150));
  globalThis.quickShopOrders.unshift({
    id: orderData.id,
    itemsCount: orderData.items ? orderData.items.length : 1,
    total: orderData.total,
    status: 'PAID',
    createdAt: new Date().toISOString()
  });
  return true;
}

export async function processCheckout(cartData) {
  if (!cartData.items || cartData.items.length === 0) {
    return { success: false, error: 'Cannot checkout with empty cart (0 items).' };
  }

  const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
  const calculatedTotal = typeof cartData.total === 'number' ? cartData.total : 99.99;
  const orderData = {
    id: orderId,
    items: cartData.items,
    total: calculatedTotal,
    paymentToken: 'tok_visa_success_' + Date.now()
  };

  // Simulate payment processing step
  console.log(`[QuickShop Checkout] Processing payment for Order ${orderId}... Payment Succeeded.`);

  // BUG: Unhandled promise during database insertion - fails silently if DB fails
  saveOrderToDatabase(orderData);
  return { success: true, orderId: orderData.id, status: 'PAID' };
}

export function getOrderHistory() {
  return globalThis.quickShopOrders;
}
