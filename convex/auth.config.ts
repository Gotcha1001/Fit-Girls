// convex/auth.config.ts
const authConfig = {
  providers: [
    {
      domain: "https://summary-tiger-4185.clerk.accounts.dev",
      applicationID: "convex", // ← must be "convex", not a dynamic env var
    },
  ],
};

export default authConfig;
