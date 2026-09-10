# INTERIO

AI-powered architectural platform unifying floor plan generation, personalized interior design, and existing house reconstruction.

## Features

- **CAD Floor Plans** — generate non-overlapping 2D room layouts from plot dimensions and room requirements.
- **Interior Design** — curate furniture layouts, color palettes, and lighting plans for a room and style.
- **Room Renovation** — upload a photo of an existing room and get a structural analysis and renovation design.
- **3D Studio** — view any generated design in an interactive 3D scene.
- Save and manage projects in a personal portfolio.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to your Gemini API key. Without a key, each workflow falls back to a deterministic algorithmic generator.
3. Run the app:
   `npm run dev`

The app runs on `http://localhost:3000`.
