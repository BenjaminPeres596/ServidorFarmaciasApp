const express = require("express");
const app = express();
const rutas = require("./routes/index");

app.use(express.json());
app.use("/", rutas);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});