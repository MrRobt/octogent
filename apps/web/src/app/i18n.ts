import type { AppLanguage } from "@octogent/core";

export type { AppLanguage };

export const APP_LANGUAGE_OPTIONS = [
  { id: "en" as AppLanguage, label: "English" },
  { id: "zh-CN" as AppLanguage, label: "中文（简体）" },
] as const;

export const DEFAULT_LANGUAGE: AppLanguage = "en";

type TranslationKey =
  | "nav.agents"
  | "nav.deck"
  | "nav.activity"
  | "nav.codeIntel"
  | "nav.monitor"
  | "nav.conversations"
  | "nav.prompts"
  | "nav.settings"
  | "nav.pressHint"
  | "settings.completionSoundTitle"
  | "settings.completionSoundDesc"
  | "settings.preview"
  | "settings.savedToWorkspace"
  | "settings.visibilityTitle"
  | "settings.visibilityDesc"
  | "settings.xMonitor"
  | "settings.xMonitorDesc"
  | "settings.runtimeStrip"
  | "settings.runtimeStripDesc"
  | "settings.languageTitle"
  | "settings.languageDesc";

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    "nav.agents": "Agents",
    "nav.deck": "Deck",
    "nav.activity": "Activity",
    "nav.codeIntel": "Code Intel",
    "nav.monitor": "Monitor",
    "nav.conversations": "Conversations",
    "nav.prompts": "Prompts",
    "nav.settings": "Settings",
    "nav.pressHint": "Press 1-{n} to navigate",
    "settings.completionSoundTitle": "Tentacle completion sound",
    "settings.completionSoundDesc":
      "Play a notification when a tentacle moves from processing to idle.",
    "settings.preview": "Preview",
    "settings.savedToWorkspace": "Saved to workspace",
    "settings.visibilityTitle": "Workspace surface visibility",
    "settings.visibilityDesc": "Enable or disable monitor surfaces in the main workspace shell.",
    "settings.xMonitor": "X Monitor",
    "settings.xMonitorDesc": "Auto-fetch X feed and show monitor tab",
    "settings.runtimeStrip": "Runtime status strip",
    "settings.runtimeStripDesc": "Top console status strip metrics",
    "settings.languageTitle": "Interface language",
    "settings.languageDesc": "Select the display language for the UI and Claude agent responses.",
  },
  "zh-CN": {
    "nav.agents": "代理",
    "nav.deck": "甲板",
    "nav.activity": "活动",
    "nav.codeIntel": "代码分析",
    "nav.monitor": "监控",
    "nav.conversations": "对话",
    "nav.prompts": "提示词",
    "nav.settings": "设置",
    "nav.pressHint": "按 1-{n} 键导航",
    "settings.completionSoundTitle": "触手完成提示音",
    "settings.completionSoundDesc": "当触手从处理中变为空闲时播放通知声音。",
    "settings.preview": "预览",
    "settings.savedToWorkspace": "已保存到工作区",
    "settings.visibilityTitle": "工作区界面可见性",
    "settings.visibilityDesc": "在主工作区中启用或禁用监控界面。",
    "settings.xMonitor": "X 监控",
    "settings.xMonitorDesc": "自动获取 X 信息流并显示监控标签",
    "settings.runtimeStrip": "运行状态栏",
    "settings.runtimeStripDesc": "顶部控制台状态栏指标",
    "settings.languageTitle": "界面语言",
    "settings.languageDesc": "选择界面和 Claude 代理回复的显示语言。",
  },
};

export const t = (key: TranslationKey, language: AppLanguage): string =>
  translations[language]?.[key] ?? translations.en[key];
