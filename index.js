const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

app.get('/farmacias-cercanas', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    const apiKey = 'AIzaSyAhF_BSG-vy6lkSGWHKFxBPBQpol2SNlwA';

    const resultados = [];
    let nextPageToken = null;

    do {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=5000&type=pharmacy&key=${apiKey}` + (nextPageToken ? `&pagetoken=${nextPageToken}` : '');
      console.log(url)
      const response = await axios.get(url);

      const farmacias = response.data.results.map((lugar) => ({
        id: lugar.place_id,
        nombre: lugar.name,
        direccion: lugar.vicinity,
        latitude: lugar.geometry.location.lat,
        longitude: lugar.geometry.location.lng,
      }));

      resultados.push(...farmacias);

      nextPageToken = response.data.next_page_token;

      // Espera antes de hacer la siguiente solicitud para dar tiempo al `next_page_token` de activarse.
      if (nextPageToken) await new Promise(resolve => setTimeout(resolve, 2000));

    } while (nextPageToken);
    console.log(resultados);
    res.json(resultados); // Devolver todas las farmacias acumuladas al cliente
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al obtener farmacias cercanas');
  }
});

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
