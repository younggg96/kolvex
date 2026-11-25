// Bundles the Chinese dictionary into the importing route and registers it before render.
// Only for routes whose server HTML is Chinese (the public reading pages); everywhere
// else Chinese loads on demand.
import zh from "./locales/zh.json";
import { registerLocale } from "./LanguageProvider";

registerLocale("zh", zh);
