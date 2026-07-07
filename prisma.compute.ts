import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "eoda-platform",
    framework: "nextjs",
    httpPort: 3000,
    root: "apps/web",
  },
});
