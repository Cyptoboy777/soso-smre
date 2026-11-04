export const LOCALES = ["en", "es", "pt", "zh", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  pt: "PT",
  zh: "ZH",
  fr: "FR",
};

type Dict = {
  navDesk: string;
  navStart: string;
  navStats: string;
  navTrack: string;
  navJudge: string;
  badgeWave: string;
  footerLine: string;
  footerRisk: string;
  startTitle: string;
  startLead: string;
  stepConnect: string;
  stepConnectBody: string;
  stepApprove: string;
  stepApproveBody: string;
  stepTrade: string;
  stepTradeBody: string;
  perpsFirst: string;
  realFunds: string;
  statsTitle: string;
  statsLead: string;
  statsEmpty: string;
  statsUsers: string;
  statsFees: string;
  statsFills: string;
  statsVolume: string;
  statsLocal: string;
  shareTitle: string;
  shareCopy: string;
  shareCopied: string;
  onboardingCta: string;
};

export const MESSAGES: Record<Locale, Dict> = {
  en: {
    navDesk: "Desk",
    navStart: "Start",
    navStats: "Stats",
    navTrack: "Track record",
    navJudge: "Judge path",
    badgeWave: "SoSoValue · SoDEX",
    footerLine: "FlowSentinel",
    footerRisk:
      "Not financial advice. Practice mode by default; real trades only after you confirm.",
    startTitle: "Start in three signatures",
    startLead:
      "Connect your wallet, approve a max builder fee with a clear disclosure, then confirm a guided first trade on testnet. No custody. No bots inventing volume.",
    stepConnect: "1. Connect wallet",
    stepConnectBody:
      "We only read your address and SoDEX account id. Keys stay in your wallet.",
    stepApprove: "2. Approve builder fee",
    stepApproveBody:
      "One master-wallet signature sets a max fee for FlowSentinel. You can revoke later with your SoDEX account.",
    stepTrade: "3. Guided first trade",
    stepTradeBody:
      "Prefill from the AI desk or Day Trader Desk, tick both confirms, then sign the order. Size is capped.",
    perpsFirst:
      "Perps-first tip: builder fees can apply on both sides of perps. Spot buys pay no builder fee.",
    realFunds:
      "Mainnet means real funds. Live trading stays off until it is turned on.",
    statsTitle: "Builder revenue",
    statsLead:
      "Live builder fee numbers from SoDEX. Empty means no activity yet.",
    statsEmpty: "No protocol fee activity yet.",
    statsUsers: "Users",
    statsFees: "Builder fees",
    statsFills: "Fills",
    statsVolume: "Notional",
    statsLocal: "This deploy (relayed confirms only)",
    shareTitle: "Share this idea",
    shareCopy: "Copy link",
    shareCopied: "Copied",
    onboardingCta: "Open the desk",
  },
  es: {
    navDesk: "Mesa",
    navStart: "Inicio",
    navStats: "Stats",
    navTrack: "Historial",
    navJudge: "Ruta juez",
    badgeWave: "SoSoValue · SoDEX",
    footerLine: "FlowSentinel",
    footerRisk:
      "No es consejo financiero. Modo practica por defecto; operaciones reales solo despues de confirmar.",
    startTitle: "Empieza en tres firmas",
    startLead:
      "Conecta la wallet, aprueba una tarifa maxima de builder con divulgacion clara, luego confirma tu primer trade en testnet. Sin custodia.",
    stepConnect: "1. Conectar wallet",
    stepConnectBody:
      "Solo leemos tu direccion y el account id de SoDEX. Las claves quedan en tu wallet.",
    stepApprove: "2. Aprobar fee de builder",
    stepApproveBody:
      "Una firma con la master wallet fija el maximo para FlowSentinel. Puedes revocar con your SoDEX account.",
    stepTrade: "3. Primer trade guiado",
    stepTradeBody:
      "Rellena desde el desk de IA, marca ambos confirms y firma. El tamano esta limitado.",
    perpsFirst:
      "Tip perps: el fee de builder puede aplicar en ambos lados. En spot, las compras no pagan fee de builder.",
    realFunds:
      "Mainnet usa fondos reales. El trading en vivo sigue desactivado hasta un OK explicito.",
    statsTitle: "Ingresos de builder",
    statsLead:
      "Numeros en vivo de los endpoints publicos de SoDEX para FlowSentinel. Vacio significa sin actividad aun.",
    statsEmpty: "Aun no hay actividad de fees en el protocolo.",
    statsUsers: "Usuarios",
    statsFees: "Fees de builder",
    statsFills: "Fills",
    statsVolume: "Nocional",
    statsLocal: "Este deploy (solo confirms relayed)",
    shareTitle: "Comparte esta idea",
    shareCopy: "Copiar enlace",
    shareCopied: "Copiado",
    onboardingCta: "Abrir el desk",
  },
  pt: {
    navDesk: "Mesa",
    navStart: "Comecar",
    navStats: "Stats",
    navTrack: "Historico",
    navJudge: "Rota juiz",
    badgeWave: "SoSoValue · SoDEX",
    footerLine: "FlowSentinel",
    footerRisk:
      "Nao e aconselhamento financeiro. Modo pratica por padrao; operacoes reais so depois de confirmar.",
    startTitle: "Comece em tres assinaturas",
    startLead:
      "Conecte a wallet, aprove uma taxa maxima de builder com divulgacao clara e confirme o primeiro trade na testnet. Sem custodia.",
    stepConnect: "1. Conectar wallet",
    stepConnectBody:
      "Lemos so o endereco e o account id SoDEX. As chaves ficam na sua wallet.",
    stepApprove: "2. Aprovar fee do builder",
    stepApproveBody:
      "Uma assinatura da master wallet define o maximo para FlowSentinel. Voce pode revogar com your SoDEX account.",
    stepTrade: "3. Primeiro trade guiado",
    stepTradeBody:
      "Preencha pelo desk de IA, marque os dois confirms e assine. O tamanho e limitado.",
    perpsFirst:
      "Dica perps: a fee do builder pode valer nos dois lados. Em spot, compras nao pagam fee de builder.",
    realFunds:
      "Mainnet usa fundos reais. O trading ao vivo fica desligado ate um OK explicito.",
    statsTitle: "Receita do builder",
    statsLead:
      "Numeros ao vivo dos endpoints publicos SoDEX para FlowSentinel. Vazio significa sem atividade ainda.",
    statsEmpty: "Ainda nao ha atividade de fees no protocolo.",
    statsUsers: "Usuarios",
    statsFees: "Fees do builder",
    statsFills: "Fills",
    statsVolume: "Nocional",
    statsLocal: "Este deploy (apenas confirms relayed)",
    shareTitle: "Compartilhar ideia",
    shareCopy: "Copiar link",
    shareCopied: "Copiado",
    onboardingCta: "Abrir o desk",
  },
  zh: {
    navDesk: "交易台",
    navStart: "开始",
    navStats: "数据",
    navTrack: "战绩",
    navJudge: "评审路径",
    badgeWave: "SoSoValue · SoDEX",
    footerLine: "FlowSentinel",
    footerRisk: "非投资建议。默认练习模式；实盘交易仅在你确认后进行。",
    startTitle: "三步签名上手",
    startLead:
      "连接钱包，在清晰披露后批准最高 builder 费用，再确认一笔测试网引导交易。不托管资金。",
    stepConnect: "1. 连接钱包",
    stepConnectBody: "只读取地址与 SoDEX 账户 ID。私钥留在你的钱包。",
    stepApprove: "2. 批准 builder 费用",
    stepApproveBody:
      "主钱包一次签名，为 FlowSentinel 设定最高费用。可用 your SoDEX account 撤销。",
    stepTrade: "3. 引导首笔交易",
    stepTradeBody: "从 AI 交易台预填，勾选两项确认后签名。单笔规模有上限。",
    perpsFirst:
      "合约优先：builder 费用可在合约买卖双边收取。现货买入不收 builder 费。",
    realFunds: "主网使用真实资金。在明确开启前，实盘交易保持关闭。",
    statsTitle: "Builder 收入",
    statsLead:
      "来自 SoDEX 公开 builder 费用接口、FlowSentinel 的实时数据。空表示尚无活动。",
    statsEmpty: "协议侧尚无费用活动。",
    statsUsers: "用户",
    statsFees: "Builder 费用",
    statsFills: "成交",
    statsVolume: "名义金额",
    statsLocal: "本部署（仅已中继确认）",
    shareTitle: "分享这个想法",
    shareCopy: "复制链接",
    shareCopied: "已复制",
    onboardingCta: "打开交易台",
  },
  fr: {
    navDesk: "Desk",
    navStart: "Demarrer",
    navStats: "Stats",
    navTrack: "Historique",
    navJudge: "Parcours juge",
    badgeWave: "SoSoValue · SoDEX",
    footerLine: "FlowSentinel",
    footerRisk:
      "Pas un conseil financier. Mode pratique par defaut; trades reels seulement apres confirmation.",
    startTitle: "Demarrez en trois signatures",
    startLead:
      "Connectez le wallet, approuvez un frais builder max avec divulgation claire, puis confirmez un premier trade guide sur testnet. Sans custodie.",
    stepConnect: "1. Connecter le wallet",
    stepConnectBody:
      "Nous lisons seulement l'adresse et l'account id SoDEX. Les cles restent dans votre wallet.",
    stepApprove: "2. Approuver le frais builder",
    stepApproveBody:
      "Une signature master wallet fixe le plafond pour FlowSentinel. Revoquez plus tard avec your SoDEX account.",
    stepTrade: "3. Premier trade guide",
    stepTradeBody:
      "Prefill depuis le desk IA, cochez les deux confirms, puis signez. La taille est plafonnee.",
    perpsFirst:
      "Astuce perps: le frais builder peut s'appliquer des deux cotes. Sur le spot, les achats ne paient pas de frais builder.",
    realFunds:
      "Le trading live utilise de vrais fonds et reste desactive jusqu'a un OK explicite.",
    statsTitle: "Revenus builder",
    statsLead:
      "Chiffres live des endpoints publics SoDEX pour FlowSentinel. Vide signifie aucune activite pour l'instant.",
    statsEmpty: "Pas encore d'activite de frais cote protocole.",
    statsUsers: "Utilisateurs",
    statsFees: "Frais builder",
    statsFills: "Fills",
    statsVolume: "Notionnel",
    statsLocal: "Ce deploy (confirms relayes seulement)",
    shareTitle: "Partager cette idee",
    shareCopy: "Copier le lien",
    shareCopied: "Copie",
    onboardingCta: "Ouvrir le desk",
  },
};

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}
