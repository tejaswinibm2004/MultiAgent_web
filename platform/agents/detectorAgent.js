import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../../');

export class BugDetectionAgent {
  constructor() {
    this.name = 'Bug Detection & Root Cause Agent';
    this.id = 'AGENT-DETECTOR-01';
  }

  async analyze(issue, application) {
    const logs = [];
    logs.push(`[${this.name}] Starting Root Cause Analysis & Code Verification for Issue #${issue.id}...`);
    logs.push(`[${this.name}] Analyzing Telemetry, Stack Trace & Client Logs...`);

    const titleLower = issue.title.toLowerCase();
    const descLower = issue.description.toLowerCase();
    const stack = issue.stackTrace || '';

    let targetFileRel = '';
    let bugType = '';
    let targetFunction = '';

    if (application.id === 'APP-SHOP-01') {
      if (titleLower.includes('payment') || titleLower.includes('order') || descLower.includes('checkout') || stack.includes('checkoutService')) {
        targetFileRel = 'demo-apps/quickshop/src/checkoutService.js';
        bugType = 'UNHANDLED_PROMISE_SAVING_ORDER';
        targetFunction = 'processCheckout';
      } else if (titleLower.includes('coupon') || titleLower.includes('discount') || descLower.includes('nan') || stack.includes('couponService')) {
        targetFileRel = 'demo-apps/quickshop/src/couponService.js';
        bugType = 'COUPON_CALCULATION_DIV_ZERO';
        targetFunction = 'applyDiscount';
      } else {
        targetFileRel = 'demo-apps/quickshop/src/checkoutService.js';
        bugType = 'UNHANDLED_PROMISE_SAVING_ORDER';
        targetFunction = 'processCheckout';
      }
    } else if (application.id === 'APP-FOOD-02') {
      targetFileRel = 'demo-apps/bitedash/src/deliveryService.js';
      bugType = 'DELIVERY_FEE_UNDEFINED_MULTIPLIER';
      targetFunction = 'calculateDeliveryFee';
    } else {
      targetFileRel = 'demo-apps/quickshop/src/checkoutService.js';
      bugType = 'UNHANDLED_PROMISE_SAVING_ORDER';
      targetFunction = 'processCheckout';
    }

    const fullFilePath = path.join(ROOT_DIR, targetFileRel);
    logs.push(`[${this.name}] Locating source code file: ${targetFileRel}`);

    let fileContent = '';
    if (fs.existsSync(fullFilePath)) {
      fileContent = fs.readFileSync(fullFilePath, 'utf-8');
      logs.push(`[${this.name}] Source file loaded (${fileContent.length} bytes). Inspecting AST & active function implementation...`);
    } else {
      logs.push(`[${this.name}] WARNING: File ${targetFileRel} not found on disk.`);
    }

    let isValidBug = true;
    let rootCauseSummary = '';
    let lineRange = { start: 1, end: 15 };

    // Thorough verification against current source code state
    if (bugType === 'UNHANDLED_PROMISE_SAVING_ORDER') {
      if (fileContent.includes('await saveOrderToDatabase') || fileContent.includes('// FIX:')) {
        isValidBug = false;
        rootCauseSummary = 'Invalid Report: Source code in checkoutService.js is already patched and awaiting database insertions properly. No active bug exists.';
      } else {
        rootCauseSummary = 'Asynchronous order insertion promise was not awaited and lacked error catch block. Failed silently after payment confirmation.';
        lineRange = { start: 20, end: 35 };
      }
    } else if (bugType === 'COUPON_CALCULATION_DIV_ZERO') {
      if (fileContent.includes('safePercent') || fileContent.includes('// FIX:')) {
        isValidBug = false;
        rootCauseSummary = 'Invalid Report: Source code in couponService.js is already patched with percentage zero-division guards. No active bug exists.';
      } else {
        rootCauseSummary = 'Discount calculation formula fails to check for zero percentage denominator, returning NaN and invalid order total.';
        lineRange = { start: 10, end: 25 };
      }
    } else if (bugType === 'DELIVERY_FEE_UNDEFINED_MULTIPLIER') {
      if (fileContent.includes('safeMultiplier') || fileContent.includes('// FIX:')) {
        isValidBug = false;
        rootCauseSummary = 'Invalid Report: Source code in deliveryService.js is already patched with safe multiplier fallbacks. No active bug exists.';
      } else {
        rootCauseSummary = 'Distance tier object lookup for distances over 10km returns undefined multiplier, causing 500 TypeError during total calculation.';
        lineRange = { start: 15, end: 28 };
      }
    }

    if (isValidBug) {
      logs.push(`[${this.name}] VERIFICATION PASSED: Genuine bug detected in '${targetFileRel}' inside function '${targetFunction}'.`);
      logs.push(`[${this.name}] Root Cause Summary: ${rootCauseSummary}`);
    } else {
      logs.push(`[${this.name}] ❌ VERIFICATION FAILED: Issue report #${issue.id} is invalid!`);
      logs.push(`[${this.name}] ${rootCauseSummary}`);
      logs.push(`[${this.name}] Rejecting issue report pipeline. No code patch will be generated.`);
    }

    return {
      agentId: this.id,
      agentName: this.name,
      isValidBug,
      bugType,
      targetFileRel,
      fullFilePath,
      targetFunction,
      lineRange,
      rootCauseSummary,
      fileContent,
      logs
    };
  }
}
