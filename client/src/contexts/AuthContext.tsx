import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { pb, getUserClaimedBatteriesLocal, saveUserClaimedBatteriesLocal, getDbBatteryById, type DbUser } from "@/lib/pocketbase";
import type { RecordModel } from "pocketbase";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  activeBatteryId?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  claimedBatteries: string[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { email: string; password: string; passwordConfirm: string; name?: string; activeBatteryId?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setActiveBattery: (batteryId: string) => Promise<void>;
  addBatteryToAccount: (batteryId: string) => Promise<{ success: boolean; error?: string }>;
  removeBatteryFromAccount: (batteryId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapRecordToAuthUser(model: RecordModel | null): AuthUser | null {
  if (!model) return null;
  return {
    id: model.id,
    email: model.email || "",
    name: model.name || model.email?.split("@")[0] || "Operator",
    avatarUrl: model.avatar ? pb.files.getUrl(model, model.avatar) : undefined,
    activeBatteryId: model.activeBatteryId || "",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    return mapRecordToAuthUser(pb.authStore.record);
  });
  const [loading, setLoading] = useState(false);
  const [claimedBatteries, setClaimedBatteries] = useState<string[]>(() => {
    if (pb.authStore.record?.id) {
      const stored = getUserClaimedBatteriesLocal(pb.authStore.record.id);
      if (stored.length > 0) return stored;
      if (pb.authStore.record.activeBatteryId) return [pb.authStore.record.activeBatteryId];
      if (pb.authStore.record.email === "demo@voltpassport.ai") return ["BAT0001", "BAT0042"];
    }
    return [];
  });

  // Sync claimed batteries whenever user changes
  useEffect(() => {
    if (user?.id) {
      const stored = getUserClaimedBatteriesLocal(user.id);
      if (stored.length > 0) {
        setClaimedBatteries(stored);
      } else {
        const initial = user.activeBatteryId ? [user.activeBatteryId] : (user.email === "demo@voltpassport.ai" ? ["BAT0001", "BAT0042"] : []);
        setClaimedBatteries(initial);
        if (initial.length > 0) {
          saveUserClaimedBatteriesLocal(user.id, initial);
        }
      }
    } else {
      setClaimedBatteries([]);
    }
  }, [user?.id, user?.activeBatteryId, user?.email]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(mapRecordToAuthUser(model));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const authData = await pb.collection("users").authWithPassword(email.trim(), password);
      const mapped = mapRecordToAuthUser(authData.record);
      setUser(mapped);
      
      // Load user's claimed batteries
      if (mapped?.id) {
        const stored = getUserClaimedBatteriesLocal(mapped.id);
        const list = stored.length > 0 ? stored : (mapped.activeBatteryId ? [mapped.activeBatteryId] : (mapped.email === "demo@voltpassport.ai" ? ["BAT0001", "BAT0042"] : []));
        setClaimedBatteries(list);
        saveUserClaimedBatteriesLocal(mapped.id, list);
      }
      
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      const msg = err.data?.message || err.message || "Invalid workspace credentials.";
      return { success: false, error: msg };
    }
  }, []);

  const register = useCallback(async (data: { email: string; password: string; passwordConfirm: string; name?: string; activeBatteryId?: string }) => {
    setLoading(true);
    try {
      const activeBat = data.activeBatteryId?.trim().toUpperCase() || "";
      // 1. Create user in PocketBase
      await pb.collection("users").create({
        email: data.email.trim(),
        password: data.password,
        passwordConfirm: data.passwordConfirm,
        name: data.name?.trim() || "Operator",
        activeBatteryId: activeBat,
        emailVisibility: true,
      });

      // 2. Auto-login with created credentials
      const authData = await pb.collection("users").authWithPassword(data.email.trim(), data.password);
      const mapped = mapRecordToAuthUser(authData.record);
      setUser(mapped);

      if (mapped?.id && activeBat) {
        const list = [activeBat];
        setClaimedBatteries(list);
        saveUserClaimedBatteriesLocal(mapped.id, list);
      }

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      let errorMsg = "Could not register battery workspace.";
      if (err.data?.data) {
        const fieldErrors = Object.entries(err.data.data)
          .map(([field, errObj]: [string, any]) => `${field}: ${errObj.message}`)
          .join("; ");
        if (fieldErrors) errorMsg = fieldErrors;
      } else if (err.message) {
        errorMsg = err.message;
      }
      return { success: false, error: errorMsg };
    }
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setClaimedBatteries([]);
  }, []);

  const setActiveBattery = useCallback(async (batteryId: string) => {
    const normalized = batteryId.trim().toUpperCase();
    if (user && pb.authStore.isValid && pb.authStore.record) {
      try {
        const updated = await pb.collection("users").update(user.id, {
          activeBatteryId: normalized,
        });
        setUser(mapRecordToAuthUser(updated));
      } catch (err) {
        console.warn("Failed to persist active battery to user profile:", err);
      }
    } else {
      setUser(current => current ? { ...current, activeBatteryId: normalized } : null);
    }
  }, [user]);

  const addBatteryToAccount = useCallback(async (batteryId: string) => {
    const normalized = batteryId.trim().toUpperCase();
    if (!normalized) return { success: false, error: "Please enter a valid Battery ID." };

    // Verify battery exists in system/dataset
    const record = await getDbBatteryById(normalized);
    if (!record && !normalized.startsWith("BAT") && !normalized.startsWith("VPA")) {
      return { success: false, error: `Battery ${normalized} not recognized in the verified battery registry.` };
    }

    if (claimedBatteries.includes(normalized)) {
      await setActiveBattery(normalized);
      return { success: true };
    }

    const updatedList = [...claimedBatteries, normalized];
    setClaimedBatteries(updatedList);
    if (user?.id) {
      saveUserClaimedBatteriesLocal(user.id, updatedList);
    }
    await setActiveBattery(normalized);
    return { success: true };
  }, [claimedBatteries, user?.id, setActiveBattery]);

  const removeBatteryFromAccount = useCallback(async (batteryId: string) => {
    const normalized = batteryId.trim().toUpperCase();
    const updatedList = claimedBatteries.filter(id => id !== normalized);
    setClaimedBatteries(updatedList);
    if (user?.id) {
      saveUserClaimedBatteriesLocal(user.id, updatedList);
    }
    if (user?.activeBatteryId === normalized) {
      const nextActive = updatedList[0] || "";
      await setActiveBattery(nextActive);
    }
  }, [claimedBatteries, user, setActiveBattery]);

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user && pb.authStore.isValid),
    loading,
    claimedBatteries,
    login,
    register,
    logout,
    setActiveBattery,
    addBatteryToAccount,
    removeBatteryFromAccount,
  }), [user, loading, claimedBatteries, login, register, logout, setActiveBattery, addBatteryToAccount, removeBatteryFromAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthSafe() {
  const context = useContext(AuthContext);
  return (
    context || {
      user: null,
      isAuthenticated: false,
      loading: false,
      claimedBatteries: [],
      login: async () => ({ success: false, error: "Auth unavailable" }),
      register: async () => ({ success: false, error: "Auth unavailable" }),
      logout: () => {},
      setActiveBattery: async () => {},
      addBatteryToAccount: async () => ({ success: false, error: "Auth unavailable" }),
      removeBatteryFromAccount: async () => {},
    }
  );
}
