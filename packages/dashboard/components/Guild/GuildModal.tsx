import React from "react";
import {Box, Typography, Button, Modal} from "@mui/material";
import GuildAvatar from "./GuildAvatar";

export default function GuildModal({guild, open, onClose}: { guild: any, open: boolean, onClose: () => void }) {
    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                bgcolor: "background.paper",
                boxShadow: 24,
                p: 4,
                borderRadius: 2,
                minWidth: 300,
                maxWidth: 400,
            }}>
                {guild && (
                    <>
                        <Box sx={{display: "flex", alignItems: "center", mb: 2}}>
                            <GuildAvatar guild={guild}/>
                            <Typography variant="h6" sx={{ml: 2}}>
                                Managing: {guild.name}
                            </Typography>
                        </Box>
                        {/* Add management UI here */}
                        <Button
                            variant="contained"
                            color="secondary"
                            onClick={onClose}
                            sx={{mt: 2}}
                        >
                            Close
                        </Button>
                    </>
                )}
            </Box>
        </Modal>
    );
}