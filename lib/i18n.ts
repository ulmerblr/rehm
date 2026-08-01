import type { Lang } from "@/lib/lang";

/**
 * Interface copy, in both languages.
 *
 * These are compiled into the app, so switching the view language costs
 * nothing and is instant. Only generated text — transcripts, analyses, trend
 * passes — needs a model, and that is paid once when the text is made.
 *
 * The Spanish here is written, not converted. This app's English has a
 * particular register: short, plain, unsentimental, sentence case, no
 * exclamation and no cheer. A literal rendering of "Talk. This is stored
 * exactly as spoken." lands as clinical in Spanish rather than plain, so the
 * lines are composed to carry the same tone rather than the same words.
 *
 * Anything that varies with a number is a function, because pluralisation and
 * word order do not survive string interpolation across the two languages.
 */
export type Dict = {
  // Navigation
  navHome: string;
  navDreams: string;
  navTrends: string;
  navSettings: string;

  // Home
  recordADream: string;
  nothingRecordedYet: string;
  dreamsRecorded: (n: number) => string;
  daysSinceLast: string;
  longestGap: string;
  days: (n: number) => string;
  undated: (n: number) => string;
  notAnalyzedCount: (n: number) => string;

  // Log
  log: string;
  showingNotAnalyzed: (n: number) => string;
  showAll: (n: number) => string;
  everythingAnalyzed: string;
  showWholeLog: string;
  nothingLoggedYet: string;
  andItWillBeFirst: string;

  // Dream
  analyze: string;
  analyzing: string;
  analyzed: string;
  notAnalyzed: string;
  asSpoken: string;
  restatement: string;
  analysis: string;
  addition: string;
  additions: string;
  iRememberedSomethingElse: string;
  rename: string;
  save: string;
  cancel: string;
  deleteDream: string;

  // Record
  talkThisIsStored: string;
  speakOrType: string;
  dateDreamt: string;
  submitForRestatement: string;
  saving: string;
  dictate: string;
  stopDictation: string;
  starting: string;
  listening: string;
  hearing: string;
  twoWaysToTalk: string;
  keyboardMicOnly: string;
  nothingRecordedError: string;

  // Trends
  trends: string;
  runATrendPass: string;
  running: string;
  noTrendsYet: string;

  // Settings
  settings: string;
  usage: string;
  inputTokens: string;
  outputTokens: string;
  usageNote: string;
  apiKey: string;
  language: string;
  account: string;
  signOut: string;
  maintenance: string;

  // Language settings
  languageSectionNote: string;
  yourLanguage: string;
  yourLanguageNote: string;
  singleLanguage: string;
  dualLanguage: string;
  dualLanguageNote: string;
  singleLanguageNote: string;
  turnOnDual: string;
  turnOffDual: string;
  backfillPrompt: (items: number, usd: string) => string;
  backfillNothing: string;
  backfillRun: string;
  backfillRunning: (done: number, total: number) => string;
  backfillDone: string;
  backfillFailed: (n: number) => string;
  translationsKept: string;

  // The toggle
  viewIn: (lang: string) => string;
  machineTranslation: string;
};

