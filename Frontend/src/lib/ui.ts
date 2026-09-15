/**
 * Shared Tailwind class strings for patterns repeated across many files
 * (buttons, chips, sidebar rows, form fields, skeletons, …). Plain composed
 * utility classes, not @apply/custom CSS — kept in one place so e.g. every
 * pill across 15 files stays in sync instead of hand-copied per file.
 *
 * The vocabulary is YouTube's: 40px circular icon buttons, fully-rounded
 * pills, 12px thumbnails, and a greyscale surface ramp that inverts with the
 * theme. Nothing here carries a shadow — the reference interface is flat.
 */

/* ------------------------------------------------------------------ buttons */

const btnBase =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 h-9 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed select-none";

/** The default action pill: secondary surface, no border. */
export const btn = `${btnBase} bg-surface-2 text-text hover:bg-surface-3 disabled:hover:bg-surface-2`;

/** Inverted — Subscribe, and any single primary action on a screen. */
export const btnPrimary = `${btnBase} bg-invert-bg text-invert-text hover:opacity-90 disabled:hover:opacity-100`;

/** An engaged toggle (liked, scoring on). Reads as "pressed", not coloured. */
export const btnOn = `${btnBase} bg-surface-3 text-text hover:bg-line-bright`;

/** 40px circular icon button — the whole top bar is built from these. */
export const iconBtn =
    "grid place-items-center w-10 h-10 shrink-0 rounded-full text-text cursor-pointer bg-transparent border-0 transition-colors duration-100 hover:bg-surface-2 active:bg-surface-3 disabled:opacity-50";

/** Same, at the 36px size the comment and rail affordances use. */
export const iconBtnSm =
    "grid place-items-center w-9 h-9 shrink-0 rounded-full text-text-dim cursor-pointer bg-transparent border-0 transition-colors duration-100 hover:bg-surface-2 hover:text-text";

/* -------------------------------------------------------------------- chips */

export const chip =
    "inline-flex items-center h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer border-0 transition-colors duration-100 bg-surface-2 text-text hover:bg-surface-3 disabled:cursor-wait";
export const chipOn =
    "inline-flex items-center h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer border-0 transition-colors duration-100 bg-invert-bg text-invert-text disabled:cursor-wait";
export const chipRow = "flex items-center gap-3 overflow-x-auto no-scrollbar py-3 -mx-1 px-1";

/* ------------------------------------------------------------------- layout */

/**
 * Shell geometry. One `data-nav` attribute on the shell drives all four
 * pieces, so the sidebar, rail, scrim and content margin can never disagree
 * about which state they're in:
 *
 *   auto    — untouched: expanded from 1280px up, hidden below it
 *   open    — user opened it: expanded, as an overlay below 1280px
 *   closed  — user collapsed it: mini-rail from 768px up, hidden below
 */
export const shell = "group min-h-full";

export const shellGuide =
    "fixed top-nav left-0 bottom-0 z-40 w-sidebar bg-bg overflow-y-auto overscroll-contain no-scrollbar " +
    "px-3 pt-3 pb-8 transition-transform duration-200 ease-out " +
    "-translate-x-full group-data-[nav=open]:translate-x-0 " +
    "xl:translate-x-0 xl:group-data-[nav=closed]:-translate-x-full xl:group-data-[nav=closed]:invisible";

export const shellRail =
    "hidden fixed top-nav left-0 bottom-0 z-30 w-rail bg-bg overflow-y-auto overscroll-contain no-scrollbar " +
    "pt-1 pb-8 " +
    "md:block xl:hidden xl:group-data-[nav=closed]:block";

export const shellScrim =
    "fixed inset-0 top-nav z-[35] bg-scrim opacity-0 pointer-events-none transition-opacity duration-200 " +
    "group-data-[nav=open]:opacity-100 group-data-[nav=open]:pointer-events-auto " +
    "xl:group-data-[nav=open]:opacity-0 xl:group-data-[nav=open]:pointer-events-none";

export const shellMain =
    "max-w-shell px-4 pt-3 pb-16 transition-[margin] duration-200 ease-out " +
    "sm:px-6 md:ml-rail xl:ml-sidebar xl:group-data-[nav=closed]:ml-rail";

/** The watch route keeps the guide as an overlay at every width, as YouTube does. */
export const shellMainWatch =
    "max-w-shell px-4 pt-3 pb-16 transition-[margin] duration-200 ease-out sm:px-6";

/* ------------------------------------------------------------------ sidebar */

export const navSection = "py-3 border-b border-line last:border-b-0";
export const navHeading = "px-3 pt-1 pb-1 text-base font-medium text-text";

export const navRow =
    "flex items-center gap-6 h-10 px-3 rounded-lg text-sm font-normal text-text cursor-pointer transition-colors duration-100 hover:bg-surface-2";
