import type { ComponentProps, ReactNode } from "react";

import type { PrimaryNavIndex } from "../app/constants";
import type { UseMonitorRuntimeResult } from "../app/hooks/useMonitorRuntime";
import { ActivityPrimaryView } from "./ActivityPrimaryView";
import { CanvasPrimaryView } from "./CanvasPrimaryView";
import { CodeIntelPrimaryView } from "./CodeIntelPrimaryView";
import { ConversationsPrimaryView } from "./ConversationsPrimaryView";
import { DeckPrimaryView } from "./DeckPrimaryView";
import { MonitorPrimaryView } from "./MonitorPrimaryView";
import { PromptsPrimaryView } from "./PromptsPrimaryView";
import { SettingsPrimaryView } from "./SettingsPrimaryView";

type PrimaryViewRouterProps = {
  activePrimaryNav: PrimaryNavIndex;
  deckPrimaryViewProps: ComponentProps<typeof DeckPrimaryView>;
  isMonitorVisible: boolean;
  activityPrimaryViewProps: ComponentProps<typeof ActivityPrimaryView>;
  settingsPrimaryViewProps: ComponentProps<typeof SettingsPrimaryView>;
  canvasPrimaryViewProps: ComponentProps<typeof CanvasPrimaryView>;
  monitorRuntime: Pick<
    UseMonitorRuntimeResult,
    | "monitorConfig"
    | "monitorFeed"
    | "monitorError"
    | "isRefreshingMonitorFeed"
    | "isSavingMonitorConfig"
    | "refreshMonitorFeed"
    | "patchMonitorConfig"
  >;
  conversationsEnabled: boolean;
  onConversationsSidebarContent: (content: ReactNode) => void;
  onConversationsActionPanel: (content: ReactNode) => void;
  promptsEnabled: boolean;
  promptsLanguage?: ComponentProps<typeof PromptsPrimaryView>["language"];
  onPromptsSidebarContent: (content: ReactNode) => void;
};

export const PrimaryViewRouter = ({
  activePrimaryNav,
  deckPrimaryViewProps,
  isMonitorVisible,
  activityPrimaryViewProps,
  settingsPrimaryViewProps,
  canvasPrimaryViewProps,
  monitorRuntime,
  conversationsEnabled,
  onConversationsSidebarContent,
  onConversationsActionPanel,
  promptsEnabled,
  promptsLanguage,
  onPromptsSidebarContent,
}: PrimaryViewRouterProps) => {
  if (activePrimaryNav === 2) {
    return <DeckPrimaryView {...deckPrimaryViewProps} />;
  }

  if (activePrimaryNav === 3) {
    return <ActivityPrimaryView {...activityPrimaryViewProps} />;
  }

  if (activePrimaryNav === 4) {
    return <CodeIntelPrimaryView enabled={activePrimaryNav === 4} />;
  }

  if (activePrimaryNav === 5) {
    if (isMonitorVisible) {
      return <MonitorPrimaryView monitorRuntime={monitorRuntime} />;
    }
    return (
      <section className="monitor-view" aria-label="Monitor primary view disabled">
        <section className="monitor-panel monitor-panel--configure">
          <h3>Monitor is disabled</h3>
          <p>Enable Monitor workspace view in Settings to restore this panel.</p>
        </section>
      </section>
    );
  }

  if (activePrimaryNav === 6) {
    return (
      <ConversationsPrimaryView
        enabled={conversationsEnabled}
        onSidebarContent={onConversationsSidebarContent}
        onActionPanel={onConversationsActionPanel}
      />
    );
  }

  if (activePrimaryNav === 7) {
    return (
      <PromptsPrimaryView
        enabled={promptsEnabled}
        {...(promptsLanguage !== undefined ? { language: promptsLanguage } : {})}
        onSidebarContent={onPromptsSidebarContent}
      />
    );
  }

  if (activePrimaryNav === 8) {
    return <SettingsPrimaryView {...settingsPrimaryViewProps} />;
  }

  return <CanvasPrimaryView {...canvasPrimaryViewProps} />;
};
