const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');


const app = express();
const port = 3000;

// Endpoint para obtener detalles de una farmacia específica
app.get('/detalles-farmacia/:placeId', async (req, res) => {
    try {
      const { placeId } = req.params; // Obtener el ID del lugar desde la solicitud
      const apiKey = 'AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA'; // Reemplaza con tu clave de API
  
      // URL de la nueva API de Places para obtener los detalles de un lugar
      const url = 'https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}';
  
      // Hacer la solicitud a la API de Google Places
      const response = await axios.get(url);
  
      // Filtrar los datos relevantes y enviar los resultados al cliente
      const detalles = {
        nombre: response.data.result.name,
        direccion: response.data.result.formatted_address,
        telefono: response.data.result.formatted_phone_number || 'No disponible',
        latitude: response.data.result.geometry.location.lat,
        longitude: response.data.result.geometry.location.lng,
      };
  
      res.json(detalles); // Devolver los detalles de la farmacia al cliente
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al obtener detalles de la farmacia');
    }
  });  

app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});

app.get('/farmacias-cercanas', async (req, res) => {
  try {
    const { lat, lon, cantidad } = req.query;
    const apiKey = 'AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA';

    // Verificamos que lat y lon sean válidos
    if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
      return res.status(400).send('Coordenadas de latitud y longitud inválidas');
    }

    // Convertimos `cantidad` a número y verificamos que sea válido
    let cantidadDeseada = null;
    if (cantidad) {
      cantidadDeseada = parseInt(cantidad, 10);
      if (isNaN(cantidadDeseada) || cantidadDeseada <= 0) {
        return res.status(400).send('Cantidad inválida');
      }
    }

    const resultados = [];
    let nextPageToken = null;

    do {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=10000&type=pharmacy&key=${apiKey}` + (nextPageToken ? `&pagetoken=${nextPageToken}` : '');
      console.log(`URL de solicitud: ${url}`);
      const response = await axios.get(url);

      const farmacias = response.data.results.map((lugar) => ({
        id: lugar.place_id,
        nombre: lugar.name,
        direccion: lugar.vicinity,
        latitude: lugar.geometry.location.lat,
        longitude: lugar.geometry.location.lng,
      }));

      resultados.push(...farmacias);

      // Salir del bucle si ya hemos alcanzado la cantidad deseada
      if (cantidadDeseada && resultados.length >= cantidadDeseada) break;

      // Obtener el token de la siguiente página, si existe
      nextPageToken = response.data.next_page_token;

      // Espera antes de hacer la siguiente solicitud si hay un `next_page_token`
      if (nextPageToken) {
        console.log("Esperando para el siguiente `next_page_token`...");
        await new Promise(resolve => setTimeout(resolve, 4000));
      }

    } while (nextPageToken);

    // Si se proporcionó una cantidad, limitamos los resultados
    if (cantidadDeseada) {
      res.json(resultados.slice(0, cantidadDeseada));
    } else {
      // Devolver todos los resultados si no se especificó cantidad
      res.json(resultados);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener farmacias cercanas');
  }
});

app.get('/farmacias-de-turno', async (req, res) => {
  try {
      const { data } = await axios.get('https://www.colfarmalp.org.ar/turnos-la-plata/');
      const $ = cheerio.load(data);

      const farmacias = [];
      $('.turnos .tr').each((_, element) => {
          const nombre = $(element).find('.td').eq(0).text().trim().replace('Farmacia', '').trim();
          const mapaLink = $(element).find('a[href*="https://www.google.com/maps"]').attr('href');

          const coords = mapaLink ? mapaLink.match(/destination=([-.\d]+),([-.\d]+)/) : null;
          const latitud = coords ? coords[1] : null;
          const longitud = coords ? coords[2] : null;

          if (nombre && latitud && longitud) {
              farmacias.push({ nombre, latitud, longitud });
          }
      });

      res.json(farmacias);
  } catch (error) {
      res.status(500).json({ error: 'Error al obtener datos' });
  }
});