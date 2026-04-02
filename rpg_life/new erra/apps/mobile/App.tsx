import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootApp } from "./src/app/RootApp";
import { SessionProvider } from "./src/lib/session-context";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <RootApp />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