const en: Dict = {
  navHome: "Home",
  navDreams: "Dreams",
  navTrends: "Trends",
  navSettings: "Settings",

  recordADream: "Record a dream",
  nothingRecordedYet:
    "Nothing recorded yet. The first one can be a fragment — a room, a face, the one image that stayed.",
  dreamsRecorded: (n) => (n === 1 ? "dream recorded" : "dreams recorded"),
  daysSinceLast: "days since the last one",
  longestGap: "days, longest gap",
  days: (n) => (n === 1 ? "1 day" : `${n} days`),
  undated: (n) => `${n} undated`,
  notAnalyzedCount: (n) =>
    n === 1 ? "1 dream not analyzed" : `${n} dreams not analyzed`,

  log: "Log",
  showingNotAnalyzed: (n) => `showing ${n} not analyzed`,
  showAll: (n) => `show all ${n}`,
  everythingAnalyzed: "Everything is analyzed.",
  showWholeLog: "Show the whole log",
  nothingLoggedYet: "Nothing logged yet.",
  andItWillBeFirst: "and it will be the first entry.",

  analyze: "Analyze",
  analyzing: "Analyzing…",
  analyzed: "analyzed",
  notAnalyzed: "not analyzed",
  asSpoken: "As spoken",
  restatement: "Restatement",
  analysis: "Analysis",
  addition: "Addition",
  additions: "Additions",
  iRememberedSomethingElse: "I remembered something else",
  rename: "Rename",
  save: "Save",
  cancel: "Cancel",
  deleteDream: "Delete this dream",

  talkThisIsStored: "Talk. This is stored exactly as spoken.",
  speakOrType: "Speak or type the dream…",
  dateDreamt: "Date dreamt",
  submitForRestatement: "Submit — get a restatement",
  saving: "Saving…",
  dictate: "Dictate",
  stopDictation: "Stop dictation",
  starting: "Starting…",
  listening: "listening…",
  hearing: "hearing",
  twoWaysToTalk:
    "Two ways to talk this in: the button above, or tap into the box and use the microphone key on your keyboard. If one gives you trouble, try the other.",
  keyboardMicOnly:
    "To talk this in, tap into the box and use the microphone key on your keyboard.",
  nothingRecordedError: "Nothing recorded yet.",

  trends: "Trends",
  runATrendPass: "Run a trend pass",
  running: "Running…",
  noTrendsYet: "No trend passes yet.",

  settings: "Settings",
  usage: "Usage",
  inputTokens: "input tokens",
  outputTokens: "output tokens",
  usageNote:
    "Lifetime total across restatements, analyses, translations, and trend passes. This is what your key was billed — deleting a dream does not reduce it.",
  apiKey: "Anthropic API key",
  language: "Language",
  account: "Account",
  signOut: "Sign out",
  maintenance: "Maintenance",

  languageSectionNote:
    "Your language decides what gets made — what you dictate in, and what your restatements and analyses are written in. It never changes on its own.",
  yourLanguage: "Your language",
  yourLanguageNote:
    "Changing this affects dreams you record from now on. Everything already recorded stays in the language you spoke it.",
  singleLanguage: "One language",
  dualLanguage: "Both languages",
  dualLanguageNote:
    "Everything gets written in both, so you can hand someone your phone and flip the whole app to their language. Costs roughly 10% more on your key, paid once per dream.",
  singleLanguageNote:
    "Nothing is translated and there is no toggle. Choose this unless you actually share the screen with someone who reads the other language.",
  turnOnDual: "Prepare both languages",
  turnOffDual: "Go back to one language",
  backfillPrompt: (items, usd) =>
    `${items} things already recorded need translating — about ${usd}, once. After that, switching is free.`,
  backfillNothing: "Nothing recorded yet, so there is nothing to translate.",
  backfillRun: "Translate what's already here",
  backfillRunning: (done, total) => `Translating ${done} of ${total}…`,
  backfillDone: "Everything is ready in both languages.",
  backfillFailed: (n) => `${n} couldn't be translated. You can run it again.`,
  translationsKept:
    "The translations you already paid for are kept. Turning this back on later is free.",

  viewIn: (lang) => `View in ${lang}`,
  machineTranslation: "machine translation",
};

