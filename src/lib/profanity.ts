// Filtro simples de palavras pesadas/ofensivas (PT-BR)
const BAD_WORDS = [
  "piroka", "pirokao", "pirokão", "pinto", "pinta", "pau", "caralho", "porra",
  "buceta", "boceta", "bucetinha", "xota", "xoxota", "xereca", "ppk",
  "cu", "cuzao", "cuzão", "cuzinho", "merda", "bosta", "fdp", "fodase",
  "fodase", "foda-se", "foda", "puta", "puto", "putinha", "putaria",
  "viado", "viadinho", "veado", "bicha", "boiola",
  "arrombado", "otario", "otário", "babaca", "imbecil", "idiota", "burro",
  "vagabunda", "vagabundo", "rapariga", "vadia", "safada", "safado",
  "nazi", "nazista", "hitler", "racista", "macaco",
  "estupro", "estuprador", "pedofilo", "pedófilo",
  "sexo", "anal", "boquete", "transar", "gozar", "tesao", "tesão",
  "negao", "negão", "preto", "macumbeiro",
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cock", "nigger", "nigga", "faggot", "retard",
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "");

export function isProfane(text: string): boolean {
  if (!text) return false;
  const norm = normalize(text);
  const words = norm.split(/\s+/).filter(Boolean);
  for (const w of words) {
    if (BAD_WORDS.includes(w)) return true;
  }
  // also check whole-string contains for compound nicknames
  const collapsed = norm.replace(/\s+/g, "");
  for (const bad of BAD_WORDS) {
    if (bad.length >= 4 && collapsed.includes(bad)) return true;
  }
  return false;
}
