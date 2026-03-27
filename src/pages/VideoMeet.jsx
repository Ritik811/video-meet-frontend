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

  //   return (
  //     <Box
  //       sx={{
  //         width: "100vw",
  //         height: "100vh",
  //         overflow: "hidden",
  //         bgcolor: "#202124",
  //       }}
  //     >
  //       {askForUsername ? (
  //         // --- LOBBY UI (Responsive) ---
  //         <Box
  //           sx={{
  //             display: "flex",
  //             height: "100%",
  //             alignItems: "center",
  //             justifyContent: "center",
  //             bgcolor: "#8a79e100",
  //             color: "white",
  //             p: { xs: 2, md: 0 }, // Mobile par thoda gap
  //           }}
  //         >
  //           <Paper
  //             elevation={10}
  //             sx={{
  //               display: "flex",
  //               flexDirection: { xs: "column", md: "row" }, // Mobile pe upar neeche, desktop pe side-by-side
  //               width: { xs: "100%", sm: "90%", md: "80%" },
  //               maxWidth: "900px",
  //               maxHeight: { xs: "90vh", md: "auto" }, // Mobile pe screen se bahar na jaye
  //               borderRadius: "16px",
  //               overflowY: { xs: "auto", md: "hidden" }, // Mobile pe agar content bada ho toh scroll ho jaye
  //               bgcolor: "#000000ce",
  //               color: "#fff",
  //               boxShadow: "5px 5px 5px 3px #333331fc",
  //             }}
  //           >
  //             {/* Video Preview Section */}
  //             <Box
  //               sx={{
  //                 flex: 1,
  //                 p: { xs: 2, md: 4 },
  //                 display: "flex",
  //                 flexDirection: "column",
  //                 alignItems: "center",
  //                 justifyContent: "center",
  //                 borderRight: { md: "1px solid #444" },
  //                 borderBottom: { xs: "1px solid #444", md: "none" },
  //               }}
  //             >
  //               <Typography
  //                 variant="h5"
  //                 fontWeight="bold"
  //                 mb={3}
  //                 sx={{ fontSize: { xs: "1.2rem", md: "1.5rem" } }}
  //               >
  //                 Ready to join?
  //               </Typography>
  //               <Box
  //                 sx={{
  //                   position: "relative",
  //                   width: "100%",
  //                   maxWidth: "400px",
  //                   aspectRatio: "16/9",
  //                   bgcolor: "#000",
  //                   borderRadius: "12px",
  //                   overflow: "hidden",
  //                   boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  //                 }}
  //               >
  //                 <video
  //                   ref={localVideoref}
  //                   autoPlay
  //                   muted
  //                   playsInline
  //                   style={{ width: "100%", height: "100%", objectFit: "cover" }}
  //                 />

  //                 <Box
  //                   sx={{
  //                     position: "absolute",
  //                     bottom: "10px",
  //                     left: "50%",
  //                     transform: "translateX(-50%)",
  //                     display: "flex",
  //                     gap: 2,
  //                   }}
  //                 >
  //                   <IconButton
  //                     onClick={handleAudio}
  //                     sx={{
  //                       bgcolor: audio ? "rgb(20, 20, 20)" : "#ea4335",
  //                       color: "white",
  //                       "&:hover": {
  //                         bgcolor: audio ? "rgba(37, 27, 27, 0.38)" : "#d93025",
  //                       },
  //                     }}
  //                   >
  //                     {audio ? <MicIcon /> : <MicOffIcon />}
  //                   </IconButton>
  //                   <IconButton
  //                     onClick={handleVideo}
  //                     sx={{
  //                       bgcolor: video ? "rgba(20,20,20)" : "#ea4335",
  //                       color: "white",
  //                       "&:hover": {
  //                         bgcolor: video ? "rgba(37,27,27,0.38)" : "#d93025",
  //                       },
  //                     }}
  //                   >
  //                     {video ? <VideocamIcon /> : <VideocamOffIcon />}
  //                   </IconButton>
  //                 </Box>
  //               </Box>
  //             </Box>

  //             {/* Input Section */}
  //             <Box
  //               sx={{
  //                 flex: 1,
  //                 p: { xs: 3, md: 4 },
  //                 display: "flex",
  //                 flexDirection: "column",
  //                 justifyContent: "center",
  //               }}
  //             >
  //               <Typography
  //                 variant="h4"
  //                 fontWeight="bold"
  //                 mb={1}
  //                 sx={{ fontSize: { xs: "1.8rem", md: "2.1rem" } }}
  //               >
  //                 Join Meeting
  //               </Typography>
  //               <Typography variant="body1" color="#FAF9F6" mb={4}>
  //                 Enter your name to connect.
  //               </Typography>

  //               <TextField
  //                 label="Your Name"
  //                 variant="outlined"
  //                 fullWidth
  //                 value={username}
  //                 onChange={(e) => setUsername(e.target.value)}
  //                 sx={{
  //                   mb: 3,
  //                   input: { color: "white" },
  //                   label: { color: "gray" },
  //                   "& .MuiOutlinedInput-root": {
  //                     "& fieldset": { borderColor: "#555" },
  //                     "&:hover fieldset": { borderColor: "#888" },
  //                     "&.Mui-focused fieldset": { borderColor: "#1976d2" },
  //                   },
  //                 }}
  //               />
  //               <Button
  //                 variant="contained"
  //                 color="primary"
  //                 size="large"
  //                 onClick={connect}
  //                 disabled={!username.trim()}
  //                 sx={{
  //                   py: 1.5,
  //                   fontSize: "1.1rem",
  //                   borderRadius: "8px",
  //                   textTransform: "none",
  //                 }}
  //               >
  //                 Join Now
  //               </Button>
  //             </Box>
  //           </Paper>
  //         </Box>
  //       ) : (
  //         // --- MEETING UI (Responsive) ---
  //         <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
  //           <Box
  //             sx={{
  //               display: "flex",
  //               flexDirection: { xs: "column", md: "row" }, // Mobile pe chat neeche aa sakti hai agar jagah kam ho
  //               flex: 1,
  //               overflow: "hidden",
  //               position: "relative",
  //             }}
  //           >
  //             {/* Videos Grid */}
  //             <Box
  //               sx={{
  //                 flex: 1,
  //                 display: "flex",
  //                 flexWrap: "wrap",
  //                 justifyContent: "center",
  //                 alignItems: "center",
  //                 gap: { xs: 1, md: 2 },
  //                 p: { xs: 1, md: 2 },
  //                 overflowY: "auto",
  //               }}
  //             >
  //               {/* Remote Videos */}
  //               {videos.map((vid) => (
  //                 <Box
  //                   key={vid.socketId}
  //                   sx={{
  //                     position: "relative",
  //                     width:
  //                       videos.length === 1
  //                         ? { xs: "100%", md: "80%" }
  //                         : { xs: "100%", sm: "45%" },
  //                     minWidth: { xs: "100%", sm: "300px" },
  //                     aspectRatio: "16/9",
  //                     bgcolor: "#3c4043",
  //                     borderRadius: "12px",
  //                     overflow: "hidden",
  //                     boxShadow: 3,
  //                   }}
  //                 >
  //                   <video
  //                     data-socket={vid.socketId}
  //                     ref={(ref) => {
  //                       if (ref && vid.stream) ref.srcObject = vid.stream;
  //                     }}
  //                     autoPlay
  //                     playsInline
  //                     style={{
  //                       width: "100%",
  //                       height: "100%",
  //                       objectFit: "cover",
  //                     }}
  //                   />
  //                   <Box
  //                     sx={{
  //                       position: "absolute",
  //                       bottom: 10,
  //                       left: 10,
  //                       bgcolor: "rgba(0,0,0,0.6)",
  //                       color: "white",
  //                       px: 1.5,
  //                       py: 0.5,
  //                       borderRadius: "4px",
  //                       fontSize: "12px",
  //                     }}
  //                   >
  //                     {vid.username ? vid.username : "Participant"}
  //                   </Box>
  //                 </Box>
  //               ))}

  //               {/* Local Video (Floating) */}
  //               <Box
  //                 sx={
  //                   videos.length > 0
  //                     ? {
  //                         position: "absolute",
  //                         bottom: { xs: 90, md: 20 }, // Mobile pe bar ke upar
  //                         right: { xs: 10, md: showModal ? 370 : 20 },
  //                         width: { xs: "120px", md: "240px" }, // Mobile pe chota PIP
  //                         aspectRatio: "16/9",
  //                         bgcolor: "#000",
  //                         borderRadius: "12px",
  //                         overflow: "hidden",
  //                         boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  //                         border: "2px solid #555",
  //                         zIndex: 10,
  //                         transition: "all 0.3s ease",
  //                       }
  //                     : {
  //                         width: "80%",
  //                         maxWidth: "900px",
  //                         aspectRatio: "16/9",
  //                         bgcolor: "#3c4043",
  //                         borderRadius: "12px",
  //                         overflow: "hidden",
  //                         boxShadow: 3,
  //                         position: "relative",
  //                       }
  //                 }
  //               >
  //                 <video
  //                   ref={localVideoref}
  //                   autoPlay
  //                   muted
  //                   playsInline
  //                   style={{
  //                     width: "100%",
  //                     height: "100%",
  //                     objectFit: "cover",
  //                     transform: "scaleX(-1)",
  //                   }}
  //                 />
  //                 <Box
  //                   sx={{
  //                     position: "absolute",
  //                     bottom: 5,
  //                     left: 5,
  //                     bgcolor: "rgba(0,0,0,0.6)",
  //                     color: "white",
  //                     px: 1,
  //                     py: 0.2,
  //                     borderRadius: "4px",
  //                     fontSize: "10px",
  //                   }}
  //                 >
  //                   You
  //                 </Box>
  //               </Box>
  //             </Box>

  //             {/* Chat Sidebar (Responsive) */}
  //             {showModal && (
  //               <Box
  //                 sx={{
  //                   width: { xs: "100%", md: "360px" }, // Mobile pe full width chat
  //                   height: { xs: "40%", md: "100%" }, // Mobile pe aadhi screen
  //                   position: { xs: "absolute", md: "relative" },
  //                   bottom: 0,
  //                   right: 0,
  //                   bgcolor: "#242424",
  //                   display: "flex",
  //                   flexDirection: "column",
  //                   borderLeft: "1px solid #3c4043",
  //                   boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
  //                   zIndex: 20,
  //                 }}
  //               >
  //                 {/* Header */}
  //                 <Box
  //                   sx={{
  //                     p: "12px 20px",
  //                     borderBottom: "1px solid #3c4043",
  //                     display: "flex",
  //                     justifyContent: "space-between",
  //                     alignItems: "center",
  //                     bgcolor: "#1c1f25",
  //                   }}
  //                 >
  //                   <Typography
  //                     variant="subtitle1"
  //                     sx={{ color: "#e8eaed", fontWeight: 600 }}
  //                   >
  //                     Meeting Chat
  //                   </Typography>
  //                   <IconButton
  //                     size="small"
  //                     onClick={() => setModal(false)}
  //                     sx={{ color: "#9aa0a6" }}
  //                   >
  //                     ✖
  //                   </IconButton>
  //                 </Box>

  //                 {/* Messages Area */}
  //                 <Box
  //                   sx={{
  //                     flex: 1,
  //                     p: 2,
  //                     overflowY: "auto",
  //                     display: "flex",
  //                     flexDirection: "column",
  //                     gap: 2,
  //                   }}
  //                 >
  //                   {messages.map((item, index) => (
  //                     <Box
  //                       key={index}
  //                       sx={{
  //                         display: "flex",
  //                         gap: 1.5,
  //                         alignItems: "flex-start",
  //                       }}
  //                     >
  //                       <Avatar
  //                         sx={{
  //                           width: 28,
  //                           height: 28,
  //                           fontSize: "12px",
  //                           bgcolor:
  //                             item.sender === username ? "#0b57d0" : "#00796b",
  //                         }}
  //                       >
  //                         {item.sender?.charAt(0).toUpperCase()}
  //                       </Avatar>
  //                       <Box>
  //                         <Typography
  //                           variant="caption"
  //                           sx={{ color: "#8ab4f8", fontWeight: 600 }}
  //                         >
  //                           {item.sender === username ? "You" : item.sender}
  //                         </Typography>
  //                         <Typography
  //                           variant="body2"
  //                           sx={{ color: "#d2d3d7", fontSize: "0.85rem" }}
  //                         >
  //                           {item.data}
  //                         </Typography>
  //                       </Box>
  //                     </Box>
  //                   ))}
  //                 </Box>

  //                 {/* Input Area */}
  //                 <Box
  //                   sx={{
  //                     p: 2,
  //                     borderTop: "1px solid #3c4043",
  //                     bgcolor: "#1c1f25",
  //                   }}
  //                 >
  //                   <Box sx={{ display: "flex", gap: 1 }}>
  //                     <TextField
  //                       value={message}
  //                       onChange={(e) => setMessage(e.target.value)}
  //                       placeholder="Message..."
  //                       fullWidth
  //                       size="small"
  //                       sx={{
  //                         bgcolor: "#32363f",
  //                         borderRadius: "8px",
  //                         input: { color: "white" },
  //                       }}
  //                     />
  //                     <IconButton
  //                       onClick={sendMessage}
  //                       disabled={!message.trim()}
  //                       sx={{ bgcolor: "#0b57d0", color: "white" }}
  //                     >
  //                       <SendIcon />
  //                     </IconButton>
  //                   </Box>
  //                 </Box>
  //               </Box>
  //             )}
  //           </Box>

  //           {/* Bottom Control Bar (Responsive) */}
  //           <Box
  //             sx={{
  //               height: { xs: "70px", md: "80px" },
  //               bgcolor: "#202124",
  //               display: "flex",
  //               justifyContent: "center",
  //               alignItems: "center",
  //               gap: { xs: 1, md: 2 },
  //               px: 1,
  //             }}
  //           >
  //             <IconButton
  //               onClick={handleAudio}
  //               sx={{
  //                 bgcolor: audio ? "#3c4043" : "#ea4335",
  //                 color: "white",
  //                 width: { xs: 40, md: 50 },
  //                 height: { xs: 40, md: 50 },
  //               }}
  //             >
  //               {audio ? (
  //                 <MicIcon fontSize="small" />
  //               ) : (
  //                 <MicOffIcon fontSize="small" />
  //               )}
  //             </IconButton>

  //             <IconButton
  //               onClick={handleVideo}
  //               sx={{
  //                 bgcolor: video ? "#3c4043" : "#ea4335",
  //                 color: "white",
  //                 width: { xs: 40, md: 50 },
  //                 height: { xs: 40, md: 50 },
  //               }}
  //             >
  //               {video ? (
  //                 <VideocamIcon fontSize="small" />
  //               ) : (
  //                 <VideocamOffIcon fontSize="small" />
  //               )}
  //             </IconButton>

  //             <IconButton
  //               onClick={() => setModal(!showModal)}
  //               sx={{
  //                 bgcolor: showModal ? "#8ab4f8" : "#3c4043",
  //                 color: showModal ? "#202124" : "white",
  //                 width: { xs: 40, md: 50 },
  //                 height: { xs: 40, md: 50 },
  //               }}
  //             >
  //               <Badge badgeContent={newMessages} color="error">
  //                 <ChatIcon fontSize="small" />
  //               </Badge>
  //             </IconButton>

  //             <IconButton
  //               onClick={handleEndCall}
  //               sx={{
  //                 bgcolor: "#ea4335",
  //                 color: "white",
  //                 width: { xs: 50, md: 60 },
  //                 height: 40,
  //                 borderRadius: "20px",
  //               }}
  //             >
  //               <CallEndIcon />
  //             </IconButton>
  //           </Box>
  //         </Box>
  //       )}
  //     </Box>
  //   );
  // }

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "#202124",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {askForUsername ? (
        // --- LOBBY UI (Redesigned for Professional Look) ---
        <Box
          sx={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            p: { xs: 2, md: 4 },
            background:
              "radial-gradient(circle at center, #2c2e31 0%, #202124 100%)",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              width: "100%",
              maxWidth: "1000px",
              borderRadius: "24px",
              overflow: "hidden",
              bgcolor: "transparent",
              color: "#fff",
            }}
          >
            {/* Video Preview Section */}
            <Box
              sx={{
                flex: 1.2,
                p: { xs: 2, md: 4 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
              Pip
            >
              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "16/9",
                  bgcolor: "#3c4043",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                }}
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

                {/* Floating Media Toggles Over Video */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 2,
                  }}
                >
                  <IconButton
                    onClick={handleAudio}
                    sx={{
                      width: 50,
                      height: 50,
                      bgcolor: audio ? "rgba(60, 64, 67, 0.8)" : "#ea4335",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.2)",
                      "&:hover": { bgcolor: audio ? "#4a4d51" : "#d93025" },
                    }}
                  >
                    {audio ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                  <IconButton
                    onClick={handleVideo}
                    sx={{
                      width: 50,
                      height: 50,
                      bgcolor: video ? "rgba(60, 64, 67, 0.8)" : "#ea4335",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.2)",
                      "&:hover": { bgcolor: video ? "#4a4d51" : "#d93025" },
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
                flex: 0.8,
                p: { xs: 3, md: 6 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                textAlign: { xs: "center", md: "left" },
              }}
            >
              <Typography
                variant="h3"
                fontWeight="700"
                mb={1}
                sx={{ fontSize: { xs: "1.8rem", md: "2.5rem" } }}
              >
                Ready to join?
              </Typography>
              <Typography variant="body1" color="#9aa0a6" mb={4}>
                Join the conversation and stay connected.
              </Typography>

              <TextField
                placeholder="Enter your name"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    color: "white",
                    borderRadius: "12px",
                    bgcolor: "#3c4043",
                    "& fieldset": { borderColor: "transparent" },
                    "&:hover fieldset": { borderColor: "#5f6368" },
                    "&.Mui-focused fieldset": { borderColor: "#8ab4f8" },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={connect}
                disabled={!username.trim()}
                sx={{
                  py: 1.8,
                  fontSize: "1rem",
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: "600",
                  bgcolor: "#8ab4f8",
                  color: "#202124",
                  "&:hover": { bgcolor: "#aecbfa" },
                  boxShadow: "0 4px 12px rgba(138, 180, 248, 0.3)",
                }}
              >
                Join Meeting
              </Button>
            </Box>
          </Paper>
        </Box>
      ) : (
        // --- MEETING UI (Responsive & Professional) ---
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              flex: 1,
              overflow: "hidden",
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
                transition: "all 0.3s ease",
              }}
            >
              {/* Remote Videos */}
              {videos.map((vid) => (
                <Box
                  key={vid.socketId}
                  sx={{
                    position: "relative",
                    width: {
                      xs: "100%", // Mobile pe full width
                      sm: videos.length === 1 ? "80%" : "45%", // Tablet/Desktop logic
                    },
                    maxWidth: videos.length === 1 ? "900px" : "100%",
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
                  <Typography
                    sx={{
                      position: "absolute",
                      bottom: 12,
                      left: 12,
                      bgcolor: "rgba(0,0,0,0.6)",
                      color: "white",
                      px: 1.5,
                      py: 0.5,
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                  >
                    {vid.username || "Participant"}
                  </Typography>
                </Box>
              ))}

              {/* Local Video - Floating PIP on Mobile & Desktop */}
              <Box
                sx={{
                  position: {
                    xs: "fixed",
                    md: videos.length > 0 ? "fixed" : "relative",
                  },
                  bottom: { xs: 100, md: 100 },
                  right: {
                    xs: 20,
                    md: showModal ? 380 : 20,
                  },
                  width: {
                    xs: "120px",
                    sm: "180px",
                    md: videos.length > 0 ? "240px" : "80%",
                  },
                  maxWidth: "900px",
                  aspectRatio: "16/9",
                  bgcolor: "#000",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  border: "2px solid #5f6368",
                  zIndex: 10,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
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
                <Typography
                  sx={{
                    position: "absolute",
                    bottom: 5,
                    left: 5,
                    bgcolor: "rgba(0,0,0,0.6)",
                    color: "white",
                    px: 1,
                    py: 0.2,
                    borderRadius: "4px",
                    fontSize: "10px",
                  }}
                >
                  You
                </Typography>
              </Box>
            </Box>

            {/* Chat Sidebar (Responsive) */}
            {showModal && (
              <Box
                sx={{
                  width: { xs: "100%", md: "360px" },
                  height: { xs: "50%", md: "100%" }, // Mobile pe niche se aadha dikhega
                  position: { xs: "absolute", md: "relative" },
                  bottom: 0,
                  right: 0,
                  bgcolor: "#242424",
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: { md: "1px solid #3c4043" },
                  boxShadow: "-8px 0 24px rgba(0,0,0,0.4)",
                  zIndex: 20,
                }}
              >
                {/* Chat Header */}
                <Box
                  sx={{
                    p: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    bgcolor: "#1c1f25",
                  }}
                >
                  <Typography fontWeight="600">Meeting Chat</Typography>
                  <IconButton
                    onClick={() => setModal(false)}
                    size="small"
                    sx={{ color: "white" }}
                  >
                    ✖
                  </IconButton>
                </Box>

                {/* Messages Area */}
                <Box
                  sx={{
                    flex: 1,
                    p: 2,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {messages.map((item, index) => (
                    <Box key={index} sx={{ display: "flex", gap: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor:
                            item.sender === username ? "#8ab4f8" : "#00796b",
                          fontSize: "14px",
                        }}
                      >
                        {item.sender?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ color: "#8ab4f8", fontSize: "0.8rem" }}
                        >
                          {item.sender === username ? "You" : item.sender}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#d2d3d7" }}>
                          {item.data}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                {/* Chat Input */}
                <Box sx={{ p: 2, bgcolor: "#1c1f25", display: "flex", gap: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Send a message"
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    sx={{
                      bgcolor: "#3c4043",
                      borderRadius: "8px",
                      "& fieldset": { border: "none" },
                      input: { color: "white" },
                    }}
                  />
                  <IconButton
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    sx={{ color: "#8ab4f8" }}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>

          {/* Bottom Control Bar (Responsive) */}
          <Box
            sx={{
              height: { xs: "70px", md: "80px" },
              bgcolor: "#202124",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: { xs: 1, sm: 2 },
              px: 2,
            }}
          >
            <IconButton
              onClick={handleAudio}
              sx={{
                bgcolor: audio ? "#3c4043" : "#ea4335",
                color: "white",
                "&:hover": { bgcolor: "#4a4d51" },
              }}
            >
              {audio ? (
                <MicIcon fontSize="small" />
              ) : (
                <MicOffIcon fontSize="small" />
              )}
            </IconButton>

            <IconButton
              onClick={handleVideo}
              sx={{
                bgcolor: video ? "#3c4043" : "#ea4335",
                color: "white",
                "&:hover": { bgcolor: "#4a4d51" },
              }}
            >
              {video ? (
                <VideocamIcon fontSize="small" />
              ) : (
                <VideocamOffIcon fontSize="small" />
              )}
            </IconButton>

            {screenAvailable && (
              <IconButton
                onClick={handleScreen}
                sx={{
                  bgcolor: screen ? "#8ab4f8" : "#3c4043",
                  color: screen ? "#202124" : "white",
                }}
              >
                {screen ? (
                  <StopScreenShareIcon fontSize="small" />
                ) : (
                  <ScreenShareIcon fontSize="small" />
                )}
              </IconButton>
            )}

            <IconButton
              onClick={() => {
                setModal(!showModal);
                setNewMessages(0);
              }}
              sx={{
                bgcolor: showModal ? "#8ab4f8" : "#3c4043",
                color: showModal ? "#202124" : "white",
              }}
            >
              <Badge badgeContent={newMessages} color="error">
                <ChatIcon fontSize="small" />
              </Badge>
            </IconButton>

            <IconButton
              onClick={handleEndCall}
              sx={{
                bgcolor: "#ea4335",
                color: "white",
                px: 3,
                borderRadius: "20px",
                "&:hover": { bgcolor: "#d93025" },
              }}
            >
              <CallEndIcon />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}
