"use server";

import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export interface AdminAlert {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  status: "pending" | "verified" | "rejected";
  created_at?: string;
}

export interface AdminData {
  pending: AdminAlert[];
  active: AdminAlert[];
}

export async function loginAdmin(user: string, pass: string) {
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  
  // Simple check
  if (user === adminUser && pass === adminPass) {
    return { success: true };
  }
  return { success: false };
}

export async function getAdminData() {
  try {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const alerts = data.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      severity: a.severity,
      latitude: a.latitude,
      longitude: a.longitude,
      city: a.city,
      state: a.state,
      status: a.status,
      created_at: a.created_at
    })) as AdminAlert[];

    return {
      pending: alerts.filter(a => a.status === 'pending'),
      active: alerts.filter(a => a.status !== 'pending')
    };
  } catch (error) {
    console.error("Error fetching admin data:", error);
    return { pending: [], active: [] };
  }
}

export async function deleteAlert(id: string) {
  try {
    const { error } = await supabase
      .from("alerts")
      .delete()
      .eq("id", id);
      
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/map");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting alert:", error);
    return { success: false, error: error.message };
  }
}

export async function createOfficialAlert(data: {
  title: string;
  severity: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  description?: string;
}) {
  try {
    const { error } = await (supabase.from("alerts") as any)
      .insert({
        title: data.title,
        severity: data.severity,
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || "",
        state: data.state || "",
        description: data.description || "",
        status: "verified" // Official alerts are auto-verified
      });

    if (error) throw error;

    revalidatePath("/map");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating official alert:", error);
    return { success: false, error: error.message };
  }
}

// --- VACCINATION CENTER ACTIONS ---

export interface VaccinationCenter {
  id: string;
  name: string;
  state: string;
  city: string;
  address?: string;
  created_at?: string;
}

export async function getVaccinationCenters(filters?: { name?: string; city?: string; state?: string }) {
  try {
    let query = (supabase.from("vaccination_centers") as any).select("*").order("name", { ascending: true });

    if (filters?.name) {
      query = query.ilike("name", `%${filters.name}%`);
    }
    if (filters?.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    if (filters?.state) {
      query = query.ilike("state", `%${filters.state}%`);
    }
    
    // If no filters are applied, or if only specific filters are needed, we can optimize.
    // For now, simple ilike search.

    const { data, error } = await query;

    if (error) throw error;
    
    return { success: true, centers: data as VaccinationCenter[] };

  } catch (error: any) {
    console.error("Error fetching centers:", error);
    return { success: false, error: error.message, centers: [] };
  }
}

// Helper to get admin client
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not defined");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function addVaccinationCenter(data: { name: string; state: string; city: string; address?: string }) {
  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("vaccination_centers")
      .insert([data]);

    if (error) throw error;

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error adding center:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteVaccinationCenter(id: string) {
  try {
    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("vaccination_centers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting center:", error);
    return { success: false, error: error.message };
  }
}