const es: Dict = {
  navHome: "Inicio",
  navDreams: "Sueños",
  navTrends: "Patrones",
  navSettings: "Ajustes",

  recordADream: "Grabar un sueño",
  nothingRecordedYet:
    "Todavía no hay nada. El primero puede ser un fragmento — un cuarto, una cara, la única imagen que quedó.",
  dreamsRecorded: (n) => (n === 1 ? "sueño registrado" : "sueños registrados"),
  daysSinceLast: "días desde el último",
  longestGap: "días, el hueco más largo",
  days: (n) => (n === 1 ? "1 día" : `${n} días`),
  undated: (n) => (n === 1 ? "1 sin fecha" : `${n} sin fecha`),
  notAnalyzedCount: (n) =>
    n === 1 ? "1 sueño sin analizar" : `${n} sueños sin analizar`,

  log: "Registro",
  showingNotAnalyzed: (n) => `mostrando ${n} sin analizar`,
  showAll: (n) => `mostrar los ${n}`,
  everythingAnalyzed: "Todo está analizado.",
  showWholeLog: "Ver el registro completo",
  nothingLoggedYet: "Todavía no hay nada registrado.",
  andItWillBeFirst: "y será la primera entrada.",

  analyze: "Analizar",
  analyzing: "Analizando…",
  analyzed: "analizado",
  notAnalyzed: "sin analizar",
  asSpoken: "Tal como se dijo",
  restatement: "Reformulación",
  analysis: "Análisis",
  addition: "Añadido",
  additions: "Añadidos",
  iRememberedSomethingElse: "Me acordé de algo más",
  rename: "Cambiar el título",
  save: "Guardar",
  cancel: "Cancelar",
  deleteDream: "Borrar este sueño",

  talkThisIsStored: "Habla. Se guarda tal como lo digas.",
  speakOrType: "Habla o escribe el sueño…",
  dateDreamt: "Fecha del sueño",
  submitForRestatement: "Enviar — recibir una reformulación",
  saving: "Guardando…",
  dictate: "Dictar",
  stopDictation: "Parar el dictado",
  starting: "Empezando…",
  listening: "escuchando…",
  hearing: "escucho",
  twoWaysToTalk:
    "Hay dos formas de dictarlo: el botón de arriba, o toca el cuadro y usa la tecla del micrófono de tu teclado. Si una te da problemas, prueba la otra.",
  keyboardMicOnly:
    "Para dictarlo, toca el cuadro y usa la tecla del micrófono de tu teclado.",
  nothingRecordedError: "Todavía no hay nada.",

  trends: "Patrones",
  runATrendPass: "Buscar patrones",
  running: "Trabajando…",
  noTrendsYet: "Todavía no se ha buscado ningún patrón.",

  settings: "Ajustes",
  usage: "Consumo",
  inputTokens: "tokens de entrada",
  outputTokens: "tokens de salida",
  usageNote:
    "Total acumulado de reformulaciones, análisis, traducciones y búsquedas de patrones. Es lo que se le cobró a tu clave — borrar un sueño no lo reduce.",
  apiKey: "Clave de la API de Anthropic",
  language: "Idioma",
  account: "Cuenta",
  signOut: "Cerrar sesión",
  maintenance: "Mantenimiento",

  languageSectionNote:
    "Tu idioma decide en qué se escriben las cosas — en qué dictas, y en qué se escriben tus reformulaciones y análisis. Nunca cambia solo.",
  yourLanguage: "Tu idioma",
  yourLanguageNote:
    "Esto afecta a los sueños que grabes de ahora en adelante. Lo ya grabado se queda en el idioma en que lo dijiste.",
  singleLanguage: "Un idioma",
  dualLanguage: "Los dos idiomas",
  dualLanguageNote:
    "Todo se escribe en los dos, así puedes pasarle el teléfono a alguien y cambiar la app entera a su idioma. Cuesta alrededor de un 10% más en tu clave, una sola vez por sueño.",
  singleLanguageNote:
    "No se traduce nada y no aparece el cambio de idioma. Elige esto salvo que de verdad compartas la pantalla con alguien que lea el otro idioma.",
  turnOnDual: "Preparar los dos idiomas",
  turnOffDual: "Volver a un solo idioma",
  backfillPrompt: (items, usd) =>
    `Hay ${items} cosas ya grabadas por traducir — unos ${usd}, una sola vez. Después, cambiar de idioma es gratis.`,
  backfillNothing: "Todavía no hay nada grabado, así que no hay nada que traducir.",
  backfillRun: "Traducir lo que ya está",
  backfillRunning: (done, total) => `Traduciendo ${done} de ${total}…`,
  backfillDone: "Todo está listo en los dos idiomas.",
  backfillFailed: (n) =>
    n === 1 ? "1 no se pudo traducir. Puedes intentarlo otra vez." : `${n} no se pudieron traducir. Puedes intentarlo otra vez.`,
  translationsKept:
    "Las traducciones que ya pagaste se quedan. Volver a activarlo más adelante es gratis.",

  viewIn: (lang) => `Ver en ${lang}`,
  machineTranslation: "traducción automática",
};

const DICTS: Record<Lang, Dict> = { en, es };

export function dict(lang: Lang): Dict {
  return DICTS[lang] ?? en;
}
