import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { verifyRoutes } from "./src/routes/verify.js";

const app = Fastify({ logger: true, bodyLimit: 20 * 1024 * 1024 }); // 20mb

app.register(multipart);
app.register(verifyRoutes);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: process.env.HOST ?? "::" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
  app.log.info(`dotacion-verificador corriendo en http://localhost:${port}`);
});
