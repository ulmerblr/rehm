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
  backfillKeepOpen: string;
  backfillInterrupted: (left: number) => string;
  backfillContinue: string;
  translationsKept: string;

  // The toggle
  viewIn: (lang: string) => string;
  machineTranslation: string;

  // Dates
  months: string[];
  formatDate: (iso: string) => string;

  // Dream page
  analyses: string;
  analysesNote: string;
  runAnalysis: string;
  noRestatement: string;
  openNotAccepted: string;
  loopTurns: (n: number) => string;
  you: string;
  machine: string;
  addedOn: (when: string) => string;
  later: string;
  export: string;
  copyAsText: string;
  copied: string;
  deleteHeading: string;
  deleteNote: string;
  confirmDelete: string;
  deleting: string;
  analyzedTimes: (n: number) => string;
  failedRetry: string;
  retry: string;

  // Addenda
  nothingToAdd: string;
  whatCameBack: string;
  adding: string;
  addToThisDream: string;

  // Title editing
  dreamTitle: string;
  titleCantBeEmpty: string;
  saveTitle: string;
  suggestOne: string;
  addATitle: string;
  edit: string;
  thinking: string;

  // Restatement loop
  doesThisRestateIt: string;
  getARestatement: string;
  whatDidItGetWrong: string;
  objectionPlaceholder: string;
  sayWhatItGotWrong: string;
  sendTryAgain: string;
  savedAsDream: (n: number) => string;
  openTheDream: string;
  toContinueLater: string;

  // Trends
  trendsIntro: string;
  read: string;
  readDreams: string;
  readPlusAnalyses: string;
  readDreamsNote: string;
  readNoneAnalyzed: string;
  readPlusNote: (n: number) => string;
  scope: string;
  scopeAll: string;
  scopeLastN: string;
  scopeDates: string;
  oneFewer: string;
  oneMore: string;
  inThisPass: (label: string, n: number) => string;
  noneInRange: string;
  pickADate: string;
  readEverything: string;
  readingBatch: (i: number, total: number) => string;
  resume: string;
  passDidNotFinish: string;
  details: string;
  pastWeek: string;
  pastMonth: string;
  pastYear: string;
  from: string;
  to: string;
  dreamsUnit: (n: number) => string;
  dreamsPrefix: (numbers: string) => string;
  readDreamsOnly: string;
  readDreamsAndAnalyses: string;
  noCitedClaims: string;
  inSum: string;
  atNDreams: (n: number) => string;
  allDreams: string;
  lastNDreams: (n: number) => string;
  since: (d: string) => string;
  upTo: (d: string) => string;

  // Settings extras
  gettingAKey: string;
  gettingAKeyNote: string;
  invitations: string;
  invitationsNote: string;
  maintenanceNote: string;
  enterYourKey: string;
  couldNotSaveKey: string;
  replaceApiKey: string;
  labelOptional: string;
  labelPlaceholder: string;
  verifying: string;
  replaceKey: string;
  saveKey: string;
  keyNote: string;
  noKeyOnFile: string;
  keyEnds: (label: string, four: string, when: string) => string;
  notYetUsed: string;
  applyMigrations: string;
  checking: string;
  createInvitation: string;
  working: string;
  copyMessage: string;
  copyLink: string;
  couldNotCopy: string;
  unused: string;
  used: (when: string) => string;
  revoked: string;
  revoke: string;

  // First-run setup
  setupTitle: string;
  setupLead: string;
  setupPickLanguage: string;
  setupLanguageWhy: string;
  setupKey: string;
  setupKeyWhy: string;
  setupKeyHow: string;
  setupBothLanguages: string;
  setupContinue: string;
  setupContinueNoKey: string;
  setupKeySaved: string;
  needAKey: string;

  // Accounts (owner only)
  accounts: string;
  accountsNote: string;
  owner: string;
  member: string;
  dreamsCount: (n: number) => string;
  deleteAccount: string;
  deleteAccountConfirm: (email: string, dreams: number) => string;
  deleteAccountDone: (email: string) => string;
  apiKeyLabel: string;
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
  backfillKeepOpen:
    "Keep this screen open while it runs — switching apps pauses it. Anything already translated is saved.",
  backfillInterrupted: (left) =>
    left === 1
      ? "Interrupted, probably by switching away. 1 thing left — nothing already done is lost."
      : `Interrupted, probably by switching away. ${left} things left — nothing already done is lost.`,
  backfillContinue: "Continue",
  translationsKept:
    "The translations you already paid for are kept. Turning this back on later is free.",

  viewIn: (lang) => `View in ${lang}`,
  machineTranslation: "machine translation",

  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  formatDate: (iso) => {
    const raw = String(iso ?? "");
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return raw;
    const [, y, mo, d] = m;
    return `${en.months[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
  },

  analyses: "Analyses",
  analysesNote: "Generated from the transcript alone. Re-runnable — each run is kept.",
  runAnalysis: "Run analysis",
  noRestatement: "No restatement.",
  openNotAccepted: "open — not accepted",
  loopTurns: (n) => (n === 1 ? "1 loop turn" : `${n} loop turns`),
  you: "you",
  machine: "machine",
  addedOn: (when) => `added ${when}`,
  later: "later",
  export: "Export",
  copyAsText: "Copy as text",
  copied: "Copied ✓",
  deleteHeading: "Delete",
  deleteNote:
    "Permanent, and it takes the restatement, analyses, and any trend citations with it. Copy the text first if you want a record.",
  confirmDelete: "Yes, delete permanently",
  deleting: "Deleting…",
  analyzedTimes: (n) => (n > 1 ? `analyzed ×${n}` : "analyzed"),
  failedRetry: "failed",
  retry: "retry",

  nothingToAdd: "Nothing to add.",
  whatCameBack: "What came back to you…",
  adding: "Adding…",
  addToThisDream: "Add to this dream",

  dreamTitle: "Dream title",
  titleCantBeEmpty: "Title can't be empty.",
  saveTitle: "Save title",
  suggestOne: "Suggest one",
  addATitle: "Add a title",
  edit: "Edit",
  thinking: "Thinking…",

  doesThisRestateIt: "Does this restate it?",
  getARestatement: "Get a restatement",
  whatDidItGetWrong: "What did it get wrong?",
  objectionPlaceholder: "It said… but actually…",
  sayWhatItGotWrong: "Say what it got wrong.",
  sendTryAgain: "Send — try again",
  savedAsDream: (n) => `Saved as dream ${n}.`,
  openTheDream: "Open the dream",
  toContinueLater: "to continue later.",

  trendsIntro:
    "Every claim cites the dreams it rests on. Each pass is kept at the size it was drawn from, so a claim made at 9 dreams can be checked against 20.",
  read: "Read",
  readDreams: "Dreams",
  readPlusAnalyses: "+ Analyses",
  readDreamsNote: "Trends drawn from what you actually said.",
  readNoneAnalyzed: "No dreams are analyzed yet — this will read the same as Dreams.",
  readPlusNote: (n) =>
    `Also reads each dream's latest analysis (${n} analyzed). Richer, but it can find patterns in its own earlier readings.`,
  scope: "Scope",
  scopeAll: "All",
  scopeLastN: "Last N",
  scopeDates: "Dates",
  oneFewer: "One fewer dream",
  oneMore: "One more dream",
  inThisPass: (label, n) =>
    `${label} — ${n === 1 ? "1 dream" : `${n} dreams`} in this pass.`,
  noneInRange: "No dreams fall in that range.",
  pickADate: "Pick a start or end date.",
  readEverything: "Read everything. Drawing the trends together…",
  readingBatch: (i, total) => `Reading — batch ${i} of ${total}.`,
  resume: "Resume",
  passDidNotFinish: "The pass did not finish. Press Resume to continue.",
  details: "Details",
  pastWeek: "Past week",
  pastMonth: "Past month",
  pastYear: "Past year",
  from: "From",
  to: "To",
  dreamsUnit: (n) => (n === 1 ? "dream" : "dreams"),
  dreamsPrefix: (numbers) => `Dreams ${numbers}`,
  readDreamsOnly: "read dreams only",
  readDreamsAndAnalyses: "read dreams and analyses",
  noCitedClaims: "no cited claims",
  inSum: "in sum",
  atNDreams: (n) => (n === 1 ? "at 1 dream" : `at ${n} dreams`),
  allDreams: "All dreams",
  lastNDreams: (n) => (n === 1 ? "Last dream" : `Last ${n} dreams`),
  since: (d) => `Since ${d}`,
  upTo: (d) => `Up to ${d}`,

  gettingAKey: "Getting a key",
  gettingAKeyNote:
    "sign in, open API keys, create one, and put a little credit on the account under billing. Calls made here are billed there, to you.",
  invitations: "Invitations",
  invitationsNote:
    "Each invitation works once. Copy the message, send it, and the link fills the code in for them.",
  maintenanceNote:
    "Migrations apply automatically on deploy. This is a fallback for when something looks wrong.",
  enterYourKey: "Enter your API key.",
  couldNotSaveKey: "Could not save key.",
  replaceApiKey: "Replace API key",
  labelOptional: "Label (optional)",
  labelPlaceholder: "e.g. personal",
  verifying: "Verifying…",
  replaceKey: "Replace key",
  saveKey: "Save key",
  keyNote:
    "The key is verified with one call, then encrypted. It is never shown again and never leaves the server except to call Anthropic on your behalf.",
  noKeyOnFile: "No key on file. Add one to generate restatements, analyses, and trends.",
  keyEnds: (label, four, when) => `${label ? `${label} · ` : ""}ends ${four} · ${when}`,
  notYetUsed: "not yet used",
  applyMigrations: "Apply pending migrations",
  checking: "Checking…",
  createInvitation: "Create an invitation",
  working: "Working…",
  copyMessage: "Copy message",
  copyLink: "Copy link",
  couldNotCopy: "Couldn't copy — select the text and copy it by hand.",
  unused: "unused",
  used: (when) => `used ${when}`,
  revoked: "revoked",
  revoke: "revoke",

  setupTitle: "Two things before you start",
  setupLead:
    "Both take a minute and both are hard to undo later, so they come first rather than buried in settings.",
  setupPickLanguage: "Which language will you speak?",
  setupLanguageWhy:
    "This decides what gets made: what dictation listens for, and what your restatements and analyses are written in. A dream recorded in the wrong one stays that way — the transcript is kept exactly as spoken and never rewritten.",
  setupKey: "Your Anthropic API key",
  setupKeyWhy:
    "Nothing generates without one — no restatement, no analysis, no trends. A dream still saves, which is the confusing part: it looks like it worked.",
  setupKeyHow:
    "sign in, open API keys, create one, and put a little credit on the account under billing. Everything here is billed there, to you.",
  setupBothLanguages:
    "Also prepare everything in the other language, so you can hand someone your phone and flip the whole app. Roughly 10% more on your key. You can turn this on later.",
  setupContinue: "Start",
  setupContinueNoKey: "Start without a key for now",
  setupKeySaved: "Key saved and verified.",
  needAKey: "Add your API key in settings — nothing can be generated without one.",

  accounts: "Accounts",
  accountsNote:
    "Everyone with an account here. Deleting one erases its dreams, analyses and trend passes permanently, and cannot be undone.",
  owner: "owner",
  member: "member",
  dreamsCount: (n) => (n === 1 ? "1 dream" : `${n} dreams`),
  deleteAccount: "Delete",
  deleteAccountConfirm: (email, dreams) =>
    `Erase ${email} and its ${dreams === 1 ? "1 dream" : `${dreams} dreams`}? This cannot be undone.`,
  deleteAccountDone: (email) => `${email} deleted.`,
  apiKeyLabel: "API key",
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
  backfillKeepOpen:
    "Deja esta pantalla abierta mientras trabaja — si cambias de app se pausa. Lo ya traducido queda guardado.",
  backfillInterrupted: (left) =>
    left === 1
      ? "Se interrumpió, seguramente al cambiar de pantalla. Queda 1 — no se ha perdido nada de lo hecho."
      : `Se interrumpió, seguramente al cambiar de pantalla. Quedan ${left} — no se ha perdido nada de lo hecho.`,
  backfillContinue: "Continuar",
  translationsKept:
    "Las traducciones que ya pagaste se quedan. Volver a activarlo más adelante es gratis.",

  viewIn: (lang) => `Ver en ${lang}`,
  machineTranslation: "traducción automática",

  months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  formatDate: (iso) => {
    const raw = String(iso ?? "");
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return raw;
    const [, y, mo, d] = m;
    return `${Number(d)} ${es.months[Number(mo) - 1] ?? mo} ${y}`;
  },

  analyses: "Análisis",
  analysesNote:
    "Se generan solo a partir de la transcripción. Se puede repetir — cada pasada se guarda.",
  runAnalysis: "Analizar",
  noRestatement: "Sin reformulación.",
  openNotAccepted: "abierta — sin aceptar",
  loopTurns: (n) => (n === 1 ? "1 vuelta" : `${n} vueltas`),
  you: "tú",
  machine: "máquina",
  addedOn: (when) => `añadido ${when}`,
  later: "después",
  export: "Exportar",
  copyAsText: "Copiar como texto",
  copied: "Copiado ✓",
  deleteHeading: "Borrar",
  deleteNote:
    "Es permanente, y se lleva la reformulación, los análisis y cualquier cita en los patrones. Copia el texto antes si quieres guardarlo.",
  confirmDelete: "Sí, borrar para siempre",
  deleting: "Borrando…",
  analyzedTimes: (n) => (n > 1 ? `analizado ×${n}` : "analizado"),
  failedRetry: "falló",
  retry: "reintentar",

  nothingToAdd: "No hay nada que añadir.",
  whatCameBack: "Lo que te vino después…",
  adding: "Añadiendo…",
  addToThisDream: "Añadir a este sueño",

  dreamTitle: "Título del sueño",
  titleCantBeEmpty: "El título no puede estar vacío.",
  saveTitle: "Guardar el título",
  suggestOne: "Sugerir uno",
  addATitle: "Poner un título",
  edit: "Cambiar",
  thinking: "Pensando…",

  doesThisRestateIt: "¿Dice esto lo mismo?",
  getARestatement: "Pedir una reformulación",
  whatDidItGetWrong: "¿Qué entendió mal?",
  objectionPlaceholder: "Dice… pero en realidad…",
  sayWhatItGotWrong: "Di qué entendió mal.",
  sendTryAgain: "Enviar — probar otra vez",
  savedAsDream: (n) => `Guardado como sueño ${n}.`,
  openTheDream: "Abrir el sueño",
  toContinueLater: "para seguir más tarde.",

  trendsIntro:
    "Cada afirmación cita los sueños en los que se apoya. Cada pasada se guarda con el tamaño del que salió, así que algo dicho con 9 sueños se puede comprobar con 20.",
  read: "Lee",
  readDreams: "Sueños",
  readPlusAnalyses: "+ Análisis",
  readDreamsNote: "Patrones sacados de lo que dijiste de verdad.",
  readNoneAnalyzed: "Todavía no hay ningún sueño analizado — leería lo mismo que Sueños.",
  readPlusNote: (n) =>
    `Lee también el último análisis de cada sueño (${n} analizados). Da más, pero puede encontrar patrones en sus propias lecturas anteriores.`,
  scope: "Alcance",
  scopeAll: "Todo",
  scopeLastN: "Últimos N",
  scopeDates: "Fechas",
  oneFewer: "Un sueño menos",
  oneMore: "Un sueño más",
  inThisPass: (label, n) =>
    `${label} — ${n === 1 ? "1 sueño" : `${n} sueños`} en esta pasada.`,
  noneInRange: "Ningún sueño cae en ese rango.",
  pickADate: "Elige una fecha de inicio o de fin.",
  readEverything: "Todo leído. Juntando los patrones…",
  readingBatch: (i, total) => `Leyendo — grupo ${i} de ${total}.`,
  resume: "Continuar",
  passDidNotFinish: "La pasada no terminó. Pulsa Continuar para seguir.",
  details: "Detalles",
  pastWeek: "Última semana",
  pastMonth: "Último mes",
  pastYear: "Último año",
  from: "Desde",
  to: "Hasta",
  dreamsUnit: (n) => (n === 1 ? "sueño" : "sueños"),
  dreamsPrefix: (numbers) => `Sueños ${numbers}`,
  readDreamsOnly: "leyó solo los sueños",
  readDreamsAndAnalyses: "leyó los sueños y los análisis",
  noCitedClaims: "sin afirmaciones citadas",
  inSum: "en resumen",
  atNDreams: (n) => (n === 1 ? "con 1 sueño" : `con ${n} sueños`),
  allDreams: "Todos los sueños",
  lastNDreams: (n) => (n === 1 ? "Último sueño" : `Últimos ${n} sueños`),
  since: (d) => `Desde ${d}`,
  upTo: (d) => `Hasta ${d}`,

  gettingAKey: "Conseguir una clave",
  gettingAKeyNote:
    "entra, abre API keys, crea una, y pon algo de saldo en la cuenta desde billing. Lo que se genere aquí se le cobra allí, a ti.",
  invitations: "Invitaciones",
  invitationsNote:
    "Cada invitación sirve una sola vez. Copia el mensaje, mándalo, y el enlace les rellena el código.",
  maintenanceNote:
    "Las migraciones se aplican solas al desplegar. Esto es por si algo se ve mal.",
  enterYourKey: "Escribe tu clave de la API.",
  couldNotSaveKey: "No se pudo guardar la clave.",
  replaceApiKey: "Cambiar la clave de la API",
  labelOptional: "Etiqueta (opcional)",
  labelPlaceholder: "p. ej. personal",
  verifying: "Comprobando…",
  replaceKey: "Cambiar la clave",
  saveKey: "Guardar la clave",
  keyNote:
    "La clave se comprueba con una llamada y luego se cifra. No se vuelve a mostrar y no sale del servidor salvo para llamar a Anthropic en tu nombre.",
  noKeyOnFile:
    "No hay ninguna clave guardada. Añade una para generar reformulaciones, análisis y patrones.",
  keyEnds: (label, four, when) => `${label ? `${label} · ` : ""}termina en ${four} · ${when}`,
  notYetUsed: "sin usar todavía",
  applyMigrations: "Aplicar las migraciones pendientes",
  checking: "Comprobando…",
  createInvitation: "Crear una invitación",
  working: "Trabajando…",
  copyMessage: "Copiar el mensaje",
  copyLink: "Copiar el enlace",
  couldNotCopy: "No se pudo copiar — selecciona el texto y cópialo a mano.",
  unused: "sin usar",
  used: (when) => `usada ${when}`,
  revoked: "revocada",
  revoke: "revocar",

  setupTitle: "Dos cosas antes de empezar",
  setupLead:
    "Las dos llevan un minuto y las dos cuestan de deshacer después, así que van primero y no escondidas en los ajustes.",
  setupPickLanguage: "¿En qué idioma vas a hablar?",
  setupLanguageWhy:
    "Esto decide en qué se hacen las cosas: qué escucha el dictado, y en qué se escriben tus reformulaciones y análisis. Un sueño grabado en el idioma equivocado se queda así — la transcripción se guarda tal como la dijiste y no se reescribe nunca.",
  setupKey: "Tu clave de la API de Anthropic",
  setupKeyWhy:
    "Sin ella no se genera nada — ni reformulación, ni análisis, ni patrones. El sueño se guarda igual, que es lo confuso: parece que funcionó.",
  setupKeyHow:
    "entra, abre API keys, crea una, y pon algo de saldo en la cuenta desde billing. Todo lo de aquí se cobra allí, a ti.",
  setupBothLanguages:
    "Preparar también todo en el otro idioma, para poder pasarle el teléfono a alguien y cambiar la app entera. Cuesta alrededor de un 10% más en tu clave. Puedes activarlo más adelante.",
  setupContinue: "Empezar",
  setupContinueNoKey: "Empezar sin clave por ahora",
  setupKeySaved: "Clave guardada y comprobada.",
  needAKey: "Añade tu clave de la API en los ajustes — sin ella no se puede generar nada.",

  accounts: "Cuentas",
  accountsNote:
    "Todas las personas con cuenta aquí. Borrar una elimina para siempre sus sueños, sus análisis y sus patrones, y no se puede deshacer.",
  owner: "propietario",
  member: "miembro",
  dreamsCount: (n) => (n === 1 ? "1 sueño" : `${n} sueños`),
  deleteAccount: "Borrar",
  deleteAccountConfirm: (email, dreams) =>
    `¿Borrar ${email} y sus ${dreams === 1 ? "1 sueño" : `${dreams} sueños`}? No se puede deshacer.`,
  deleteAccountDone: (email) => `${email} borrada.`,
  apiKeyLabel: "Clave de la API",
};

const DICTS: Record<Lang, Dict> = { en, es };

export function dict(lang: Lang): Dict {
  return DICTS[lang] ?? en;
}
