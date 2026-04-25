import { PRIMARY_NAV_ITEMS, type PrimaryNavIndex } from "../app/constants";
import { type AppLanguage, t } from "../app/i18n";

type NavLabelKey =
  | "nav.agents"
  | "nav.deck"
  | "nav.activity"
  | "nav.codeIntel"
  | "nav.monitor"
  | "nav.conversations"
  | "nav.prompts"
  | "nav.settings";

const NAV_LABEL_KEYS: Record<PrimaryNavIndex, NavLabelKey> = {
  1: "nav.agents",
  2: "nav.deck",
  3: "nav.activity",
  4: "nav.codeIntel",
  5: "nav.monitor",
  6: "nav.conversations",
  7: "nav.prompts",
  8: "nav.settings",
};

type ConsolePrimaryNavProps = {
  activePrimaryNav: PrimaryNavIndex;
  language: AppLanguage;
  onPrimaryNavChange: (index: PrimaryNavIndex) => void;
};

export const ConsolePrimaryNav = ({
  activePrimaryNav,
  language,
  onPrimaryNavChange,
}: ConsolePrimaryNavProps) => (
  <nav className="console-primary-nav" aria-label="Primary navigation">
    <div className="console-primary-nav-tabs">
      {PRIMARY_NAV_ITEMS.map((item) => (
        <button
          aria-current={item.index === activePrimaryNav ? "page" : undefined}
          className="console-primary-nav-tab"
          data-active={item.index === activePrimaryNav ? "true" : "false"}
          key={item.index}
          onClick={() => {
            onPrimaryNavChange(item.index);
          }}
          type="button"
        >
          [{item.index}] {t(NAV_LABEL_KEYS[item.index], language)}
        </button>
      ))}
    </div>
    <p className="console-primary-nav-hint">
      {t("nav.pressHint", language).replace("{n}", String(PRIMARY_NAV_ITEMS.length))}
    </p>
  </nav>
);
