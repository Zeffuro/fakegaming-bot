"use client";

import React from "react";
import { Button, Tooltip } from "@mui/material";
import { Add } from "@mui/icons-material";
import { ghostButtonSx, primaryButtonSx } from "@/components/anime/animeTheme";
import { canSubscribe, formatStatus, getSubscribeHint } from "@/components/anime/animeUtils";
import type { AnimeSearchResult } from "@/lib/api-client";

interface AnimeSubscribeButtonProps {
  anime: AnimeSearchResult;
  channelId: string;
  saving: boolean;
  onSubscribe: (anime: AnimeSearchResult) => void | Promise<void>;
  size?: "small" | "medium" | "large";
  fullWidth?: boolean;
}

export function AnimeSubscribeButton({ anime, channelId, saving, onSubscribe, size = "small", fullWidth = false }: AnimeSubscribeButtonProps) {
  const subscribable = canSubscribe(anime);
  const missingChannel = !channelId;
  const disabled = saving || !subscribable;
  const label = saving
    ? "Saving..."
    : !subscribable
      ? formatStatus(anime.status)
      : missingChannel
        ? "Choose Channel"
        : "Subscribe";

  return (
    <Tooltip title={getSubscribeHint({ anime, channelId, saving })}>
      <span style={{ display: fullWidth ? "block" : "inline-flex", width: fullWidth ? "100%" : undefined }}>
        <Button
          fullWidth={fullWidth}
          size={size}
          variant={missingChannel ? "outlined" : "contained"}
          startIcon={<Add />}
          disabled={disabled}
          onClick={() => onSubscribe(anime)}
          sx={missingChannel ? ghostButtonSx : primaryButtonSx}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}
