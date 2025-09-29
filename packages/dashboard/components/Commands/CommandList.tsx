import React from "react";
import CommandToggle from "./CommandToggle";
import { BotCommand } from "@/lib/commands";

interface CommandListProps {
  commands: BotCommand[];
  disabledCommands: string[];
  onToggle: (commandName: string, enabled: boolean) => void;
  loadingCommand?: string;
}

const CommandList: React.FC<CommandListProps> = ({ commands, disabledCommands, onToggle, loadingCommand }) => (
  <div>
    {commands.map(cmd => (
      <CommandToggle
        key={cmd.name}
        name={cmd.name}
        description={cmd.description}
        disabled={disabledCommands.includes(cmd.name)}
        onToggle={enabled => onToggle(cmd.name, enabled)}
        loading={loadingCommand === cmd.name}
      />
    ))}
  </div>
);

export default CommandList;

