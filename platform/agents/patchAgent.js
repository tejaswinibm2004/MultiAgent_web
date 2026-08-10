import fs from 'fs';

export class PatchGenerationAgent {
  constructor() {
    this.name = 'Patch Generation & Remediation Agent';
    this.id = 'AGENT-PATCH-03';
  }

  async generate(detectionResult, riskResult) {
    const logs = [];
    logs.push(`[${this.name}] Synthesizing Code Patch for ${detectionResult.targetFileRel}...`);

    const { bugType, fullFilePath, fileContent } = detectionResult;

    let updatedCode = fileContent;
    let description = '';

    if (bugType === 'UNHANDLED_PROMISE_SAVING_ORDER') {
      description = 'Add await keyword to saveOrderToDatabase promise call and wrap in try/catch block.';
      if (fileContent.includes('// FIX:')) {
        updatedCode = fileContent; // Already patched cleanly
      } else {
        updatedCode = fileContent.replace(
          /(\/\/\s*BUG:.*\n\s*)?saveOrderToDatabase\(orderData\);/g,
          `// FIX: Properly await database insertion with error handling\n  try {\n    await saveOrderToDatabase(orderData);\n  } catch (err) {\n    console.error('Order save error:', err);\n  }`
        );
      }
    } else if (bugType === 'COUPON_CALCULATION_DIV_ZERO') {
      description = 'Add check for invalid/zero discount rates and guard against NaN outputs.';
      if (fileContent.includes('// FIX:')) {
        updatedCode = fileContent;
      } else {
        updatedCode = fileContent.replace(
          /(\/\/\s*BUG:.*\n\s*)?const finalDiscount = .*/g,
          `// FIX: Validated percentage calculation with zero-division safety guard\n  if (!discountPercent || discountPercent <= 0) return subtotal;\n  const safePercent = Math.min(Math.max(discountPercent, 0), 100);\n  const discountAmount = (subtotal * safePercent) / 100;\n  const finalDiscount = Math.max(0, subtotal - discountAmount);\n  return Number.isNaN(finalDiscount) ? subtotal : finalDiscount;`
        );
      }
    } else if (bugType === 'DELIVERY_FEE_UNDEFINED_MULTIPLIER') {
      description = 'Provide default fallbacks for extended delivery distances (>10km) in delivery service.';
      if (fileContent.includes('safeMultiplier')) {
        updatedCode = fileContent;
      } else {
        updatedCode = fileContent.replace(
          /(\/\/\s*BUG:.*\n\s*)?const fee = .*/g,
          `// FIX: Default fallback multiplier for long distances (>10km)\n  const safeMultiplier = multipliers[tier] || 2.5;\n  const fee = baseFee + (distanceKm * safeMultiplier);`
        );
      }
    }

    logs.push(`[${this.name}] Running AST & Syntactical Validation on generated patch...`);
    
    // Validate JavaScript syntax using Function constructor
    let syntaxValid = true;
    try {
      const checkCode = updatedCode
        .replace(/import .*/g, '')
        .replace(/export (default )?/g, '');
      new Function(`(async () => { ${checkCode} })`);
      logs.push(`[${this.name}] AST Syntax Check PASSED: Code is syntactically valid JS.`);
    } catch (err) {
      syntaxValid = false;
      logs.push(`[${this.name}] ERROR: Syntax Validation Failed: ${err.message}`);
    }

    // Produce unified diff snippet
    const diff = `--- a/${detectionResult.targetFileRel}\n+++ b/${detectionResult.targetFileRel}\n@@ -${detectionResult.lineRange.start},${detectionResult.lineRange.end} @@\n+ ${description}`;

    logs.push(`[${this.name}] Code Patch Generated Successfully.`);

    return {
      agentId: this.id,
      agentName: this.name,
      targetFileRel: detectionResult.targetFileRel,
      fullFilePath: detectionResult.fullFilePath,
      originalCode: fileContent,
      updatedCode,
      diff,
      description,
      syntaxValid,
      logs
    };
  }
}
