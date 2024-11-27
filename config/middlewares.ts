export default [
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  {
    name: "strapi::cors",
    config: {
      origin: ["http://localhost:3000"], // URL của frontend
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true, // Cho phép gửi cookies
    },
  },
];
