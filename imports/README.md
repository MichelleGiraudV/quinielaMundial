# Formato de importación

Cada archivo `imports/*.json` representa una quiniela ya cerrada que luego se puede subir a `entries`.

Ejemplo mínimo:

```json
{
  "name": "Moni",
  "submitted_at": "2026-06-12T19:02:00+02:00",
  "predictions": {
    "champion": "España",
    "finalist": "Portugal",
    "topScorer": "Messi",
    "finalScoreA": "1",
    "finalScoreB": "2",
    "GA_0": { "home": "2", "away": "1" }
  }
}
```

Notas:

- `name` es obligatorio.
- `submitted_at` es opcional, pero conviene ponerlo para mantener el orden real.
- `predictions` debe seguir exactamente las claves de la app (`GA_0`, `GB_3`, `r32_0`, `qf_2`, `tp_0`, etc.).
- El script de importación actualiza una quiniela si ya existe otra con el mismo nombre.
