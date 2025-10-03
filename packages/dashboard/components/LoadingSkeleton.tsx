import React from "react";
import {
  Box,
  CircularProgress,
  Skeleton,
  Typography
} from "@mui/material";

interface LoadingSkeletonProps {
  variant?: "page" | "content";
}

export default function LoadingSkeleton({ variant = "page" }: LoadingSkeletonProps) {
  if (variant === "content") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={40} sx={{ mb: 2, color: "primary.light" }} />
          <Typography variant="body2" sx={{ color: "grey.400" }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* Dark Mode Loading skeleton */}
      <Skeleton variant="text" width="40%" height={48} sx={{ mb: 2, bgcolor: "grey.700" }} />
      <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4, bgcolor: "grey.700" }} />

      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={40} sx={{ mb: 2, color: "primary.light" }} />
          <Typography variant="body2" sx={{ color: "grey.400" }}>
            Loading...
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
