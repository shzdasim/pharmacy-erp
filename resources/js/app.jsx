import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import Routing from "./routes/index.jsx";
import { initAxiosAuth } from "./context/axiosSetup.js";
initAxiosAuth();
ReactDOM.createRoot(document.getElementById("app")).render(
  <BrowserRouter>
    <AuthProvider>
      <Routing />
    </AuthProvider>
  </BrowserRouter>
);
