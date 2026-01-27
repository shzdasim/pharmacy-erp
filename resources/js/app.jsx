import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext.jsx";
import { LicenseProvider } from "./context/LicenseContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import Routing from "./routes/index.jsx";

import { initAxiosAuth } from "./context/axiosSetup.js";
initAxiosAuth();

ReactDOM.createRoot(document.getElementById("app")).render(
  <BrowserRouter>
    <AuthProvider>
      <LicenseProvider>
        <ThemeProvider>
          <Routing />
        </ThemeProvider>
      </LicenseProvider>
    </AuthProvider>
  </BrowserRouter>
);
