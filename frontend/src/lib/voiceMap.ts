/** Maps Opus's `suggested_voice` bucket to an ElevenLabs voice ID.
 * These are ElevenLabs default/premade voices — swap for your own as needed.
 * All work with a multilingual TTS model, so Swedish is fine. */
export const VOICE_MAP: Record<string, string> = {
  male_old: "VR6AewLTigWG4xSOukaG", // Arnold
  male_adult: "pNInz6obpgDQGcFmaJgB", // Adam
  male_young: "TxGEqnHWrfWFTfGW9XjX", // Josh
  female_old: "21m00Tcm4TlvDq8ikWAM", // Rachel
  female_adult: "EXAVITQu4vr4xnSDxMaL", // Bella
  female_young: "MF3mGyEYCl7XYWbV9V6O", // Elli
};

export const DEFAULT_VOICE = VOICE_MAP.male_adult;

export function voiceIdFor(suggested: string): string {
  return VOICE_MAP[suggested] ?? DEFAULT_VOICE;
}
