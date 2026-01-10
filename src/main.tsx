import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { queryClient } from "./lib/query-client";
import "./styles/index.css";
import { CartProvider } from "./contexts/CartContext.tsx";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter
     future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
  