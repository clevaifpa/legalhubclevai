import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Contract = Tables<"contracts">;

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContracts = useCallback(async () => {
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setContracts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContracts();

    const channel = supabase
      .channel("contracts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "contracts" }, () => {
        fetchContracts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchContracts]);

  return { contracts, loading, refetch: fetchContracts };
}

export function useContractStats() {
  const { contracts, loading } = useContracts();

  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const total = contracts.length;
  const signed = contracts.filter((c) => c.status === "da_ky").length;
  const pendingReview = contracts.filter((c) => c.status === "dang_review").length;
  const expiringSoon = contracts.filter((c) => {
    if (!c.expiry_date || c.status === "het_hieu_luc") return false;
    const exp = new Date(c.expiry_date);
    return exp >= today && exp <= in30Days;
  }).length;
  const expired = contracts.filter((c) => c.status === "het_hieu_luc").length;
  const draft = contracts.filter((c) => c.status === "nhap").length;

  const byCategory = contracts.reduce<Record<string, number>>((acc, c) => {
    const key = c.category_id || "uncategorized";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byStatus = [
    { name: "Nháp", value: draft, fill: "hsl(var(--muted-foreground))" },
    { name: "Đang review", value: pendingReview, fill: "hsl(var(--info))" },
    { name: "Đã ký", value: signed, fill: "hsl(var(--success))" },
    { name: "Hết hiệu lực", value: expired, fill: "hsl(var(--destructive))" },
  ];

  return {
    contracts,
    loading,
    total,
    signed,
    pendingReview,
    expiringSoon,
    expired,
    draft,
    byCategory,
    byStatus,
  };
}
