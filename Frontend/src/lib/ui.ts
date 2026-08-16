/**
 * Shared Tailwind class strings for patterns repeated across many files
 * (buttons, form fields, panels, skeletons, …). Plain composed utility
 * classes, not @apply/custom CSS — kept in one place so e.g. every button
 * across 15 files stays in sync instead of hand-copied per file.
 */

const btnBase =
    "inline-flex items-center gap-[7px] rounded-md px-3.5 py-[7px] text-[13px] font-medium cursor-pointer transition-colors duration-[140ms] disabled:opacity-45 disabled:cursor-not-allowed";

export const btn = `${btnBase} bg-surface-2 border border-line hover:bg-surface-3 hover:border-line-bright disabled:hover:bg-surface-2 disabled:hover:border-line`;

export const btnPrimary = `${btnBase} bg-text border border-text text-bg font-semibold hover:bg-white hover:border-white disabled:hover:bg-text disabled:hover:border-text`;

export const btnOn = `${btnBase} bg-sig-content border border-sig-content text-[#06101f] font-semibold`;

export const eyebrow = "font-mono text-[10px] font-medium tracking-[0.14em] uppercase text-text-faint";

export const hDisplay = "font-display font-extrabold tracking-[-0.02em] leading-[1.1] m-0";

export const mono = "font-mono [font-variant-numeric:tabular-nums]";

export const feedHead = "flex items-baseline gap-3.5 mb-5 flex-wrap";

export const grid =
    "grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-x-[18px] gap-y-[26px] max-[720px]:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] max-[720px]:gap-x-3.5 max-[720px]:gap-y-5";

export const panel =
    "max-w-[420px] mx-auto my-14 bg-surface border border-line rounded-lg p-[30px] max-[720px]:my-6 max-[720px]:p-[22px]";
export const panelWide =
    "max-w-[640px] mx-auto my-14 bg-surface border border-line rounded-lg p-[30px] max-[720px]:my-6 max-[720px]:p-[22px]";

export const field = "mb-3.5";
export const fieldLabel = "block font-mono text-[10px] tracking-[0.13em] uppercase text-text-faint mb-[5px]";
export const fieldInput =
    "w-full bg-bg border border-line rounded-md px-3 py-[9px] text-[13.5px] focus:border-line-bright focus:outline-none";
export const fieldTextarea = `${fieldInput} resize-y min-h-[90px]`;
export const fieldHint = "text-[11.5px] text-text-faint mt-1";

export const notice = "rounded-md px-[13px] py-2.5 text-[13px] mb-4 border";
export const noticeError = "bg-[rgba(255,82,87,0.09)] border-[rgba(255,82,87,0.35)] text-[#ffb3b5]";

export const empty = "border border-dashed border-line-bright rounded-lg px-[30px] py-[52px] text-center text-text-dim";
export const emptyH3 = "font-display text-[17px] m-0 mb-[7px] text-text";
export const emptyP = "m-0 mb-4 text-[13.5px]";

export const skeleton =
    "bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-3)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] animate-shimmer rounded-md";
export const skThumb = "aspect-video";
export const skLine = "h-[11px] mt-[9px]";
export const skLineShort = "w-[55%]";

export const tag = "font-mono text-[11px] bg-surface-2 border border-line rounded-full px-[9px] py-0.5 text-text-dim";

export const sigrow = "grid grid-cols-[106px_1fr_46px] items-center gap-3 py-[5px]";
export const sigrowK = "font-mono text-[11px] text-text-dim";
export const sigbar = "h-[7px] bg-surface-3 rounded-[2px] overflow-hidden";
export const sigbarFill = "block h-full rounded-[2px] transition-[width] duration-[400ms] ease-in-out";
export const sigrowV = "font-mono text-[11px] text-right [font-variant-numeric:tabular-nums] text-text-dim";

export const railList = "flex flex-col gap-3";
export const railItem = "grid grid-cols-[152px_1fr] gap-[10px]";

export const statGrid = "grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-[26px]";
export const stat = "bg-surface border border-line rounded-md px-4 py-3.5";
export const statV = "font-display text-[25px] font-bold leading-[1.1] [font-variant-numeric:tabular-nums]";

export const table = "w-full border-collapse text-[13px]";
export const tableTh =
    "font-mono text-[10px] tracking-[0.12em] uppercase text-text-faint font-medium px-2.5 py-2 border-b border-line";
export const tableTd = "px-2.5 py-2.5 border-b border-line";
export const tableTdNum = `${tableTd} font-mono [font-variant-numeric:tabular-nums] text-right`;

export const avatar = "w-[30px] h-[30px] rounded-full bg-surface-3 object-cover";

export const linkAccent = "text-sig-content";
