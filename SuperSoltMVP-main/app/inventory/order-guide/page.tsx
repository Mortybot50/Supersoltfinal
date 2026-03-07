import { requireRole } from "@/lib/authz";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OrderGuideClient } from "./OrderGuideClient";

export const metadata = {
  title: "Order Guide | SuperSolt",
  description: "Forecast-based purchasing suggestions for inventory management",
};

export default async function OrderGuidePage() {
  const cookieStore = await cookies();
  const orgId = cookieStore.get("orgId")?.value;
  const venueId = cookieStore.get("venueId")?.value;

  if (!orgId || !venueId) {
    redirect("/dashboard");
  }

  await requireRole(orgId, ["manager", "owner"]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Order Guide</h1>
        <p className="text-muted-foreground mt-2">
          Forecast-based purchasing suggestions to keep your inventory stocked
        </p>
      </div>
      
      <OrderGuideClient />
    </div>
  );
}
