"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const verify_js_1 = require("./src/routes/verify.js");
const app = (0, fastify_1.default)({ logger: true, bodyLimit: 20 * 1024 * 1024 }); // 20mb
app.register(multipart_1.default);
app.register(verify_js_1.verifyRoutes);
const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
    app.log.info(`dotacion-verificador corriendo en http://localhost:${port}`);
});
