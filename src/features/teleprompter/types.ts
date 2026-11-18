export type Script = {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
};

export type TeleprompterSettings = {
  fontSize: number;
  textColor: string;
  /** 0–1 opacity of the panel background. */
  backgroundOpacity: number;
  /** Line height as a multiple of the font size. */
  lineSpacing: number;
  highlightReadingLine: boolean;
};

export const DEFAULT_SETTINGS: TeleprompterSettings = {
  fontSize: 28,
  textColor: '#FFFFFF',
  backgroundOpacity: 0.6,
  lineSpacing: 1.4,
  highlightReadingLine: true,
};

/** High-contrast text colours that stay readable over a camera feed. */
export const TEXT_COLORS = ['#FFFFFF', '#FFE14D', '#7CF3FF', '#D4FF3A', '#FF9F9F'];

export const LIMITS = {
  fontSize: { min: 16, max: 64, step: 2 },
  backgroundOpacity: { min: 0, max: 1, step: 0.1 },
  lineSpacing: { min: 1, max: 2.2, step: 0.1 },
};
