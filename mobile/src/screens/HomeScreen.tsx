import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { registerForPushNotificationsAsync } from "../lib/notifications";

// Placeholder "Today" dashboard. Real screens (Courses, Tasks, Timetable,
// Goals, AI Chat, Notifications) land in Phase 2 — see
// docs/mobile-roadmap.md.
export function HomeScreen() {
  const { session, signOut } = useAuth();

  useEffect(() => {
    registerForPushNotificationsAsync().catch((error) => {
      // Non-fatal: device-token API route doesn't exist yet (Phase 3).
      console.warn("Push registration skipped:", error);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.email}>{session?.user.email}</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "700" },
  email: { fontSize: 14, color: "#6b7280", marginBottom: 16 },
  button: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
