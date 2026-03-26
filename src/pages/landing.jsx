import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Button, 
    Box, 
    Typography, 
    Container, 
    AppBar, 
    Toolbar, 
    Grid,
    Stack
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';

export default function LandingPage() {
    const router = useNavigate();

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fafbfc', display: 'flex', flexDirection: 'column' }}>
            
            {/* 1. PROFESSIONAL NAVBAR */}
            <AppBar position="static" color="transparent" elevation={0} sx={{ px: { xs: 2, md: 6 }, py: 1 }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', padding: '0 !important' }}>
                    
                    {/* Brand Logo */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                        <VideoCallIcon sx={{ color: '#FF9839', fontSize: 55 }} />
                        <Typography variant="h5" sx={{ color: '#202124', fontWeight: 900, letterSpacing: '-0.5px' }}>
                            <h1 style={{fontSize: "30px", color: "Red",}}>BUEST</h1>
                        </Typography>
                    </Box>

                    {/* Navigation Links & Buttons */}
                    <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 3 }}>
                        <Typography 
                            onClick={() => router("/aljk23")}
                            sx={{ color: '#5f6368', cursor: 'pointer', fontWeight: 500, '&:hover': { color: '#FF9839' } }}
                        >
                            Join as Guest
                        </Typography>
                        
                        <Stack direction="row" spacing={2}>
                            <Button 
                                variant="outlined" 
                                onClick={() => router("/auth")}
                                sx={{ 
                                    color: '#202124', 
                                    borderColor: '#dadce0',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: 3,
                                    borderRadius: '8px',
                                    '&:hover': { borderColor: '#202124', backgroundColor: 'transparent' }
                                }}
                            >
                                Login
                            </Button>
                            <Button 
                                variant="contained" 
                                onClick={() => router("/auth")}
                                sx={{ 
                                    backgroundColor: '#FF9839', 
                                    boxShadow: 'none',
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: 3,
                                    borderRadius: '8px',
                                    '&:hover': { backgroundColor: '#e68933', boxShadow: '0 4px 6px rgba(255, 152, 57, 0.25)' }
                                }}
                            >
                                Register
                            </Button>
                        </Stack>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* 2. MAIN HERO SECTION */}
            <Container maxWidth="lg" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', mt: { xs: 4, md: 0 } }}>
                <Grid container spacing={4} alignItems="center" justifyContent="space-between">
                    
                    {/* Left Content */}
                    <Grid item xs={12} md={5}>
                        <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                            <Typography 
                                variant="h2" 
                                sx={{ 
                                    fontWeight: 800, 
                                    color: '#202124', 
                                    mb: 2, 
                                    fontSize: { xs: '2.8rem', md: '3.5rem' }, 
                                    lineHeight: 1.1,
                                    letterSpacing: '-1px'
                                }}
                            >
                                <span style={{ color: "#FF9839" }}>Connect</span> with<br/>your loved ones
                            </Typography>
                            
                            <Typography 
                                variant="h6" 
                                sx={{ 
                                    fontWeight: 400, 
                                    color: '#5f6368', 
                                    mb: 4, 
                                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                                    lineHeight: 1.6 
                                }}
                            >
                                Distance is just a word. Cover any distance instantly with high-quality, secure video calls on Apna Video Call.
                            </Typography>

                            <Button 
                                variant="contained" 
                                size="large"
                                onClick={() => router("/aljk23")}
                                sx={{ 
                                    backgroundColor: '#202124', 
                                    color: 'white',
                                    px: 5, 
                                    py: 1.5,
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                                    '&:hover': { backgroundColor: '#3c4043', transform: 'translateY(-2px)' },
                                    transition: 'all 0.2s ease-in-out'
                                }}
                            >
                                Get Started Free
                            </Button>
                        </Box>
                    </Grid>

                    {/* Right Content - Mobile Image */}
                    <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-end' } }}>
                        <Box 
                            component="img"
                            src="/mobile.png" 
                            alt="Apna Video Call App on Mobile"
                            sx={{
                                width: '100%',
                                maxWidth: { xs: '350px', md: '450px' },
                                height: 'auto',
                                // Ek halka sa drop shadow image ko pop karne ke liye
                                filter: 'drop-shadow(0px 20px 40px rgba(0, 0, 0, 0.15))' 
                            }}
                        />
                    </Grid>

                </Grid>
            </Container>
            
        </Box>
    )
}