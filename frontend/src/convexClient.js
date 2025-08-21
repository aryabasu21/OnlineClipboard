let convex = null;
const url = import.meta.env.VITE_CONVEX_URL;
if (url) {
  const spec = "convex/browser";
  import(/* @vite-ignore */ spec)
    .then((mod) => {
      const ConvexClient = mod.ConvexClient || mod.default || mod;
      try {
        convex = new ConvexClient(url);
        window.__convexClient = {
          mutation: (name, args) => convex.mutation(name, args),
          query: (name, args) => convex.query(name, args),
        };
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      /* ignore */
    });
}
export { convex };
