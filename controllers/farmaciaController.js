// /controllers/farmaciaController.js

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
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

        // Obtener datos de farmacias de turno
        const { data } = await axios.get("https://www.colfarmalp.org.ar/turnos-la-plata/");
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
            const mapaLink = $(element)
                .find('a[href*="https://www.google.com/maps"]')
                .attr("href");
            const coords = mapaLink
                ? mapaLink.match(/destination=([-.\d]+),([-.\d]+)/)
                : null;
            const latitud = coords ? parseFloat(coords[1]) : null;
            const longitud = coords ? parseFloat(coords[2]) : null;

            if (nombre && latitud && longitud) {
                farmaciasTurno.push({ nombre, latitud, longitud });
            }
        }

        // Crear o sobrescribir el archivo CSV
        const csvData = "nombre,latitud,longitud\n" + farmaciasTurno
            .map((farmacia) => `${farmacia.nombre},${farmacia.latitud},${farmacia.longitud}`)
            .join("\n");

        fs.writeFileSync("files/farmacias_de_turno.csv", csvData, "utf8");

        res.status(200).send("Archivo CSV de farmacias de turno creado correctamente.");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al obtener farmacias de turno");
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

        // Convertir `cantidad` a número y validar
        let cantidadDeseada = null;
        if (cantidad) {
            cantidadDeseada = parseInt(cantidad, 10);
            if (isNaN(cantidadDeseada) || cantidadDeseada <= 0) {
                return res.status(400).send("Cantidad inválida");
            }
        }

        const farmaciasAbiertas = [];
        const farmaciasTurno = [];

        // Obtener farmacias abiertas cercanas
        let nextPageToken = null;
        do {
            const url =
                `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=10000&type=pharmacy&key=${apiKey}` +
                (nextPageToken ? `&pagetoken=${nextPageToken}` : "");
            console.log(`URL de solicitud: ${url}`);
            const response = await axios.get(url);

            // Filtrar solo farmacias abiertas
            const abiertas = response.data.results
                .filter((lugar) => lugar.opening_hours && lugar.opening_hours.open_now)
                .map((lugar) => ({
                    id: lugar.place_id,
                    name: lugar.name,
                    direccion: lugar.vicinity,
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
                await new Promise((resolve) => setTimeout(resolve, 4000));
            }
        } while (
            nextPageToken &&
            (!cantidadDeseada || farmaciasAbiertas.length < cantidadDeseada)
        );

        // Obtener farmacias de turno
        const { data } = await axios.get(
            "https://www.colfarmalp.org.ar/turnos-la-plata/"
        );
        const $ = cheerio.load(data);

        for (const element of $(".turnos .tr")) {
            const nombre = $(element)
                .find(".td")
                .eq(0)
                .text()
                .trim()
                .replace("Farmacia", "")
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
                // Llamada a Google Places para obtener el place_id
                const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitud},${longitud}&radius=50&keyword=${encodeURIComponent(
                    "FARMACIA " + nombre
                )}&key=${apiKey}`;
                const placeResponse = await axios.get(placeSearchUrl);
                const placeData = placeResponse.data.results[0]; // Tomar el primer resultado, que debería coincidir

                // Solo agregar si se encontró el place_id
                if (placeData) {
                    farmaciasTurno.push({
                        id: placeData.place_id,
                        name: nombre,
                        latitude: latitud,
                        longitude: longitud,
                        direccion: placeData.vicinity || "No disponible",
                        distancia: calcularDistancia(lat, lon, latitud, longitud),
                    });
                }
            }
        }

        // Consolidar ambas listas sin duplicados
        const farmaciasConsolidadas = [...farmaciasAbiertas];
        farmaciasTurno.forEach((farmaciaTurno) => {
            if (!farmaciasConsolidadas.some((f) => f.id === farmaciaTurno.id)) {
                farmaciasConsolidadas.push(farmaciaTurno);
            }
        });

        // Limitar la cantidad de resultados si se especificó
        farmaciasConsolidadas
            .sort((a, b) => a.distancia - b.distancia)
            .slice(
                0,
                cantidadDeseada || farmaciasAbiertas.length + farmaciasTurno.length
            );
        res.json(farmaciasConsolidadas);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al obtener farmacias");
    }
};

module.exports = {
    generarCsvFarmaciasDeTurno,
    obtenerFarmaciasAbiertasOTurno
};