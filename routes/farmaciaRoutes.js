// /routes/farmaciaRoutes.js

const express = require("express");
const router = express.Router();
const farmaciaController = require("../controllers/farmaciaController");

router.get(
  "/farmacias-de-turno",
  farmaciaController.generarCsvFarmaciasDeTurno
);
router.get(
  "/farmacias-abiertas-o-de-turno",
  farmaciaController.obtenerFarmaciasAbiertasOTurno
);
router.post("/get-directions", farmaciaController.obtenerDirecciones);

module.exports = router;
