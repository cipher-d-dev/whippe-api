/**
 * The built-in sticker pack. Original Whippie designs; the images live in each
 * app at /stickers/<id>.svg. A sticker message stores only the id.
 */
export const STICKERS = [
  'thank-you', 'well-done', 'good-morning', 'on-my-way', 'noted', 'congrats',
  'lol', 'sorry', 'welcome', 'see-you', 'yes', 'coffee',
] as const;
export type StickerId = (typeof STICKERS)[number];
