import i18next from "i18next";
import jaLocales from "../locales/ja.json";
import enLocales from "../locales/en.json";

export function init(lng: string) {
  return i18next
    .init({
      lng,
      debug: true,
      defaultNS: "ns",
      resources: {
        ja: {
          ns: jaLocales,
        },
        en: {
          ns: enLocales,
        },
      },
      interpolation: {
        prefix: "{",
        suffix: "}",
      },
    })
    .then();
}

export const i18n = i18next;
