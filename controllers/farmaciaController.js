// /controllers/farmaciaController.js

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");

function calcularDistancia(lat1, lon1, lat2, lon2) {
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);
  const R = 6371e3; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
}

const generarCsvFarmaciasDeTurno = async (req, res) => {
  try {
    const farmaciasTurno = [];
    const apiKey = "AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA";

    // Obtener datos de farmacias de turno
    const { data } = await axios.get(
      "https://www.colfarmalp.org.ar/turnos-la-plata/"
    );
    const $ = cheerio.load(data);

    // Extraer información de cada farmacia de turno
    for (const element of $(".turnos .tr")) {
      const nombre = $(element)
        .find(".td")
        .eq(0)
        .text()
        .trim()
        .replace("Farmacia", "")
        .trim();
      const direccion = $(element)
        .find(".td")
        .eq(1)
        .text()
        .trim()
        .replace("Dirección", "")
        .trim();
      const telefono = $(element)
        .find(".td")
        .eq(3)
        .text()
        .replace("Teléfono", "")
        .trim();
      const mapaLink = $(element)
        .find('a[href*="https://www.google.com/maps"]')
        .attr("href");
      const coords = mapaLink
        ? mapaLink.match(/destination=([-.\d]+),([-.\d]+)/)
        : null;
      const latitud = coords ? parseFloat(coords[1]) : null;
      const longitud = coords ? parseFloat(coords[2]) : null;

      if (nombre && latitud && longitud) {
        // Buscar el place_id mediante la API de Google Places
        const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitud},${longitud}&radius=50&keyword=${encodeURIComponent(
          "FARMACIA " + nombre
        )}&key=${apiKey}`;

        try {
          const placeResponse = await axios.get(placeSearchUrl);
          const placeData = placeResponse.data.results[0]; // Tomar el primer resultado, que debería coincidir

          // Solo agregar si se encontró el place_id
          if (placeData) {
            const placeId = placeData.place_id;
            farmaciasTurno.push({
              nombre,
              latitud,
              longitud,
              direccion,
              telefono,
              placeId,
            });
          }
        } catch (error) {
          console.error(`Error al obtener place_id para ${nombre}:`, error);
        }
      }
    }

    // Crear el directorio 'files' si no existe (con opción 'recursive: true')
    const dirPath = path.join(__dirname, "../files");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true }); // Asegura que todo el directorio se cree
    }

    // Crear o sobrescribir el archivo CSV con el place_id
    const csvData =
      "nombre,latitud,longitud,direccion,telefono,placeId\n" +
      farmaciasTurno
        .map(
          (farmacia) =>
            `${farmacia.nombre},${farmacia.latitud},${farmacia.longitud},${farmacia.direccion},${farmacia.telefono},${farmacia.placeId}`
        )
        .join("\n");

    const filePath = path.join(dirPath, "farmaciasDeTurno.csv");
    fs.writeFileSync(filePath, csvData, "utf8");

    console.log("Archivo CSV generado exitosamente.")
  } catch (error) {
    console.error("Error al generar el CSV:", error);
    throw error;
  }
};

const obtenerFarmaciasAbiertasOTurno = async (req, res) => {
  try {
    const { lat, lon, cantidad } = req.query;
    const apiKey = "AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA";

    // Validar las coordenadas lat y lon
    if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
      return res
        .status(400)
        .send("Coordenadas de latitud y longitud inválidas");
    }

    let cantidadDeseada = null;
    if (cantidad) {
      cantidadDeseada = parseInt(cantidad, 10);
      if (isNaN(cantidadDeseada) || cantidadDeseada <= 0) {
        return res.status(400).send("Cantidad inválida");
      }
    }

    const farmaciasAbiertas = [];
    let nextPageToken = null;

    do {
      const url =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=10000&type=pharmacy&key=${apiKey}` +
        (nextPageToken ? `&pagetoken=${nextPageToken}` : "");
      const response = await axios.get(url);

      const abiertas = response.data.results
        .filter((lugar) => lugar.opening_hours && lugar.opening_hours.open_now)
        .map((lugar) => ({
          id: lugar.place_id,
          name: lugar.name,
          latitude: parseFloat(lugar.geometry.location.lat),
          longitude: parseFloat(lugar.geometry.location.lng),
          distancia: calcularDistancia(
            lat,
            lon,
            lugar.geometry.location.lat,
            lugar.geometry.location.lng
          ),
        }));

      farmaciasAbiertas.push(...abiertas);

      nextPageToken = response.data.next_page_token;
      if (nextPageToken) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } while (
      nextPageToken &&
      (!cantidadDeseada || farmaciasAbiertas.length < cantidadDeseada)
    );

    // Procesar los detalles en paralelo
    await Promise.all(
      farmaciasAbiertas.map(async (lugar) => {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${lugar.id}&fields=formatted_address,formatted_phone_number&key=${apiKey}`;
        try {
          const detailsResponse = await axios.get(detailsUrl);
          const details = detailsResponse.data.result;
          lugar.direccion =
            details.formatted_address?.split(",")[0].trim() || "No disponible";
          lugar.telefono =
            details.formatted_phone_number || "No disponible";
        } catch (error) {
          console.error(`Error al obtener detalles para ${lugar.id}:`, error);
          lugar.direccion = "No disponible";
          lugar.telefono = "No disponible";
        }
      })
    );

    // Leer farmacias de turno desde el archivo CSV
    const farmaciasTurno = [];
    const csvFilePath = path.join(__dirname, "../files/farmaciasDeTurno.csv");

    if (fs.existsSync(csvFilePath)) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
          .pipe(csvParser())
          .on("data", (row) => {
            const { nombre, latitud, longitud, direccion, telefono, placeId } = row;
            const distancia = calcularDistancia(
              lat,
              lon,
              parseFloat(latitud),
              parseFloat(longitud)
            );

            farmaciasTurno.push({
              id: placeId,
              name: nombre,
              latitude: parseFloat(latitud),
              longitude: parseFloat(longitud),
              distancia: parseInt(distancia),
              direccion: direccion,
              telefono: telefono,
            });
          })
          .on("end", resolve)
          .on("error", reject);
      });
    }

    // Consolidar ambas listas sin duplicados
    const farmaciasConsolidadas = [...farmaciasAbiertas];
    farmaciasTurno.forEach((farmaciaTurno) => {
      if (!farmaciasConsolidadas.some((f) => f.id === farmaciaTurno.id)) {
        farmaciasConsolidadas.push(farmaciaTurno);
      }
    });

    // Limitar la cantidad de resultados si se especifico
    const resultado = farmaciasConsolidadas
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, cantidadDeseada || farmaciasConsolidadas.length);

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al obtener farmacias");
  }
};

const obtenerDirecciones = async (req, res) => {
  const { origin, destination } = req.body;
  const apiKey = "AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA";
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${apiKey}&language=es`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    console.log(data);

    if (data.routes && data.routes.length > 0) {
      // Extraemos los pasos de la primera ruta
      const route = data.routes[0].legs[0].steps.map((step) => ({
        instruction: step.html_instructions.replace(/<[^>]*>?/gm, ""), // Limpia las etiquetas HTML
        lat: step.start_location.lat,
        lng: step.start_location.lng,
      }));

      // Agregar la última ubicación (destino) al final de la ruta
      const endLocation =
        data.routes[0].legs[0].steps.slice(-1)[0].end_location;
      route.push({
        instruction: "Destino alcanzado", // Instrucción para el final del viaje
        lat: endLocation.lat,
        lng: endLocation.lng,
      });
      console.log(route);
      // Responder con la ruta, incluyendo instrucciones paso a paso
      res.json({ route });
    } else {
      res.status(404).json({
        error: "No se encontró una ruta entre las ubicaciones proporcionadas",
      });
    }
  } catch (error) {
    console.error("Error fetching directions:", error);
    res.status(500).json({ error: "Error fetching directions" });
  }
};

module.exports = {
  generarCsvFarmaciasDeTurno,
  obtenerFarmaciasAbiertasOTurno,
  obtenerDirecciones,
};
