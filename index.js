const express = require("express");
const app = express();
const rutas = require("./routes/index");
const schedule = require("node-schedule");
const { generarCsvFarmaciasDeTurno } = require("./controllers/farmaciaController");

app.use(express.json());
app.use("/", rutas);

(async () => {
  try {
    await generarCsvFarmaciasDeTurno();
  } catch (error) {
    console.error("Error generando CSV:", error);
  }
})();

// Programar la generación del CSV diariamente a las 8:30 AM
schedule.scheduleJob("30 8 * * *", async () => {
  try {
    console.log("Generando CSV programado...");
    await generarCsvFarmaciasDeTurno();
    console.log("CSV generado exitosamente (programado).");
  } catch (error) {
    console.error("Error generando CSV programado:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});