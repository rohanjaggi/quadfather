import json
import os
import re

from google import genai
from google.genai import types

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

PROMPT = """You are a precise nutrition analyst. Analyze this meal photograph and estimate its nutritional content.

Additional context from user: {description}

Respond with ONLY a raw JSON object — no markdown, no code fences, no explanation. Exactly this structure:

{{
  "food_name": "descriptive name for this meal",
  "calories": <integer>,
  "protein": <number in grams, one decimal>,
  "carbohydrates": <number in grams, one decimal>,
  "fats": <number in grams, one decimal>,
  "confidence": "high" | "medium" | "low",
  "notes": "brief note on portion assumptions"
}}

Base macros on a typical single serving unless the image or description clearly shows otherwise. Be realistic — do not underestimate."""


def analyse_meal(image_bytes: bytes, mime_type: str, description: str = "") -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=GEMINI_API_KEY)
    prompt = PROMPT.format(description=description or "No additional context provided.")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt,
        ],
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response")
    raw = response.text.strip()

    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Gemini returned unparseable response: {raw[:200]}") from e

    required = {"food_name", "calories", "protein", "carbohydrates", "fats"}
    missing = required - data.keys()
    if missing:
        raise ValueError(f"Gemini response missing fields: {missing}")

    return {
        "food_name": str(data["food_name"]),
        "calories": round(float(data["calories"])),
        "protein": round(float(data["protein"]), 1),
        "carbohydrates": round(float(data["carbohydrates"]), 1),
        "fats": round(float(data["fats"]), 1),
        "confidence": str(data.get("confidence", "medium")),
        "notes": str(data.get("notes", "")),
    }
