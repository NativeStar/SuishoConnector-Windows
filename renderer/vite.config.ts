import { defineConfig } from 'vite'
import path from "path";
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),tsconfigPaths()],
  base:"./",
  resolve:{
    alias:{
      "~":"/src",
      "shared":path.resolve(__dirname, "../shared/src")
    }
  }
})
