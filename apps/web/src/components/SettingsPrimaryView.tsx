import { APP_LANGUAGE_OPTIONS, type AppLanguage, t } from "../app/i18n";
import {
  TERMINAL_COMPLETION_SOUND_OPTIONS,
  type TerminalCompletionSoundId,
} from "../app/notificationSounds";
import { ActionButton } from "./ui/ActionButton";
import { SettingsToggle } from "./ui/SettingsToggle";

type SettingsPrimaryViewProps = {
  terminalCompletionSound: TerminalCompletionSoundId;
  isRuntimeStatusStripVisible: boolean;
  isMonitorVisible: boolean;
  language: AppLanguage;
  onTerminalCompletionSoundChange: (soundId: TerminalCompletionSoundId) => void;
  onPreviewTerminalCompletionSound: (soundId: TerminalCompletionSoundId) => void;
  onRuntimeStatusStripVisibilityChange: (visible: boolean) => void;
  onMonitorVisibilityChange: (visible: boolean) => void;
  onLanguageChange: (language: AppLanguage) => void;
};

export const SettingsPrimaryView = ({
  terminalCompletionSound,
  isRuntimeStatusStripVisible,
  isMonitorVisible,
  language,
  onTerminalCompletionSoundChange,
  onPreviewTerminalCompletionSound,
  onRuntimeStatusStripVisibilityChange,
  onMonitorVisibilityChange,
  onLanguageChange,
}: SettingsPrimaryViewProps) => (
  <section className="settings-view" aria-label="Settings primary view">
    <section className="settings-panel" aria-label="Language settings">
      <header className="settings-panel-header">
        <h2>{t("settings.languageTitle", language)}</h2>
        <p>{t("settings.languageDesc", language)}</p>
      </header>

      <div className="settings-sound-picker">
        {APP_LANGUAGE_OPTIONS.map((option) => (
          <button
            aria-pressed={language === option.id}
            className="settings-sound-option"
            data-active={language === option.id ? "true" : "false"}
            key={option.id}
            onClick={() => onLanguageChange(option.id)}
            type="button"
          >
            <span className="settings-sound-option-label">{option.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-panel-actions">
        <span className="settings-saved-pill">{t("settings.savedToWorkspace", language)}</span>
      </div>
    </section>

    <section className="settings-panel" aria-label="Completion notification settings">
      <header className="settings-panel-header">
        <h2>{t("settings.completionSoundTitle", language)}</h2>
        <p>{t("settings.completionSoundDesc", language)}</p>
      </header>

      <div className="settings-sound-picker">
        {TERMINAL_COMPLETION_SOUND_OPTIONS.map((option) => (
          <button
            aria-pressed={terminalCompletionSound === option.id}
            className="settings-sound-option"
            data-active={terminalCompletionSound === option.id ? "true" : "false"}
            key={option.id}
            onClick={() => {
              onTerminalCompletionSoundChange(option.id);
              onPreviewTerminalCompletionSound(option.id);
            }}
            type="button"
          >
            <span className="settings-sound-option-label">{option.label}</span>
            <span className="settings-sound-option-description">{option.description}</span>
          </button>
        ))}
      </div>

      <div className="settings-panel-actions">
        <ActionButton
          aria-label="Preview selected completion sound"
          className="settings-sound-preview"
          onClick={() => {
            onPreviewTerminalCompletionSound(terminalCompletionSound);
          }}
          size="dense"
          variant="accent"
        >
          {t("settings.preview", language)}
        </ActionButton>
        <span className="settings-saved-pill">{t("settings.savedToWorkspace", language)}</span>
      </div>
    </section>

    <section className="settings-panel" aria-label="Workspace surface visibility settings">
      <header className="settings-panel-header">
        <h2>{t("settings.visibilityTitle", language)}</h2>
        <p>{t("settings.visibilityDesc", language)}</p>
      </header>

      <div className="settings-toggle-grid">
        <SettingsToggle
          label={t("settings.xMonitor", language)}
          description={t("settings.xMonitorDesc", language)}
          ariaLabel="Enable X Monitor"
          checked={isMonitorVisible}
          onChange={onMonitorVisibilityChange}
        />
        <SettingsToggle
          label={t("settings.runtimeStrip", language)}
          description={t("settings.runtimeStripDesc", language)}
          ariaLabel="Show runtime status strip"
          checked={isRuntimeStatusStripVisible}
          onChange={onRuntimeStatusStripVisibilityChange}
        />
      </div>
    </section>
  </section>
);
