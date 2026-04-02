import { env } from "./config/env";
import { buildApp } from "./app";

const app = buildApp();

app
  .listen({
    port: env.PORT,
    host: "0.0.0.0"
  })
  .then(() => {
    app.log.info(`New Erra API запущен на порту ${env.PORT}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
