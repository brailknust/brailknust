import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Mirrors the web app's Supabase Auth setup (see ../../src/lib in the Next.js
// app) so the same KNUST account works on web and mobile. Sessions persist in
// AsyncStorage; swap for expo-secure-store-backed storage before shipping if
// you want the refresh token off plain storage.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
