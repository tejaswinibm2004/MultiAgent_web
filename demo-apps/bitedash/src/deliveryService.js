// BiteDash Food Delivery Rate Engine

const multipliers = {
  short: 1.2,
  medium: 1.8,
  long: 2.2
};

export function calculateDeliveryFee(distanceKm) {
  const baseFee = 3.50;
  let tier = 'short';
  if (distanceKm > 3 && distanceKm <= 10) tier = 'medium';
  if (distanceKm > 10 && distanceKm <= 20) tier = 'extended'; // 'extended' key does not exist in multipliers!

  // BUG: Undefined multiplier access for distance > 10km
  const fee = baseFee + (distanceKm * multipliers[tier]);
  return Number(fee.toFixed(2));
}
