import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, Toaster, Toast } from "@chakra-ui/react";
import { system } from "./theme";
import { toaster } from "./components/toaster.ts";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
      <Toaster toaster={toaster}>
        {(toast) => (
          <Toast.Root key={toast.id}>
            <Toast.Title>{toast.title}</Toast.Title>
            {toast.description && (
              <Toast.Description>{toast.description}</Toast.Description>
            )}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </Toaster>
    </ChakraProvider>
  </StrictMode>,
);