export const navRowOn = `${navRow} bg-surface-2 font-medium hover:bg-surface-3`;

export const railRow =
    "flex flex-col items-center justify-center gap-1.5 w-16 mx-auto py-4 rounded-lg text-text cursor-pointer transition-colors duration-100 hover:bg-surface-2";
export const railRowOn = `${railRow} bg-surface-2`;
export const railLabel = "text-[10px] leading-none font-normal tracking-tight";

/* -------------------------------------------------------------------- feeds */

/** A quiet secondary label — the strategy readout, "N comments", stat names. */
export const eyebrow = "text-[13px] font-normal text-text-dim";

export const feedHead = "flex items-center gap-3 flex-wrap mt-1 mb-5";

/** Section headings. YouTube's are 20px medium — no display face, no weight games. */
export const hDisplay = "font-display font-medium tracking-[-0.01em] leading-tight m-0";

export const mono = "[font-variant-numeric:tabular-nums]";

/**
 * Auto-fill rather than fixed breakpoints, because the content box width
 * depends on the sidebar state as well as the viewport — 1 column at 360px,
 * 2 at 768, 3 at 1024, 4 at 1440.
 */
export const grid =
    "grid grid-cols-[repeat(auto-fill,minmax(min(100%,268px),1fr))] gap-x-4 gap-y-10";

/* --------------------------------------------------------------------- misc */

export const panel = "max-w-[420px] mx-auto my-10 bg-surface border border-line rounded-lg p-6 sm:p-8";
export const panelWide = "max-w-[640px] mx-auto my-10 bg-surface border border-line rounded-lg p-6 sm:p-8";

export const field = "mb-4";
export const fieldLabel = "block text-xs font-medium text-text-dim mb-1.5";
export const fieldInput =
    "w-full bg-bg border border-line-bright rounded-md px-3 py-2.5 text-sm placeholder:text-text-faint focus:border-brand-blue focus:outline-none";
export const fieldTextarea = `${fieldInput} resize-y min-h-[96px]`;
export const fieldHint = "text-xs text-text-faint mt-1";

export const notice = "rounded-md px-3 py-2.5 text-[13px] mb-4 border";
export const noticeError = "bg-[rgba(255,0,0,0.08)] border-[rgba(255,0,0,0.35)] text-[#f28b82]";

export const empty = "rounded-lg bg-surface-2 px-6 py-14 text-center text-text-dim";
export const emptyH3 = "font-display text-base font-medium m-0 mb-2 text-text";
export const emptyP = "m-0 mb-5 text-sm max-w-[46ch] mx-auto";

export const skeleton =
    "bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-3)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-shimmer rounded-md";
export const skThumb = "aspect-video rounded-lg";
export const skLine = "h-3 mt-2.5";
export const skLineShort = "w-[55%]";

export const tag =
    "inline-flex items-center h-8 px-3 rounded-full text-[13px] font-medium bg-surface-2 text-text hover:bg-surface-3 transition-colors duration-100";

/** The description box, and anything else that wants YouTube's grey card. */
export const infoBox = "bg-surface-2 rounded-lg px-3 py-3 text-sm";

/* ---------------------------------------------------- recommender internals */

export const sigrow = "grid grid-cols-[106px_1fr_46px] items-center gap-3 py-1";
export const sigrowK = "text-xs text-text-dim";
export const sigbar = "h-1.5 bg-surface-3 rounded-full overflow-hidden";
export const sigbarFill = "block h-full rounded-full transition-[width] duration-[400ms] ease-in-out";
export const sigrowV = "text-xs text-right [font-variant-numeric:tabular-nums] text-text-dim";

/* --------------------------------------------------------------------- rail */

export const railList = "flex flex-col gap-2";
/** Horizontal card: 168px thumbnail, info to its right. */
export const railItem = "grid grid-cols-[168px_1fr] gap-2";

/* ------------------------------------------------------------------- studio */

export const statGrid = "grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-7";
export const stat = "bg-surface-2 rounded-lg px-4 py-3";
export const statV = "font-display text-2xl font-medium leading-tight [font-variant-numeric:tabular-nums]";

export const table = "w-full border-collapse text-[13px]";
export const tableTh = "text-xs text-text-dim font-medium px-3 py-2 border-b border-line";
export const tableTd = "px-3 py-3 border-b border-line align-middle";
export const tableTdNum = `${tableTd} [font-variant-numeric:tabular-nums] text-right`;

export const avatar = "w-9 h-9 rounded-full bg-surface-2 object-cover shrink-0";
export const avatarSm = "w-6 h-6 rounded-full bg-surface-2 object-cover shrink-0";

export const linkAccent = "text-link hover:underline";

/** Two-line ellipsis clamp — every card title in the app uses it. */
export const clamp2 = "line-clamp-2 overflow-hidden text-ellipsis";
