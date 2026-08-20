import React from "react";
import CommandToggle from "./CommandToggle";
import { getLocalizedBotCommand, type BotCommand } from "@/lib/commands";
import { useDashboardI18n } from "@/components/i18n/DashboardI18nProvider";

interface CommandListProps {
  commands: ReadonlyArray<BotCommand>;
  disabledCommands: string[];
  disabledModules: string[];
  onToggle: (commandName: string, enabled: boolean) => void;
  loadingCommand?: string;
}

const CommandList: React.FC<CommandListProps> = ({ commands, disabledCommands, disabledModules, onToggle, loadingCommand }) => {
  const { locale } = useDashboardI18n();

  return (
    <div>
      {commands.map(cmd => {
        const moduleName = cmd.module ?? null;
        const moduleDisabled = moduleName ? disabledModules.includes(moduleName) : false;
        const commandDisabled = disabledCommands.includes(cmd.name);
        const effectiveDisabled = moduleDisabled || commandDisabled;
        const localized = getLocalizedBotCommand(cmd, locale);
        return (
          <CommandToggle
            key={cmd.name}
            name={cmd.name}
            displayName={localized.name}
            description={localized.description}
            disabled={effectiveDisabled}
            interactiveDisabled={moduleDisabled}
            onToggle={enabled => onToggle(cmd.name, enabled)}
            loading={loadingCommand === cmd.name}
          />
        );
      })}
    </div>
  );
};

export default CommandList;
