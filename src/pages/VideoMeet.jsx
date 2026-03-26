import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import {
  Avatar,
  Badge,
  IconButton,
  TextField,
  Button,
  Box,
  Typography,
  Paper,
  Grid,
  Tooltip,
  Divider,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import server from "../environment";

const server_url = server;
var connections = {};

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  var socketRef = useRef();
  let socketIdRef = useRef();
  let localVideoref = useRef(null);
  const videoRef = useRef([]);

  let [videoAvailable, setVideoAvailable] = useState(true);
  let [audioAvailable, setAudioAvailable] = useState(true);
  let [video, setVideo] = useState(true);
  let [audio, setAudio] = useState(true);
  let [screen, setScreen] = useState(false);
  let [showModal, setModal] = useState(false); // Default chat hidden for clean UI
  let [screenAvailable, setScreenAvailable] = useState(false);
  let [messages, setMessages] = useState([]);
  let [message, setMessage] = useState("");
  let [newMessages, setNewMessages] = useState(0);
  let [askForUsername, setAskForUsername] = useState(true);
  let [username, setUsername] = useState("");
  let [videos, setVideos] = useState([]);

  // ==========================================
  // TUMHARI ORIGINAL LOGIC (NO CHANGES HERE)
  // ==========================================

  useEffect(() => {
    getPermissions();
  }, []);

  useEffect(() => {
    if (localVideoref.current && window.localStream) {
      localVideoref.current.srcObject = window.localStream;
    }
  }, [askForUsername]);

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (stream) {
        setVideoAvailable(true);
        setAudioAvailable(true);
        window.localStream = stream;
        if (localVideoref.current) {
          localVideoref.current.srcObject = stream;
        }
      }
      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      }
    } catch (error) {
      console.log("Permission Error: ", error);
      setVideoAvailable(false);
      setAudioAvailable(false);
    }
  };

  let getMedia = () => {
    setVideo(videoAvailable);
    setAudio(audioAvailable);
    connectToSocketServer();
  };

  let connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });
    socketRef.current.on("signal", gotMessageFromServer);
    socketRef.current.on("connect", () => {
      // Yahan hum join-call karte time apna 'username' bhej rahe hain
      socketRef.current.emit("join-call", window.location.href, username);

      socketIdRef.current = socketRef.current.id;
      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
      });

      // 🟢 UPDATE: Yahan id aur clients ke sath 'userNames' bhi backend se aa raha hai
      socketRef.current.on("user-joined", (id, clients, userNames) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections,
          );

          connections[socketListId].onicecandidate = function (event) {
            if (event.candidate != null) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate }),
              );
            }
          };

          connections[socketListId].onaddstream = (event) => {
            let videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId,
            );

            if (videoExists) {
              setVideos((videos) => {
                const updatedVideos = videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video,
                );
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            } else {
              // 🟢 UPDATE: Naya video banate time hum backend se aaya hua naam yahan save kar rahe hain
              let newVideo = {
                socketId: socketListId,
                stream: event.stream,
                autoplay: true,
                playsinline: true,
                username: userNames[socketListId], // Yahan se user ka actual naam aayega
              };

              setVideos((videos) => {
                const updatedVideos = [...videos, newVideo];
                videoRef.current = updatedVideos;
                return updatedVideos;
              });
            }
          };

          if (window.localStream !== undefined && window.localStream !== null) {
            connections[socketListId].addStream(window.localStream);
          } else {
            let blackSilence = (...args) =>
              new MediaStream([black(...args), silence()]);
            window.localStream = blackSilence();
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {}

            connections[id2].createOffer().then((description) => {
              connections[id2]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id2,
                    JSON.stringify({ sdp: connections[id2].localDescription }),
                  );
                })
                .catch((e) => console.log(e));
            });
          }
        }
      });
    });
  };

  let gotMessageFromServer = (fromId, message) => {
    var signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        }),
                      );
                    })
                    .catch((e) => console.log(e));
                })
                .catch((e) => console.log(e));
            }
          })
          .catch((e) => console.log(e));
      }
      if (signal.ice) {
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.log(e));
      }
    }
  };

  let getDisplayMedia = () => {
    if (screen) {
      if (navigator.mediaDevices.getDisplayMedia) {
        navigator.mediaDevices
          .getDisplayMedia({ video: true, audio: true })
          .then(getDisplayMediaSuccess)
          .catch((e) => console.log(e));
      }
    }
  };

  let getDisplayMediaSuccess = (stream) => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      console.log(e);
    }
    window.localStream = stream;
    if (localVideoref.current) localVideoref.current.srcObject = stream;

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id].createOffer().then((description) => {
        connections[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit(
              "signal",
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          })
          .catch((e) => console.log(e));
      });
    }

    stream.getVideoTracks()[0].onended = async () => {
      setScreen(false);
      try {
        window.localStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        console.log(e);
      }
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      window.localStream = userMediaStream;
      if (localVideoref.current)
        localVideoref.current.srcObject = userMediaStream;

      for (let id in connections) {
        if (id === socketIdRef.current) continue;
        connections[id].addStream(window.localStream);
        connections[id].createOffer().then((description) => {
          connections[id]
            .setLocalDescription(description)
            .then(() => {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription }),
              );
            })
            .catch((e) => console.log(e));
        });
      }
    };
  };

  let silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  let black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  let handleVideo = () => {
    let newVideoState = !video;
    setVideo(newVideoState);
    if (window.localStream) {
      window.localStream.getVideoTracks().forEach((track) => {
        track.enabled = newVideoState;
      });
    }
  };

  let handleAudio = () => {
    let newAudioState = !audio;
    setAudio(newAudioState);
    if (window.localStream) {
      window.localStream.getAudioTracks().forEach((track) => {
        track.enabled = newAudioState;
      });
    }
  };

  useEffect(() => {
    if (screen) getDisplayMedia();
  }, [screen]);

  let handleScreen = () => setScreen(!screen);

  let handleEndCall = () => {
    try {
      window.localStream.getTracks().forEach((track) => track.stop());
    } catch (e) {}
    window.location.href = "/";
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: sender, data: data },
    ]);
    if (socketIdSender !== socketIdRef.current)
      setNewMessages((prevNewMessages) => prevNewMessages + 1);
  };

  let sendMessage = () => {
    if (message.trim() !== "") {
      socketRef.current.emit("chat-message", message, username);
      setMessage("");
    }
  };

  let connect = () => {
    if (username.trim() === "") return alert("Please enter a username!");
    setAskForUsername(false);
    if (window.localStream) {
      connectToSocketServer();
    } else {
      getMedia();
    }
  };

  // ==========================================
  // NAYA PRO INDUSTRY LEVEL UI
  // ==========================================

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "#202124",
      }}
    >
      {askForUsername ? (
        // --- LOBBY UI ---
        <Box
          sx={{
            display: "flex",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "#8a79e100",
            color: "white",
          }}
        >
          <Paper
            elevation={10}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              width: "80%",
              maxWidth: "900px",
              borderRadius: "16px",
              overflow: "hidden",
              bgcolor: "#000000ce",
              color: "#fff",
              boxShadow: "5px 5px 5px 3px #333331fc",
            }}
          >
            {/* Video Preview Section */}
            <Box
              sx={{
                flex: 1,
                p: 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRight: { md: "1px solid #444" },
              }}
            >
              <Typography variant="h5" fontWeight="bold" mb={3}>
                Ready to join?
              </Typography>
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "400px",
                  aspectRatio: "16/9",
                  bgcolor: "#000",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                <video
                  ref={localVideoref}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />

                {/* Lobby Media Toggles */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: "10px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 2,
                  }}
                >
                  <IconButton
                    onClick={handleAudio}
                    sx={{
                      bgcolor: audio ? "rgb(20, 20, 20)" : "#ea4335",
                      color: "white",
                      "&:hover": {
                        bgcolor: audio ? "rgba(37, 27, 27, 0.38)" : "#d93025",
                      },
                    }}
                  >
                    {audio ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                  <IconButton
                    onClick={handleVideo}
                    sx={{
                      bgcolor: video ? "rgba(20,20,20)" : "#ea4335",
                      color: "white",
                      "&:hover": {
                        bgcolor: video ? "rgba(37,27,27,0.38)" : "#d93025",
                      },
                    }}
                  >
                    {video ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                </Box>
              </Box>
            </Box>

            {/* Input Section */}
            <Box
              sx={{
                flex: 1,
                p: 4,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Typography variant="h4" fontWeight="bold" mb={1}>
                Join Meeting
              </Typography>
              <Typography variant="body1" color="#FAF9F6" mb={4}>
                Enter your name to connect with others.
              </Typography>

              <TextField
                label="Your Name"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{
                  mb: 3,
                  input: { color: "white" },
                  label: { color: "gray" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "#555" },
                    "&:hover fieldset": { borderColor: "#888" },
                    "&.Mui-focused fieldset": { borderColor: "#1976d2" },
                  },
                }}
              />
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={connect}
                disabled={!username.trim()}
                sx={{
                  py: 1.5,
                  fontSize: "1.1rem",
                  borderRadius: "8px",
                  textTransform: "none",
                }}
              >
                Join Now
              </Button>
            </Box>
          </Paper>
        </Box>
      ) : (
        // --- MEETING UI ---
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* Main Content Area (Videos + Chat) */}
          <Box
            sx={{
              display: "flex",
              flex: 1,
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Videos Grid */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: 2,
                p: 2,
                overflowY: "auto",
              }}
            >
              {/* Remote Videos */}
              {videos.map((vid) => (
                <Box
                  key={vid.socketId}
                  sx={{
                    position: "relative",
                    width: videos.length === 1 ? "80%" : "45%",
                    minWidth: "300px",
                    aspectRatio: "16/9",
                    bgcolor: "#3c4043",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: 3,
                  }}
                >
                  <video
                    data-socket={vid.socketId}
                    ref={(ref) => {
                      if (ref && vid.stream) ref.srcObject = vid.stream;
                    }}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {/* <Box
                    sx={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      bgcolor: "rgba(0,0,0,0.6)",
                      color: "white",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  >
                    
                  </Box> */}

                  <Box
                    sx={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      bgcolor: "rgba(0,0,0,0.6)",
                      color: "white",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  >
                    {vid.username ? vid.username : "Participant"}
                  </Box>
                </Box>
              ))}

              {/* Local Video (Floating PIP if others are present, else main grid) */}
              <Box
                sx={
                  videos.length > 0
                    ? {
                        position: "absolute",
                        bottom: 20,
                        right: showModal ? 370 : 20,
                        width: "240px",
                        aspectRatio: "16/9",
                        bgcolor: "#000",
                        borderRadius: "12px",
                        overflow: "hidden",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                        border: "2px solid #555",
                        zIndex: 10,
                        transition: "right 0.3s ease",
                      }
                    : {
                        width: "80%",
                        maxWidth: "900px",
                        aspectRatio: "16/9",
                        bgcolor: "#3c4043",
                        borderRadius: "12px",
                        overflow: "hidden",
                        boxShadow: 3,
                        position: "relative",
                      }
                }
              >
                <video
                  ref={localVideoref}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 10,
                    left: 10,
                    bgcolor: "rgba(0,0,0,0.6)",
                    color: "white",
                    px: 1.5,
                    py: 0.5,
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  You ({username})
                </Box>
              </Box>
            </Box>

            {/* Chat Sidebar */}
            {/* Chat Sidebar (Industry Standard / Zoom Style) */}
            {showModal && (
              <Box
                sx={{
                  width: "360px",
                  bgcolor: "#242424", // Deep professional dark background
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: "1px solid #3c4043",
                  boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  zIndex: 10,
                }}
              >
                {/* Header */}
                <Box
                  sx={{
                    p: "16px 20px",
                    borderBottom: "1px solid #3c4043",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    bgcolor: "#1c1f25", // Slightly darker header
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      color: "#e8eaed",
                      fontWeight: 600,
                      fontSize: "1.1rem",
                    }}
                  >
                    Meeting Chat
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setModal(false)}
                    sx={{
                      color: "#9aa0a6",
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.1)",
                        color: "#fff",
                      },
                    }}
                  >
                    ✖
                  </IconButton>
                </Box>

                {/* Messages Area */}
                <Box
                  sx={{
                    flex: 1,
                    p: "20px 20px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3, // Zoom style spacing between distinct messages
                    "&::-webkit-scrollbar": { width: "6px" },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "#555",
                      borderRadius: "10px",
                    },
                  }}
                >
                  {messages.length > 0 ? (
                    messages.map((item, index) => {
                      const isSelf = item.sender === username;
                      // Generate Avatar letter
                      const avatarLetter = item.sender
                        ? item.sender.charAt(0).toUpperCase()
                        : "U";

                      return (
                        <Box
                          key={index}
                          sx={{
                            display: "flex",
                            gap: 1.5,
                            alignItems: "flex-start",
                            width: "100%",
                          }}
                        >
                          {/* Zoom Style Avatar */}
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: "14px",
                              fontWeight: 600,
                              bgcolor: isSelf ? "#0b57d0" : "#00796b", // Blue for you, Teal for others
                              color: "#fff",
                              flexShrink: 0,
                              mt: 0.5,
                            }}
                          >
                            {avatarLetter}
                          </Avatar>

                          {/* Message Content Layout */}
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              width: "100%",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "baseline",
                                gap: 1,
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  color: isSelf ? "#8ab4f8" : "#e8eaed", // Highlight your name
                                  fontWeight: 600,
                                  fontSize: "0.85rem",
                                }}
                              >
                                {isSelf ? "You" : item.sender}
                              </Typography>
                              {/* Optional Timestamp placeholder (Industry standard) */}
                              <Typography
                                variant="caption"
                                sx={{ color: "#80868b", fontSize: "0.7rem" }}
                              >
                                {new Date().toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Typography>
                            </Box>

                            {/* Message Text (Flat, no bubble) */}
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#d2d3d7",
                                mt: 0.5,
                                wordBreak: "break-word",
                                lineHeight: 1.5,
                                fontSize: "0.9rem",
                              }}
                            >
                              {item.data}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })
                  ) : (
                    // Professional Empty State
                    <Box
                      sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: 0.7,
                      }}
                    >
                      <ChatIcon
                        sx={{ fontSize: 50, color: "#5f6368", mb: 2 }}
                      />
                      <Typography
                        variant="body1"
                        color="#e8eaed"
                        fontWeight={500}
                        mb={1}
                      >
                        No messages yet
                      </Typography>
                      <Typography
                        variant="body2"
                        color="#9aa0a6"
                        textAlign="center"
                        sx={{ px: 2 }}
                      >
                        Say hi to everyone in the meeting. Messages are deleted
                        when the call ends.
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Input Area (Zoom Desktop Style) */}
                <Box
                  sx={{
                    p: "16px 20px",
                    borderTop: "1px solid #3c4043",
                    bgcolor: "#1c1f25",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                  }}
                >
                  {/* Zoom's "To: Everyone" Label */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: "#9aa0a6",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                    }}
                  >
                    To:{" "}
                    <span
                      style={{
                        color: "#8ab4f8",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Everyone ▾
                    </span>
                  </Typography>

                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type message here..."
                      variant="outlined"
                      size="small"
                      multiline
                      maxRows={4}
                      fullWidth
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      sx={{
                        bgcolor: "#32363f", // Professional input background
                        borderRadius: "8px", // Desktop software style (not fully rounded)
                        "& .MuiOutlinedInput-root": {
                          color: "#e8eaed",
                          padding: "10px 12px",
                          "& fieldset": {
                            borderColor: "transparent",
                            transition: "0.2s",
                          },
                          "&:hover fieldset": { borderColor: "#5f6368" },
                          "&.Mui-focused fieldset": {
                            borderColor: "#8ab4f8",
                            borderWidth: "1px",
                          },
                        },
                        "& .MuiInputBase-input::placeholder": {
                          color: "#80868b",
                          opacity: 1,
                        },
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={sendMessage}
                      disabled={!message.trim()}
                      sx={{
                        bgcolor: message.trim() ? "#0b57d0" : "#32363f",
                        color: message.trim() ? "#fff !important" : "#5f6368",
                        borderRadius: "8px",
                        width: 40,
                        height: 40,
                        "&:hover": {
                          bgcolor: message.trim() ? "#0842a0" : "#32363f",
                        },
                        transition: "all 0.2s",
                      }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Box>
            )}
          </Box>

          {/* Bottom Control Bar */}
          <Box
            sx={{
              height: "80px",
              bgcolor: "#202124",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
              pb: 1,
            }}
          >
            <Tooltip
              title={audio ? "Turn off microphone" : "Turn on microphone"}
            >
              <IconButton
                onClick={handleAudio}
                sx={{
                  bgcolor: audio ? "#3c4043" : "#ea4335",
                  color: "white",
                  width: 50,
                  height: 50,
                  "&:hover": { bgcolor: audio ? "#4a4d51" : "#d93025" },
                }}
              >
                {audio ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title={video ? "Turn off camera" : "Turn on camera"}>
              <IconButton
                onClick={handleVideo}
                sx={{
                  bgcolor: video ? "#3c4043" : "#ea4335",
                  color: "white",
                  width: 50,
                  height: 50,
                  "&:hover": { bgcolor: video ? "#4a4d51" : "#d93025" },
                }}
              >
                {video ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
            </Tooltip>

            {screenAvailable && (
              <Tooltip title={screen ? "Stop presenting" : "Present now"}>
                <IconButton
                  onClick={handleScreen}
                  sx={{
                    bgcolor: screen ? "#8ab4f8" : "#3c4043",
                    color: screen ? "#202124" : "white",
                    width: 50,
                    height: 50,
                    "&:hover": { bgcolor: screen ? "#aecbfa" : "#4a4d51" },
                  }}
                >
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Chat with everyone">
              <IconButton
                onClick={() => {
                  setModal(!showModal);
                  setNewMessages(0);
                }}
                sx={{
                  bgcolor: showModal ? "#8ab4f8" : "#3c4043",
                  color: showModal ? "#202124" : "white",
                  width: 50,
                  height: 50,
                  "&:hover": { bgcolor: showModal ? "#aecbfa" : "#4a4d51" },
                }}
              >
                <Badge badgeContent={newMessages} color="error">
                  <ChatIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ borderColor: "#555", my: 2, mx: 1 }}
            />

            <Tooltip title="Leave call">
              <IconButton
                onClick={handleEndCall}
                sx={{
                  bgcolor: "#ea4335",
                  color: "white",
                  width: 60,
                  height: 40,
                  borderRadius: "20px",
                  "&:hover": { bgcolor: "#d93025" },
                }}
              >
                <CallEndIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );
}
