import React from "react";
import CommandToggle from "./CommandToggle";
import { BotCommand } from "@/lib/commands";

interface CommandListProps {
  commands: ReadonlyArray<BotCommand>;
  disabledCommands: string[];
  disabledModules: string[];
  onToggle: (commandName: string, enabled: boolean) => void;
  loadingCommand?: string;
}

const CommandList: React.FC<CommandListProps> = ({ commands, disabledCommands, disabledModules, onToggle, loadingCommand }) => (
  <div>
    {commands.map(cmd => {
      const moduleName = cmd.module ?? null;
      const moduleDisabled = moduleName ? disabledModules.includes(moduleName) : false;
      const commandDisabled = disabledCommands.includes(cmd.name);
      const effectiveDisabled = moduleDisabled || commandDisabled;
      return (
        <CommandToggle
          key={cmd.name}
          name={cmd.name}
          description={cmd.description}
          disabled={effectiveDisabled}
          interactiveDisabled={moduleDisabled}
          onToggle={enabled => onToggle(cmd.name, enabled)}
          loading={loadingCommand === cmd.name}
        />
      );
    })}
  </div>
);

export default CommandList;
