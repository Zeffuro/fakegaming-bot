import React from "react";
import {ThemeProvider, createTheme, CssBaseline} from "@mui/material";

const theme = createTheme({
    palette: {
        mode: "dark",
        primary: {main: "#5865F2"},
        background: {default: "#18181b", paper: "#23272a"},
        text: {primary: "#fafafa"}
    },
    shape: {borderRadius: 8},
});

export default function Layout({children}: { children: React.ReactNode }) {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            {children}
        </ThemeProvider>
    );
}

