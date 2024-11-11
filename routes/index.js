// /routes/index.js

const express = require("express");
const router = express.Router();

const farmaciaRoutes = require("./farmaciaRoutes");

router.use(farmaciaRoutes); // Añade el prefijo '/api' para las rutas de farmacia

module.exports = router;
