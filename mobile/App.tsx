import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityIndicator, SafeAreaView, StatusBar } from "react-native";
import { AuthProvider, useAuth } from "./src/hooks/useAuth";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LoginScreen } from "./src/screens/LoginScreen";

const queryClient = new QueryClient();

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {session ? <HomeScreen /> : <LoginScreen />}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </QueryClientProvider>
  );
}
