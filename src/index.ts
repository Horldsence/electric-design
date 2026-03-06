import { serve } from "bun";
import index from "./index.html";
import { POST as exportPost } from "./routes/export";
import { POST as compilePost } from "./routes/compile";
import { POST as convertPost } from "./routes/convert";
import { POST as compileAndConvertPost } from "./routes/compile-and-convert";

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async req => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    "/api/export": {
      POST: exportPost
    },

    "/api/compile": {
      POST: compilePost
    },

    "/api/convert": {
      POST: convertPost
    },

    "/api/compile-and-convert": {
      POST: compileAndConvertPost
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
