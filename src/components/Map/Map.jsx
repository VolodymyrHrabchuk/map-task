import React, { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken =
  "pk.eyJ1Ijoic2FyYXBhdWxzb24iLCJhIjoiY2xwYTVnMmoxMDRxNDJrcXRhaG51bHc0NyJ9.aB6Ab8fTon_gxWxAgWQCjw";

const MapWithRoute = () => {
  const [location, setLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [nearestToNYC, setNearestToNYC] = useState("");
  
  const mapContainer = useRef(null);
  const map = useRef(null);


  useEffect(() => {
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-74.5, 40],
      zoom: 4,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current.remove(); // Cleanup map on unmount
    };
  }, []);

  const geocode = (city) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      city
    )}.json?access_token=${mapboxgl.accessToken}`;

    return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Geocoding failed");
        }
        return response.json();
      })
      .then((data) => {
        if (data.features && data.features.length > 0) {
          return data.features[0].center;
        } else {
          throw new Error("City not found");
        }
      });
  };

  const calculateAndDisplayRoute = (locationCoords, destinationCoords) => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${locationCoords.join(
      ","
    )};${destinationCoords.join(",")}?geometries=geojson&access_token=${
      mapboxgl.accessToken
    }`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Route calculation failed");
        }
        return response.json();
      })
      .then((data) => {
        const route = data.routes[0].geometry.coordinates;
        const geojson = {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route,
          },
        };

        // Remove existing route layer and source if they exist
        if (map.current.getSource("route")) {
          map.current.removeLayer("route");
          map.current.removeSource("route");
        }

        map.current.addSource("route", {
          type: "geojson",
          data: geojson,
        });

        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#888",
            "line-width": 8,
          },
        });


        // Fit map to the bounds of the route
        const bounds = new mapboxgl.LngLatBounds(locationCoords, locationCoords);
        bounds.extend(destinationCoords);
        map.current.fitBounds(bounds, { padding: 50 });

        // Set distance in kilometers
        setDistance(data.routes[0].distance / 1000);

        // Set duration in hours and minutes
        const durationSeconds = data.routes[0].duration;
        const hours = Math.floor(durationSeconds / 3600);
        const minutes = Math.round((durationSeconds % 3600) / 60);
        setDuration({ hours, minutes });

        // Calculate proximity to NYC
        const nycCoords = [-74.006, 40.7128]; // Coordinates of New York City
        const locationDistance = calculateDistance(locationCoords, nycCoords);
        const destinationDistance = calculateDistance(
          destinationCoords,
          nycCoords
        );

        if (locationDistance < destinationDistance) {
          setNearestToNYC(`${location} is nearer to New York City`);
        } else {
          setNearestToNYC(`${destination} is nearer to New York City`);
        }
      })
      .catch((error) => {
        console.error("Error fetching or displaying route:", error);
        alert("Error fetching or displaying route: " + error.message);
      });
  };

  const calculateDistance = (coord1, coord2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const lat1 = coord1[1];
    const lon1 = coord1[0];
    const lat2 = coord2[1];
    const lon2 = coord2[0];

    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    return distance;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  const handleRoutePlan = () => {
    geocode(location)
      .then((locationCoords) => {
        geocode(destination)
          .then((destinationCoords) => {
            calculateAndDisplayRoute(locationCoords, destinationCoords);
          })
          .catch((error) => {
            alert("Error finding destination: " + error.message);
          });
      })
      .catch((error) => {
        alert("Error finding location: " + error.message);
      });
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Location (City)"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <input
        type="text"
        placeholder="Destination (City)"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />
      <button onClick={handleRoutePlan}>Plan Route</button>
      {distance !== null && duration !== null && (
        <p>
          Distance: {distance.toFixed(1)} km | Duration: {duration.hours} hours{" "}
          {duration.minutes} minutes
        </p>
      )}
      {nearestToNYC && <p>{nearestToNYC}</p>}
      <div
        ref={mapContainer}
        id="map"
        style={{ height: "600px", width: "100%", border: "1px solid black" }}
      />
    </div>
  );
};

export default MapWithRoute;
