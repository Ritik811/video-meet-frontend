import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { AuthContext } from "../contexts/AuthContext";
import {
  Button,
  TextField,
  Box,
  Typography,
  Container,
  AppBar,
  Toolbar,
  Stack,
  InputAdornment,
  Grid,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import VideoCallIcon from "@mui/icons-material/VideoCall";

function HomeComponent() {
  let navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const { addToUserHistory } = useContext(AuthContext);

  let handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return; // Khali code pe aage mat badho
    await addToUserHistory(meetingCode);
    navigate(`/${meetingCode}`);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* 1. PROFESSIONAL NAVBAR */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{ borderBottom: "1px solid #e0e0e0", px: 2 }}
      >
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 !important",
          }}
        >
          {/* Brand Logo & Name */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <VideoCallIcon sx={{ color: "#1a73e8", fontSize: 32 }} />
            <Typography
              variant="h6"
              sx={{
                color: "#5f6368",
                fontWeight: 500,
                letterSpacing: "-0.5px",
              }}
            >
              BUEST Video Call
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button
              color="inherit"
              startIcon={<HistoryIcon />}
              onClick={() => navigate("/history")}
              sx={{ color: "#5f6368", textTransform: "none", fontSize: "15px" }}
            >
              History
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={
                <InfoOutlinedIcon sx={{ fontSize: "1.2rem !important" }} />
              }
              onClick={() => {
                navigate("/about");
              }}
              sx={{ textTransform: "none", borderRadius: "8px" }}
            >
              About
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              onClick={() => {
                localStorage.removeItem("token");
                navigate("/auth");
              }}
              sx={{ textTransform: "none", borderRadius: "8px" }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* 2. HERO SECTION */}
      <Container
        maxWidth="lg"
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          mt: { xs: 4, md: 0 },
        }}
      >
        <Grid container spacing={6} alignItems="center">
          {/* Left Panel - Text & Inputs */}
          <Grid item xs={12} md={6}>
            <Box sx={{ maxWidth: "500px" }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 400,
                  color: "#202124",
                  mb: 2,
                  fontSize: { xs: "2.5rem", md: "3rem" },
                  lineHeight: 1.2,
                }}
              >
                Premium video meetings.
                <br />
                Now free for everyone.
              </Typography>

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 400,
                  color: "#5f6368",
                  mb: 4,
                  fontSize: "1.1rem",
                  lineHeight: 1.5,
                }}
              >
                Providing quality video calls just like quality education.
                Connect, collaborate, and celebrate from anywhere.
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems="center"
              >
                <TextField
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  placeholder="Enter meeting code"
                  variant="outlined"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <KeyboardIcon sx={{ color: "#5f6368" }} />
                      </InputAdornment>
                    ),
                    sx: { borderRadius: "8px", backgroundColor: "#fff" },
                  }}
                />
                <Button
                  onClick={handleJoinVideoCall}
                  variant="contained"
                  disabled={!meetingCode.trim()}
                  sx={{
                    height: "56px", // Matches TextField height
                    px: 4,
                    borderRadius: "8px",
                    backgroundColor: "#1a73e8",
                    textTransform: "none",
                    fontSize: "16px",
                    fontWeight: 500,
                    boxShadow: "none",
                    "&:hover": {
                      backgroundColor: "#1557b0",
                      boxShadow:
                        "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)",
                    },
                  }}
                >
                  Join
                </Button>
              </Stack>

              <Box sx={{ mt: 3, display: "flex", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  Learn more about{" "}
                  {/* YAHAN UPDATE KIYA HAI: 'a' tag hata kar span lagaya taaki react-router se smoothly navigate ho */}
                  <span
                    onClick={() => navigate("/about")}
                    style={{
                      color: "#1a73e8",
                      textDecoration: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    BUEST Video Call
                  </span>
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Right Panel - Image/Illustration */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <Box
              component="img"
              src="/logo3.png"
              alt="Video Call Illustration"
              sx={{
                width: "100%",
                maxWidth: "500px",
                height: "auto",
                borderRadius: "16px",
                boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.08)",
              }}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default withAuth(HomeComponent);
