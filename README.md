# Quiniela Mundial 2026

App React + Vite para una quiniela pública del Mundial 2026, desplegable en Vercel y conectada a Supabase.

## Qué hace

- Cualquier persona puede ver la quiniela, enviar su predicción y consultar la tabla.
- Los resultados oficiales y el borrado de quinielas pasan por funciones API en Vercel.
- El panel de control queda público y usa la `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- Si faltan credenciales, la app entra en modo demo y guarda todo en `localStorage`.

## Stack

- `Vite + React`
- `Supabase` para lectura pública y tiempo real
- `Vercel Functions` para escrituras sensibles

## Variables de entorno

En local, crea `.env` usando `.env.example`.

Variables públicas del frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

Variables privadas del servidor:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`VITE_SUPABASE_URL` y `SUPABASE_URL` deben ser la URL base del proyecto, por ejemplo `https://tu-proyecto.supabase.co`, no la URL con `/rest/v1`.

## Configurar Supabase

1. Abre el editor SQL de Supabase.
2. Ejecuta el archivo [supabase_setup.sql](/Users/michelle.giraud/Github/quinielaMundial/supabase_setup.sql).
3. Comprueba que `entries` y `results` quedaron dentro de la publicación `supabase_realtime`.

Ese SQL deja lectura pública, pero las escrituras importantes se hacen por API usando la service role key en Vercel.

## Ejecutar en local

```bash
npm install
npm run dev
```

`npm run dev` levanta el frontend de Vite. Si quieres probar también las rutas `api/` en local, usa:

```bash
npx vercel dev
```

## Importar quinielas antiguas

1. Guarda cada jugador como un archivo JSON dentro de [imports/README.md](/Users/michelle.giraud/Github/quinielaMundial/imports/README.md).
2. Prueba primero el lote sin escribir:

```bash
npm run import:entries -- --dry-run
```

3. Si todo está bien, súbelas a `entries`:

```bash
npm run import:entries
```

También puedes importar solo un archivo:

```bash
npm run import:entries -- --file imports/moni.json
```

En cuanto una quiniela esté dentro de `entries`, aparecerá en `Quinielas Recibidas` y empezará a sumar puntos automáticamente cuando guardes resultados en `results`.

## Desplegar en Vercel

1. Sube este repo a GitHub.
2. Importa el repo en Vercel.
3. En `Project Settings > Environment Variables`, añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Lanza el deploy.

## Endpoints usados

- `POST /api/entries`
- `PUT /api/admin/results`
- `POST /api/admin/entry-delete`

## Notas prácticas

- El nombre del participante funciona como identificador visible.
- La edición de una quiniela queda ligada al navegador desde el que se creó.
- Si una quiniela vieja no tiene token interno de edición, se puede borrar desde admin y volver a crear.
- Cualquier visitante puede entrar al panel de control y modificar resultados o borrar quinielas.
