/** A detected person, in the image's native pixel coordinates. */
export interface PersonBox {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

/** Persona returned by the backend /identify endpoint (Opus vision). */
export interface Persona {
  scene: string;
  person_name: string;
  confidence: number;
  persona_system_prompt: string;
  first_message: string;
  suggested_voice: string;
  language: string;
}
