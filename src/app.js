import express from "express";
import handlebars from "express-handlebars";
import { __dirname } from "./utils.js";
import { productsRouter } from "./routes/products.routes.js";
import { cartsRouter } from "./routes/carts.routes.js";
import { viewsRouter } from "./routes/views.routes.js";
import { Server } from "socket.io";
import { MessageModel } from "./dao/models/message.model.js";
import ConnectMongo from "connect-mongo";
import session from "express-session";
import { sessionsRouter } from "./routes/sessions.routes.js";
import { initializePassport } from "../src/config/passport.config.js";
import passport from "passport";
import "./config/passport.github.js";
import { connectToDatabase } from "./dao/connectDB.js";
import { mockingRouter } from "./routes/mocking.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { middlewareLogger, logger } from "./config/winstongLogger.config.js";
import { recoverPasswordRouter } from "./routes/recoverPassword.routes.js";
import cookieParser from "cookie-parser";
import { routerUserPremium } from "./routes/user.routes.js";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUiExpress from "swagger-ui-express";
import second from "multer";
import multer from "multer";
// Express
export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.disable("x-powered-by");
//SESSIONS
app.use(
    session({
        secret: "secretpassword",
        resave: false,
        saveUninitialized: false,
        store: ConnectMongo.create({
            mongoUrl:
                "mongodb+srv://nahueljosebenitez7:123Coder@cluster0.93y9tit.mongodb.net/ecommerce",
            ttl: 3600,
        }),
    }),
);
initializePassport();
app.use(passport.initialize());
app.use(passport.session());

// Routers
app.use(viewsRouter);
app.use(sessionsRouter);
app.use(middlewareLogger);
app.use("/api", productsRouter);
app.use("/api", cartsRouter);
app.use("/api", mockingRouter);
app.use("/logger", (req, res) => {
    logger.log("debug", "pruebaaa");
    logger.log("error", "ERROR FATAL");
    res.send("logger");
});
app.use(recoverPasswordRouter);
app.use("/api", routerUserPremium);
//Handlebars
app.engine("hbs", handlebars.engine());
app.set("views", __dirname + "/views");
app.set("view engine", "hbs");
app.use(express.static(__dirname + "/public"));

app.use(errorHandler);

//swagger
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API ECOMMERCE",
            version: "0.1.0",
            description:
                "Esta es una simple API RESTful hecha con Express y documentada con Swagger",
        },
    },
    apis: ["./src/docs/**/*.yaml"], // Aquí es donde debes especificar las rutas a tus archivos con definiciones de la API
};

const specs = swaggerJsdoc(swaggerOptions);
app.use("/apidocs", swaggerUiExpress.serve, swaggerUiExpress.setup(specs));

//Multer

// Route not found
// app.use((req, res) => {
//     res.status(404).send("Page not found");
// });

// Listen
const PORT = 8080;
const httpServer = app.listen(
    PORT,
    logger.info(`Servidor corriendo en http://localhost:${PORT}`),
);
// Socket.io
export const io = new Server(httpServer);

io.on("connection", async (socket) => {
    logger.info(`se ha conectado un cliente con id: ${socket.id}`),
        // como se conecta uno recibimos de allá el emmit "id"
        socket.on("id", async (nombre) => {
            // emitimos que se conecto alguien para que alla salga la toast
            socket.broadcast.emit("newUser", nombre);
            //objetenemos los mensajes para cargarlos alla
            const messages = await MessageModel.find().lean();
            // se los mandamos para que los reciban con el on
            socket.emit("getMessagesStart", messages);
            // cuando alguien envie un mensaje se emite messageSend y aca se procesa para guardar todo en base de datos
            socket.on("messageSend", async (model) => {
                await MessageModel.create(model);
                const messages = await MessageModel.find().lean();
                socket.emit("reloadMessages", messages);
                socket.broadcast.emit("reloadMessagesForOthers", messages);
            });
        });
});

//MongoDb connection

connectToDatabase();
