/** A pool of ElevenLabs voices (verified present in the connected account),
 * each tagged with gender + age. The persona's `suggested_voice` (e.g.
 * "male_old") narrows the pool; a seed (the person's name) then picks one
 * deterministically — so each character keeps a stable voice, but different
 * characters get varied voices. All handle Swedish + English (multilingual). */
type Gender = "male" | "female";
type Age = "old" | "adult" | "young";

interface Voice {
  id: string;
  name: string;
  gender: Gender;
  age: Age;
}

export const VOICE_POOL: Voice[] = [
  // — male, old —
  { id: "uVKHymY7OYMd6OailpG5", name: "Frederick", gender: "male", age: "old" },
  { id: "jtE6dbPUTt2kchN89Uej", name: "James", gender: "male", age: "old" },
  // — male, adult —
  { id: "1SM7GgM6IMuvQlz2BwM3", name: "Mark", gender: "male", age: "adult" },
  { id: "8P18CIVcRlwP98FOjZDm", name: "Ola", gender: "male", age: "adult" },
  { id: "wxweiHvoC2r2jFM7mS8b", name: "Haytham", gender: "male", age: "adult" },
  { id: "K5QbygPi6edprgmNThSP", name: "Edmund", gender: "male", age: "adult" },
  { id: "L0Dsvb3SLTyegXwtm47J", name: "Archer", gender: "male", age: "adult" },
  { id: "qNkzaJoHLLdpvgh5tISm", name: "Carter", gender: "male", age: "adult" },
  { id: "y6p0SvBlfEe2MH4XN7BP", name: "Hugh", gender: "male", age: "adult" },
  { id: "rrIua2BxiuHg5SA4dAwK", name: "Rob", gender: "male", age: "adult" },
  // — male, young —
  { id: "wIVKcZbkr7yia2bPb1Hm", name: "Chris", gender: "male", age: "young" },
  { id: "f2yUVfK5jdm78zlpcZ8C", name: "Albert", gender: "male", age: "young" },
  { id: "sjwRAsCdMJodJszgJ6Ks", name: "Anthony", gender: "male", age: "young" },
  // — female, old / mature —
  { id: "rCuVrCHOUMY3OwyJBJym", name: "Maryanne", gender: "female", age: "old" },
  { id: "dAlhI9qAHVIjXuVppzhW", name: "Tamsin", gender: "female", age: "old" },
  // — female, adult —
  { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", gender: "female", age: "adult" },
  { id: "h8eW5xfRUGVJrZhAFxqK", name: "Isla", gender: "female", age: "adult" },
  { id: "ys3XeJJA4ArWMhRpcX1D", name: "Jess", gender: "female", age: "adult" },
  { id: "r3SDVYUIvcC4EweQtSj0", name: "Erika", gender: "female", age: "adult" },
  { id: "t7jjqLOG6kzCY6SckkfL", name: "Tiffany", gender: "female", age: "adult" },
  // — female, young —
  { id: "xctasy8XvGp2cVO9HL9k", name: "Allison", gender: "female", age: "young" },
  { id: "wJqPPQ618aTW29mptyoc", name: "Ana-Rita", gender: "female", age: "young" },
  { id: "vY7jMt4Cbubxeq9O5Qsj", name: "Kaley", gender: "female", age: "young" },
];

export const DEFAULT_VOICE = "1SM7GgM6IMuvQlz2BwM3"; // Mark

/** Stable string hash (djb2) so a given seed always maps to the same voice. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/** Pick a voice for `suggested` (e.g. "female_young"), varied by `seed`
 * (the character's name) but stable for that character. Falls back to
 * gender-only, then the whole pool, if a bucket is empty. */
export function voiceIdFor(suggested: string, seed = ""): string {
  const [gender, age] = suggested.split("_") as [Gender, Age];

  let candidates = VOICE_POOL.filter((v) => v.gender === gender && v.age === age);
  if (candidates.length === 0) candidates = VOICE_POOL.filter((v) => v.gender === gender);
  if (candidates.length === 0) candidates = VOICE_POOL;

  return candidates[hash(seed) % candidates.length].id;
}
