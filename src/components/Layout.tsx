import { Box, Container } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import TopNav from './TopNav';

export default function Layout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Container maxWidth="xl" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
