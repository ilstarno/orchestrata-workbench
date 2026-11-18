import webConfig from "../frontend/vite.config";

export default {
  ...webConfig,
  resolve: {
    dedupe: [
      "fflate",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "react",
      "react-dom",
      "vitest",
    ],
  },
  test: {
    include: ["../frontend_tests/**/*.{test,spec}.{ts,tsx}"],
  },
};
