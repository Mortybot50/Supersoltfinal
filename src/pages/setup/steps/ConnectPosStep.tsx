import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner'
import { CheckCircle, Loader2, ShoppingCart } from "lucide-react";

interface Props {
  orgId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function ConnectPosStep({ orgId, onNext, onBack }: Props) {
;
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [merchantName, setMerchantName] = useState<string | null>(null);

  useEffect(() => {
    const checkPos = async () => {
      const { data } = await supabase
        .from("pos_connections")
        .select("id, merchant_name, is_active")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .limit(1);

      if (data && data.length > 0) {
        setConnected(true);
        setMerchantName(data[0].merchant_name);
      }
      setLoading(false);
    };
    checkPos();
  }, [orgId]);

  const handleConnect = () => {
    toast.success("Square POS", { description: "POS connection will be available after setup. You can connect later from Settings > Integrations.", });
  };

  if (loading) {
    return (
      <Card className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Connect POS</h2>

      {connected ? (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-6">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Square POS Connected</p>
            {merchantName && <p className="text-sm text-green-600">{merchantName}</p>}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 space-y-4">
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium mb-1">Connect your Point of Sale</p>
            <p className="text-sm text-muted-foreground mb-4">
              Sync sales data automatically from Square POS
            </p>
          </div>
          <Button onClick={handleConnect} size="lg">
            Connect Square POS
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-6">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          {connected ? "Next" : "Skip for now"}
        </Button>
      </div>
    </Card>
  );
}
