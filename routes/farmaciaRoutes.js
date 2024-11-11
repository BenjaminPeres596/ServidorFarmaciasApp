// /routes/farmaciaRoutes.js

const express = require("express");
const router = express.Router();
const farmaciaController = require("../controllers/farmaciaController");

router.get("/farmacias-de-turno", farmaciaController.generarCsvFarmaciasDeTurno);
router.get("/farmacias-abiertas-o-de-turno", farmaciaController.obtenerFarmaciasAbiertasOTurno);

module.exports = router;