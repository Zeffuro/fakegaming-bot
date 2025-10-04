import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

interface FullscreenLoaderProps {
    open?: boolean;
}

const FullscreenLoader: React.FC<FullscreenLoaderProps> = ({ open = true }) => {
    const theme = useTheme();
    if (!open) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.background.default, 0.85),
                zIndex: 1300,
            }}
        >
            <CircularProgress size={60} />
        </Box>
    );
};

export default FullscreenLoader;
