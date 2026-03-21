import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme";
import { Toaster } from "@chakra-ui/react";
import { toaster } from "./components/toaster.ts";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
      <Toaster toaster={toaster} />
    </ChakraProvider>
  </StrictMode>,
);
