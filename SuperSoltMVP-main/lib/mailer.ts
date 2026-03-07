import { Resend } from "resend";

const key = process.env.RESEND_API_KEY;
export const resend = key ? new Resend(key) : null;

export async function sendEmail({ to, subject, html }: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.log("[DEV EMAIL]", { to, subject, html }); // dev fallback
    return;
  }
  await resend.emails.send({
    from: process.env.EMAIL_FROM || "SuperSolt <no-reply@localhost>",
    to,
    subject,
    html
  });
}

export async function sendPurchaseOrderEmailDev({ po, lines }: { po: any; lines: any[] }) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📧 PURCHASE ORDER EMAIL (DEV MODE)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`To: ${po.supplierEmail || po.supplierName || "Unknown Supplier"}`);
  console.log(`Subject: Purchase Order #${po.number}`);
  console.log("");
  console.log("Dear Supplier,");
  console.log("");
  console.log(`Please find our purchase order #${po.number} below:`);
  console.log("");
  console.log("Order Details:");
  console.log(`  Order Date: ${po.orderDate || "N/A"}`);
  console.log(`  Expected Date: ${po.expectedDate || "N/A"}`);
  console.log(`  Status: ${po.status}`);
  console.log("");
  console.log("Items:");
  console.log("─".repeat(80));
  
  for (const line of lines) {
    const packQty = Number(line.packsOrdered || line.packQty || 0);
    const packSize = Number(line.packSize || 0);
    const packUnit = line.packUnit || line.baseUom || "";
    const packCost = Number(line.packCostCents || 0) / 100;
    const lineTotal = packQty * packCost;
    
    console.log(`  ${packQty} × ${packSize}${packUnit} packs @ A$${packCost.toFixed(2)} = A$${lineTotal.toFixed(2)}`);
  }
  
  console.log("─".repeat(80));
  console.log(`  Subtotal: A$${(Number(po.subtotalCents || 0) / 100).toFixed(2)}`);
  console.log(`  Tax: A$${(Number(po.taxCents || 0) / 100).toFixed(2)}`);
  console.log(`  Total: A$${(Number(po.totalCents || 0) / 100).toFixed(2)}`);
  console.log("");
  
  if (po.notes) {
    console.log(`Notes: ${po.notes}`);
    console.log("");
  }
  
  console.log("Please confirm receipt and provide delivery timeline.");
  console.log("");
  console.log("Thank you,");
  console.log("Your Hospitality Team");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  return { ok: true, dev: true };
}
