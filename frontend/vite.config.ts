import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Relative asset paths in the production build so the static bundle works
  // whether it's uploaded to a domain root or a subfolder (e.g. on one.com).
  base: command === "build" ? "./" : "/",
  server: {
    host: true, // expose on the LAN so a phone can hit http://<dev-machine-ip>:<port>
  },
}));
